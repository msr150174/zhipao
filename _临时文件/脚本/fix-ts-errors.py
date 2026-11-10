# -*- coding: utf-8 -*-
"""
修复 VTJ 导出代码的类型错误。

VTJ 导出模板把布尔属性写成 `clearable=""` / `stripe=""` 这种字符串形式，
在模板里能正常渲染，但 vue-tsc 严格模式下会报 TS2322。

这个脚本做三件事：
  1. 把 `xxx=""` 形式的布尔属性改成 `xxx`（Vue 的布尔属性缩写）
  2. 给回调参数补上类型标注
  3. 移除未使用的导入/变量
"""
import os
import re

ROOT = r"D:\智跑校园\后台管理-VTJ\src"

# Element Plus 组件的布尔属性：写成 attr="" 会被当成字符串
BOOL_ATTRS = [
    "clearable", "stripe", "show-overflow-tooltip", "show-password",
    "background", "border", "disabled", "loading", "round", "plain",
    "link", "inline", "fit", "highlight-current-row", "show-word-limit",
    "filterable", "allow-create", "default-first-option", "multiple",
    "collapse-tags", "selectable", "reserve-selection", "editable",
    "sortable", "fixed", "accordion", "closable", "center", "dot",
    "hide-on-click", "split-button", "autofocus", "readonly", "required",
]

# 需要移除的未使用导入（VTJ 模板固定导入 useStore 但页面没用到）
USELESS = [
    r"import\s*\{\s*useStore\s*\}\s*from\s*'@/vtj-compat';\s*\n",
    r"const\s+__store\s*=\s*useStore\(\);\s*\n",
]

fixed_files = []

for dirpath, _, files in os.walk(ROOT):
    for name in files:
        if not name.endswith(".vue"):
            continue
        path = os.path.join(dirpath, name)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        original = content

        # ---------- 1. 布尔属性：attr="" -> attr ----------
        for attr in BOOL_ATTRS:
            # 仅匹配 attr="" 或 attr=''（空字符串），不动 attr="xxx"
            content = re.sub(
                rf'\s+{re.escape(attr)}=""(?=[\s>/])',
                f" {attr}",
                content,
            )

        # ---------- 2. 隐式 any 参数补类型 ----------
        # (res) -> (res: unknown)
        content = re.sub(r"\((res|val|e|err|data|payload|row|scope|item|page)\)\s*=>",
                         r"(\1: any) =>", content)
        # 单个参数箭头函数
        content = re.sub(r"(?<![\w.])\(?\b(value|credit|status)\)?\s*=>\s*\{",
                         r"(\1: any) => {", content)

        # ---------- 3. 移除未使用的 useStore ----------
        if "__store" not in content.replace("const __store = useStore();", ""):
            content = re.sub(USELESS[1], "", content)
            content = re.sub(USELESS[0], "", content)

        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            fixed_files.append(path.replace(ROOT + os.sep, ""))

print("已修复的文件:")
for f in fixed_files:
    print(f"  {f}")
print(f"\n共 {len(fixed_files)} 个")
