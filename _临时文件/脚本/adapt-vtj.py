# -*- coding: utf-8 -*-
"""
把 VTJ 导出代码里的 @vtj/renderer 导入替换为本地兼容层，
并做必要的工程化调整（路由、依赖、样式变量）。
"""
import os
import re

ROOT = r"D:\智跑校园\后台管理-VTJ"

# ============================================================================
# 1. 替换 @vtj/renderer 导入
# ============================================================================
print("① 替换 @vtj/renderer 导入")
for dirpath, _, files in os.walk(os.path.join(ROOT, "src")):
    for name in files:
        if not name.endswith(".vue"):
            continue
        path = os.path.join(dirpath, name)
        with open(path, encoding="utf-8") as f:
            content = f.read()

        original = content
        # 支持单双引号、多行 import { a, b } from '@vtj/renderer'
        content = re.sub(
            r"import\s*\{([^}]*)\}\s*from\s*['\"]@vtj/renderer['\"];?",
            lambda m: "import {" + m.group(1) + "} from '@/vtj-compat';",
            content,
        )

        if content != original:
            # 去掉 @ts-nocheck（我们要真实类型检查）
            content = re.sub(r"^\s*//\s*@ts-nocheck\s*$\n", "", content, flags=re.M)
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)
            rel = path.replace(ROOT + os.sep, "")
            print(f"   OK  {rel}")

# ============================================================================
# 2. 生成全局样式（提供 VTJ 用到的 CSS 变量）
# ============================================================================
print("\n② 生成全局样式 variables.scss / index.scss")

os.makedirs(os.path.join(ROOT, "src", "styles"), exist_ok=True)

VARS = """/**
 * 全局设计变量
 * ----------------------------------------------------------------------------
 * 这些 CSS 变量来自 VTJ 导出模板的约定（--brand、--space-lg 等），
 * 页面样式大量引用它们，集中在这里定义便于统一调整。
 */

:root {
  /* 品牌色 */
  --brand: #22c55e;
  --brand-600: #16a34a;
  --brand-700: #15803d;
  --brand-light: #dcfce7;

  /* 中性色 */
  --text-1: #1f2937;
  --text-2: #6b7280;
  --text-3: #9ca3af;

  /* 背景与边框 */
  --bg-page: #f5f6f8;
  --card: #ffffff;
  --border: #e5e7eb;

  /* 圆角 */
  --radius-sm: 6px;
  --radius: 10px;
  --radius-lg: 16px;

  /* 间距 */
  --space-xs: 4px;
  --space-sm: 8px;
  --space: 16px;
  --space-lg: 24px;

  /* 阴影与动效 */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  --dur: 0.2s;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Element Plus 主色对齐品牌绿 */
:root {
  --el-color-primary: #22c55e;
  --el-color-primary-light-3: #4ade80;
  --el-color-primary-light-5: #86efac;
  --el-color-primary-light-7: #bbf7d0;
  --el-color-primary-light-8: #dcfce7;
  --el-color-primary-light-9: #f0fdf4;
  --el-color-primary-dark-2: #16a34a;
  --el-border-radius-base: 8px;
}
"""

INDEX_SCSS = """/**
 * 全局样式入口
 */
@use './variables.scss';

* {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 14px;
  color: var(--text-1);
  background: var(--bg-page);
  -webkit-font-smoothing: antialiased;
}

/* 通用卡片 */
.vtj-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}

/* 滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}
::-webkit-scrollbar-track {
  background: transparent;
}
"""

with open(os.path.join(ROOT, "src", "styles", "variables.scss"), "w", encoding="utf-8") as f:
    f.write(VARS)
with open(os.path.join(ROOT, "src", "styles", "index.scss"), "w", encoding="utf-8") as f:
    f.write(INDEX_SCSS)
print("   OK  src/styles/variables.scss")
print("   OK  src/styles/index.scss")

print("\n完成")
