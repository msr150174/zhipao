# -*- coding: utf-8 -*-
"""
把 VTJ 导出的 1.vue（含 7 个 SFC）拆成独立文件，
并改造成标准 Vite + Vue3 项目结构。
"""
import os
import re

SRC = r"D:\msr150174\项目\智跑校园\后台服务\源码\1.vue"
OUT = r"D:\智跑校园\后台管理-VTJ\src"

with open(SRC, encoding="utf-8") as f:
    lines = f.readlines()

# 按 <template> 行号切块（从 0 开始索引）
BLOCKS = [
    (0,    401,  "views/login/index.vue",        "登录页"),
    (401,  448,  "layout/AdminLayout.vue",       "主布局"),
    (448,  636,  "views/dashboard/index.vue",    "数据看板"),
    (636,  989,  "views/order/index.vue",        "订单管理"),
    (989,  1295, "views/user/index.vue",         "用户管理"),
    (1295, 1507, "views/runner/index.vue",       "跑腿员审核"),
    (1507, 1769, "views/finance/index.vue",      "财务中心"),
]

print("拆分结果:")
for start, end, rel, name in BLOCKS:
    content = "".join(lines[start:end])
    # 去掉行首统一缩进（VTJ 导出带 2 空格缩进）
    content = re.sub(r"(?m)^  ", "", content)
    content = content.rstrip() + "\n"

    path = os.path.join(OUT, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"  {name:<10} -> {rel:<32} {len(content.splitlines()):>4} 行")

print("\n完成")
