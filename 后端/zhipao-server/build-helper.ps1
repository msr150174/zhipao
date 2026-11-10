# ============================================================================
#  Zhipao Campus - build helper
#  Called by start.bat. Builds classpath and javac argument file.
#
#  Two compiler flags are REQUIRED:
#    --release 17   produce Java 17 bytecode (Spring Boot 3.2 ASM cannot read 21+)
#    -parameters    keep method parameter names (else @RequestParam APIs return 500)
# ============================================================================

param(
    [Parameter(Mandatory = $true)][string]$M2Repo,
    [Parameter(Mandatory = $true)][string]$SrcDir,
    [Parameter(Mandatory = $true)][string]$OutDir,
    [Parameter(Mandatory = $true)][string]$ResDir,
    [Parameter(Mandatory = $true)][string]$LombokJar,
    [Parameter(Mandatory = $true)][string]$TempDir
)

$ErrorActionPreference = 'Stop'

# ---------- 1. collect dependency jars ----------
$jars = Get-ChildItem $M2Repo -Recurse -File -Filter *.jar -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -notmatch 'sources|javadoc' }

if ($jars.Count -eq 0) {
    Write-Host "      [ERROR] no jar found in: $M2Repo"
    exit 1
}

$cp = ($jars | ForEach-Object { $_.FullName }) -join ';'

# ---------- 2. collect sources ----------
$srcs = Get-ChildItem $SrcDir -Recurse -File -Filter *.java -ErrorAction SilentlyContinue |
    ForEach-Object { $_.FullName }

if ($srcs.Count -eq 0) {
    Write-Host "      [ERROR] no source found in: $SrcDir"
    exit 1
}

Write-Host ("      jars: " + $jars.Count + " / sources: " + $srcs.Count)

# ---------- 3. write javac argument file ----------
# Paths use forward slashes to avoid backslash being treated as escape char.
function To-Slash([string]$p) { return ($p -replace '\\', '/') }

$lines = New-Object System.Collections.Generic.List[string]
foreach ($a in @('-encoding', 'UTF-8', '-nowarn', '--release', '17', '-parameters')) {
    $lines.Add($a)
}
$lines.Add('-cp')
$lines.Add('"' + (To-Slash $cp) + '"')
$lines.Add('-processorpath')
$lines.Add('"' + (To-Slash $LombokJar) + '"')
$lines.Add('-d')
$lines.Add('"' + (To-Slash $OutDir) + '"')
foreach ($s in $srcs) {
    $lines.Add('"' + (To-Slash $s) + '"')
}

$javacFile = Join-Path $TempDir 'zhipao_javac.txt'
[System.IO.File]::WriteAllLines($javacFile, $lines, (New-Object System.Text.UTF8Encoding($false)))

# ---------- 4. write runtime classpath ----------
$runCp = $OutDir + ';' + $ResDir + ';' + $cp
$cpFile = Join-Path $TempDir 'zhipao_cp.txt'
[System.IO.File]::WriteAllText($cpFile, $runCp, [System.Text.Encoding]::UTF8)

Write-Host "      classpath ready"
exit 0
