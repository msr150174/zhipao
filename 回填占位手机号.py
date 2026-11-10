# -*- coding: utf-8 -*-
"""
把 xyzp.users 里 phone IS NULL 的账号回填占位手机号。

占位规则必须和 Java 端 AuthService.placeholderPhone() 完全一致：
    "000" + String.format("%08d", Math.abs(openid.hashCode()) % 100000000)

所以这里用 Python 重新实现 Java 的 String.hashCode()。
"""
import subprocess
import sys

MYSQL = r"D:\mysql\bin\mysql.exe"
DB = "xyzp"


def java_hash(s: str) -> int:
    """Java String.hashCode() 的精确实现（32 位有符号）。"""
    h = 0
    for ch in s:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    return h


def placeholder(openid: str) -> str:
    return "000" + "%08d" % (abs(java_hash(openid)) % 100000000)


def sql(query: str) -> list:
    r = subprocess.run(
        [MYSQL, "-uroot", "-pmsr150174", "--default-character-set=utf8mb4",
         "-N", "-B", "-e", query],
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if r.returncode != 0 and "Warning" not in (r.stderr or ""):
        print("  SQL error:", (r.stderr or "").strip()[:200])
        return []
    return [l for l in (r.stdout or "").splitlines() if l.strip()]


print()
print("=" * 66)
print("  Backfill placeholder phone numbers")
print("=" * 66)
print()

rows = sql(f"SELECT id, openid FROM {DB}.users WHERE phone IS NULL OR phone = ''")
print(f"  Found {len(rows)} accounts without a phone number")
print()

if not rows:
    print("  Nothing to do.")
    sys.exit(0)

used = set(sql(f"SELECT phone FROM {DB}.users WHERE phone IS NOT NULL"))
print(f"  Existing phones: {len(used)}")
print()

updates = []
skipped = 0
for line in rows:
    parts = line.split("\t")
    if len(parts) < 2:
        skipped += 1
        continue
    uid, openid = parts[0], parts[1]

    if not openid:
        skipped += 1
        continue

    phone = placeholder(openid)
    if phone in used:
        # 理论上不会发生（15 个 openid 已验证无冲突），
        # 万一撞了就跳过，避免唯一索引报错
        print(f"  SKIP (collision): {phone}  openid={openid}")
        skipped += 1
        continue

    used.add(phone)
    updates.append((uid, phone, openid))

print(f"  Will update {len(updates)} rows, skip {skipped}")
print()

if not updates:
    print("  Nothing to update.")
    sys.exit(0)

# 逐条更新，出错也不影响其他行
ok = 0
fail = 0
for uid, phone, openid in updates:
    r = subprocess.run(
        [MYSQL, "-uroot", "-pmsr150174", "-N", "-B", "-e",
         f"UPDATE {DB}.users SET phone='{phone}' WHERE id='{uid}' AND (phone IS NULL OR phone='')"],
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if r.returncode == 0 or "Warning" in (r.stderr or ""):
        ok += 1
        print(f"    {phone}  <-  {openid}")
    else:
        fail += 1
        print(f"    FAILED {openid}: {(r.stderr or '').strip()[:80]}")

print()
print("-" * 66)
print(f"  updated: {ok}   failed: {fail}")
print("-" * 66)
print()

# 验证
left = sql(f"SELECT COUNT(*) FROM {DB}.users WHERE phone IS NULL OR phone = ''")
print(f"  Remaining without phone: {left[0] if left else '?'}")
print()
