# -*- coding: utf-8 -*-
"""
第二轮类型修复：处理 {} 索引、未使用变量、模板作用域变量。
"""
import os
import re

ROOT = r"D:\智跑校园\后台管理-VTJ\src"

fixed = []

for dirpath, _, files in os.walk(ROOT):
    for name in files:
        if not name.endswith(".vue"):
            continue
        path = os.path.join(dirpath, name)
        with open(path, encoding="utf-8") as f:
            content = f.read()
        original = content

        # ---------- 1. reactive 对象加索引签名 ----------
        # const __state = reactive({...})  ->  用 as any 断开推断
        # 只对页面里的 __state 生效
        content = re.sub(
            r"const __state = reactive\(\{",
            "const __state: any = reactive({",
            content,
        )

        # ---------- 2. 局部变量加 any ----------
        content = re.sub(r"const (payload|body|data|res|list|params) = ",
                         r"const \1: any = ", content)

        # ---------- 3. 移除未使用的 useStore ----------
        # 先删 const __store = useStore();
        content = re.sub(r"^\s*const __store = useStore\(\);\s*$", "", content, flags=re.M)
        # 再删 import 里的 useStore
        content = re.sub(r"(import\s*\{)([^}]*?)(\}\s*from\s*'@/vtj-compat')",
                         lambda m: m.group(1) + re.sub(r"\buseStore\s*,?\s*", "", m.group(2)).strip().rstrip(",") + " " + m.group(3)
                         if "useProvider" in m.group(2) or "useStore" in m.group(2) else m.group(0),
                         content)

        # ---------- 4. 未使用的 __provider ----------
        if "__provider" not in content.replace("const __provider = useProvider", ""):
            content = re.sub(r"^\s*const __provider = useProvider\([^)]*\);\s*$", "", content, flags=re.M)
            content = re.sub(r"(import\s*\{)([^}]*?)(\}\s*from\s*'@/vtj-compat')",
                             lambda m: m.group(1) + re.sub(r"\buseProvider\s*,?\s*", "", m.group(2)).strip().rstrip(",") + " " + m.group(3),
                             content)

        # ---------- 5. v-for 未使用的 index ----------
        content = re.sub(r"v-for=\"\(tab, index\) in ([^\"]+)\"([^>]*?):key=\"tab\.value\"",
                         r'v-for="tab in \1"\2:key="tab.value"', content)

        # ---------- 6. 模板 slot 未使用的作用域变量 ----------
        content = re.sub(r'<template #empty="scope_\w+">', "<template #empty>", content)
        content = re.sub(r'<template #footer="scope_\w+">', "<template #footer>", content)
        content = re.sub(r'<template #prefix="scope_\w+">', "<template #prefix>", content)
        content = re.sub(r'<template #default="scope_\w+">', '<template #default="{ row }">', content)

        # ---------- 7. 索引访问加 as any ----------
        content = re.sub(r"statusType\((\w+\.status)\)", r"statusType((\1 as any))", content)

        if content != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            fixed.append(path.replace(ROOT + os.sep, ""))

print("第二轮修复:")
for f in fixed:
    print(f"  {f}")
print(f"\n共 {len(fixed)} 个")
