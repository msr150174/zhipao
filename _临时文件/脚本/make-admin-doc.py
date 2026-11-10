# -*- coding: utf-8 -*-
"""
生成「智跑校园 · 后台管理系统」Coze AI 开发提示词文档 (DOCX)
"""

from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DOC = Document()

# ============================================================
# 全局样式
# ============================================================
def set_cjk(run, name="微软雅黑"):
    """中文字体必须显式设置 eastAsia，否则可能不生效"""
    run.font.name = name
    r = run._element
    rPr = r.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:eastAsia'), name)


def set_doc_font(doc, ascii_font="Calibri", cjk_font="微软雅黑"):
    """
    ★ 正文用 Calibri（非等宽），只有代码块用 Consolas。
      若正文用等宽字体，中文会被按全角等宽计算，导致居中/换行偏差。
    """
    style = doc.styles['Normal']
    style.font.name = ascii_font
    style.font.size = Pt(10.5)
    rPr = style.element.get_or_add_rPr()
    rFonts = rPr.find(qn('w:rFonts'))
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts')
        rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), ascii_font)
    rFonts.set(qn('w:hAnsi'), ascii_font)
    rFonts.set(qn('w:eastAsia'), cjk_font)


set_doc_font(DOC)

# 页面设置：A4 + 合理边距
from docx.shared import Mm
from docx.enum.section import WD_ORIENT

for section in DOC.sections:
    # ★ 显式设置 A4 纸张（否则 LibreOffice 可能按 Letter 渲染导致内容溢出）
    section.page_width = Mm(210)
    section.page_height = Mm(297)
    section.top_margin = Mm(20)
    section.bottom_margin = Mm(20)
    section.left_margin = Mm(22)
    section.right_margin = Mm(22)


def h(text, level=1):
    heading = DOC.add_heading(text, level=level)
    for run in heading.runs:
        set_cjk(run, "微软雅黑")
        run.font.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    return heading


def p(text, bold=False, size=10.5, color=None, align=None):
    para = DOC.add_paragraph()
    # ★ 显式设置右缩进，避免长行超出页边距
    para.paragraph_format.right_indent = Cm(0.3)
    if align:
        para.alignment = align
    run = para.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    if color:
        run.font.color.rgb = color
    set_cjk(run)
    return para


def bullet(text, level=0):
    para = DOC.add_paragraph(style='List Bullet')
    para.paragraph_format.right_indent = Cm(0.3)
    if level:
        para.paragraph_format.left_indent = Cm(1.2 + 0.6 * level)
    run = para.add_run(text)
    run.font.size = Pt(10.5)
    set_cjk(run)
    return para


def code_block(text, lang_hint=""):
    """代码块：等宽字体 + 灰底 + 自动换行"""
    para = DOC.add_paragraph()
    para.paragraph_format.left_indent = Cm(0.3)
    para.paragraph_format.right_indent = Cm(0.3)
    para.paragraph_format.space_before = Pt(4)
    para.paragraph_format.space_after = Pt(4)

    # 灰底
    pPr = para._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), 'F5F5F5')
    pPr.append(shd)

    # ★ 分段写入并允许换行（避免长行被裁切）
    lines = text.split('\n')
    for i, line in enumerate(lines):
        if i > 0:
            para.add_run().add_break()
        run = para.add_run(line)
        run.font.name = 'Consolas'
        run.font.size = Pt(8.5)          # ★ 从 9pt 降到 8.5pt
        rPr = run._element.get_or_add_rPr()
        rFonts = rPr.find(qn('w:rFonts'))
        if rFonts is None:
            rFonts = OxmlElement('w:rFonts')
            rPr.append(rFonts)
        rFonts.set(qn('w:ascii'), 'Consolas')
        rFonts.set(qn('w:hAnsi'), 'Consolas')
        rFonts.set(qn('w:eastAsia'), '微软雅黑')

    return para


def table(headers, rows, widths=None):
    t = DOC.add_table(rows=1, cols=len(headers))
    t.style = 'Light Grid Accent 1'
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False

    # ★ 按内容宽度分配列宽（总宽不超过正文宽度 166mm）
    total_mm = 160
    n = len(headers)
    if widths:
        col_mm = widths
    else:
        # 第一列通常短，其余均分
        first = 35 if n >= 3 else total_mm / n
        rest = (total_mm - first) / (n - 1) if n > 1 else total_mm
        col_mm = [first] + [rest] * (n - 1)

    for row in t.rows:
        for i, cell in enumerate(row.cells):
            cell.width = Mm(col_mm[i] if i < len(col_mm) else col_mm[-1])

    hdr = t.rows[0].cells
    for i, text in enumerate(headers):
        hdr[i].text = ''
        run = hdr[i].paragraphs[0].add_run(text)
        run.bold = True
        run.font.size = Pt(8.5)
        set_cjk(run)

    for row in rows:
        cells = t.add_row().cells
        for i, text in enumerate(row):
            cells[i].text = ''
            run = cells[i].paragraphs[0].add_run(str(text))
            run.font.size = Pt(8)
            set_cjk(run)

    # 再次应用列宽（python-docx 需在添加行后重设）
    for row in t.rows:
        for i, cell in enumerate(row.cells):
            cell.width = Mm(col_mm[i] if i < len(col_mm) else col_mm[-1])

    return t


def note(text, kind="info"):
    """提示框（★ 显式设置左右缩进，避免长文本超出右边距）"""
    colors = {
        "info": RGBColor(0x1E, 0x60, 0xA8),
        "warn": RGBColor(0xC0, 0x50, 0x00),
        "danger": RGBColor(0xC0, 0x00, 0x00),
        "ok": RGBColor(0x1E, 0x7A, 0x3C),
    }
    para = DOC.add_paragraph()
    para.paragraph_format.left_indent = Cm(0.5)
    para.paragraph_format.right_indent = Cm(0.5)
    run = para.add_run(text)
    run.font.size = Pt(10)
    run.font.color.rgb = colors.get(kind, colors["info"])
    run.bold = True
    set_cjk(run)
    return para


# ============================================================
# 封面（★ 用空段落做垂直留白，不用 \n —— \n 会干扰居中对齐）
# ============================================================
for _ in range(8):
    DOC.add_paragraph()

title = DOC.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.left_indent = Cm(0)
title.paragraph_format.right_indent = Cm(0)
r = title.add_run("智跑校园 · 后台管理系统")
r.bold = True
r.font.size = Pt(20)
set_cjk(r)

sub = DOC.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = sub.add_run("Coze AI 开发提示词 + 接口契约文档")
r.font.size = Pt(13)
r.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
set_cjk(r)

DOC.add_paragraph()
ver = DOC.add_paragraph()
ver.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = ver.add_run("版本 1.0   |   21 个接口已实现并测试通过")
r.font.size = Pt(11)
r.font.color.rgb = RGBColor(0x1E, 0x7A, 0x3C)
set_cjk(r)

DOC.add_page_break()

# ============================================================
# 第一部分：给 Coze 的提示词
# ============================================================
h("第一部分 · 给 Coze 的完整提示词", 1)

note("使用方法：把以下整段内容复制粘贴给 Coze，它会生成一个完整的 Vue 3 后台管理项目。", "info")
DOC.add_paragraph()

h("1. 角色与任务", 2)
code_block(
"""你是一位资深的前端工程师。请为我开发一个完整的「智跑校园」后台管理系统。"""
)

h("2. 技术栈（严格遵守，不要替换）", 2)
bullet("Vue 3（Composition API + <script setup> + TypeScript）")
bullet("Vite 构建")
bullet("Element Plus（UI 组件库）")
bullet("Vue Router 4（路由 + 守卫）")
bullet("Pinia（状态管理）")
bullet("Axios（HTTP 请求）")
bullet("ECharts（看板图表）")
bullet("SCSS 样式")
DOC.add_paragraph()
note("不要用：React、Nuxt、SSR、Tailwind、Ant Design、任何后端模板引擎。", "danger")

h("3. 项目基本信息", 2)
table(
    ["项", "值", "说明"],
    [
        ["项目名", "zhipao-admin", "目录名"],
        ["开发端口", "5174", "★ 不要用 5173（已被小程序占用）"],
        ["后端地址", "http://localhost:3000/api", "通过 Vite proxy 转发"],
        ["Mock 数据", "不需要", "后端已完成，21 个接口全部可用"],
    ]
)

DOC.add_page_break()

# ============================================================
# 接口契约
# ============================================================
h("第二部分 · 接口契约（最重要）", 1)

h("2.1 通用约定", 2)

p("请求格式", bold=True)
code_block(
"""基础路径：/api
鉴权 Header：Authorization: Bearer <token>
Content-Type：application/json"""
)

p("响应信封（所有接口统一）", bold=True)
code_block(
"""{
  "code": 200,
  "msg": "ok",
  "data": { }
}"""
)

note("★★ 关键规则 ★★", "danger")
bullet("HTTP 状态码永远是 200，业务成功与否看 body.code")
bullet("code === 200 表示成功，其他为错误")
bullet("msg 是中文错误提示，可直接展示给用户")
bullet("前端绝对不能根据 response.status 判断成败")

p("错误码处理表", bold=True)
table(
    ["code", "含义", "前端处理"],
    [
        ["200", "成功", "正常处理"],
        ["400", "参数错误", "ElMessage.error(msg)"],
        ["401", "未登录 / Token 失效", "清除 token，跳转 /login"],
        ["403", "无管理权限", "清除 token，提示后跳转 /login"],
        ["404", "资源不存在", "ElMessage.error(msg)"],
        ["500", "服务端错误", "ElMessage.error(msg)"],
    ]
)

p("分页响应格式", bold=True)
code_block(
"""{
  "code": 200,
  "data": {
    "list": [],
    "total": 15,
    "page": 1,
    "pageSize": 20,
    "hasMore": false
  }
}"""
)

DOC.add_page_break()

h("2.2 登录接口（4 个）", 2)

p("① 发送验证码", bold=True)
code_block(
"""POST /api/auth/sms/send
Body: { "phone": "13800001234" }

Response:
{
  "code": 200,
  "data": { "sent": true, "devMode": true }
}"""
)
note("devMode 为 true 表示开发模式：验证码不发短信，而是打印在后端控制台。前端需提示「验证码见服务端日志」。", "warn")

p("② 手机号登录", bold=True)
code_block(
"""POST /api/auth/sms/login
Body: { "phone": "13800001234", "code": "654321" }

Response:
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOiJIUzM4NCJ9...",
    "user": {
      "id": "25c78b09fcc74449bd8bed3ef7252a96",
      "nickname": "同学",
      "phone": "138****1234",
      "creditScore": 60,
      "balance": 0,
      "income": 0,
      "isRunner": false,
      "isAdmin": true,
      "realNameVerified": false
    }
  }
}"""
)
note("★ 前端必须检查 user.isAdmin，为 false 时提示「无管理权限」并清除 token。", "danger")

p("③ 获取当前用户", bold=True)
code_block(
"""GET /api/auth/me
Response data: 用户对象（结构同上的 user）"""
)

p("④ 登出", bold=True)
code_block("""POST /api/auth/logout""")

h("2.3 数据看板（1 个）", 2)

code_block(
"""GET /api/admin/dashboard

Response:
{
  "code": 200,
  "data": {
    "orders": {
      "total": 15,
      "today_total": 3,
      "waiting_accept": 5,
      "in_progress": 2,
      "delivered": 0,
      "completed": 2,
      "cancelled": 6,
      "appealing": 0,
      "total_amount": 10.00,
      "today_amount": 10.00
    },
    "users": {
      "total": 15,
      "today_new": 1,
      "runners": 0,
      "frozen": 0,
      "low_credit": 0,
      "total_balance": 10.00
    },
    "pending": {
      "runnerApplications": 0,
      "appealingOrders": 0,
      "withdrawals": 0,
      "overdueOrders": 0
    },
    "trend": [
      { "day": "2026-10-12", "order_count": 11, "amount": 10.00 },
      { "day": "2026-10-13", "order_count": 4, "amount": 0 }
    ]
  }
}"""
)

DOC.add_page_break()

h("2.4 订单管理（4 个）", 2)

p("① 订单列表", bold=True)
code_block(
"""GET /api/admin/orders
  ?status=WAITING_ACCEPT
  &deliveryType=1
  &keyword=ZP261013
  &startDate=2026-10-01
  &endDate=2026-10-13
  &page=1
  &pageSize=20

所有查询参数均可选，pageSize 最大 100。

Response list 项：
{
  "id": "c753262173364adf85106714ade11f3b",
  "orderNo": "ZP261013LMGGAF",
  "status": "WAITING_ACCEPT",
  "statusText": "待接单",
  "deliveryType": 1,
  "deliveryTypeText": "取快递",
  "packageSizeText": "中件",
  "stationName": "菜鸟驿站(3号楼店)",
  "buildingName": "1号楼",
  "roomNo": "203",
  "reward": 10.00,
  "urgent": false,
  "publisherId": "25c78b09...",
  "publisherName": "同学",
  "runnerId": null,
  "runnerName": null,
  "createTime": "2026-10-13 10:17:29",
  "deadline": "2026-10-13 12:17:00"
}"""
)

p("② 订单详情（★ 不脱敏，管理员可见取件码明文）", bold=True)
code_block(
"""GET /api/admin/orders/{id}

Response data 在列表字段基础上增加：
{
  "packageSize": 2,
  "stationId": "st_001",
  "pickupCode": "8-2-3021",
  "shopNo": null,
  "stationLng": 113.335,
  "stationLat": 23.155,
  "buildingId": "bd_001",
  "buildingLng": 113.3345,
  "buildingLat": 23.1548,
  "itemCount": 1,
  "remark": "",
  "distanceMeters": null,
  "publisherPhone": "13800001234",
  "runnerCredit": null,
  "cancelReason": null,
  "acceptTime": null,
  "completeTime": null,
  "expired": false
}"""
)

p("③ 强制取消订单", bold=True)
code_block(
"""POST /api/admin/orders/{id}/cancel
Body: { "reason": "用户申诉，订单异常" }

Response:
{
  "code": 200,
  "data": {
    "ok": true,
    "orderNo": "ZP261013LMGGAF",
    "message": "订单已强制取消"
  }
}"""
)

p("④ 强制完成订单", bold=True)
code_block(
"""POST /api/admin/orders/{id}/complete
Body: { "reason": "发布方长期未确认" }

★ 仅 DELIVERED 状态可用，否则返回 400。"""
)

p("订单状态枚举（9 种，固定不变）", bold=True)
table(
    ["status", "statusText", "说明"],
    [
        ["CREATED", "已创建", "占位，一般不出现"],
        ["WAITING_ACCEPT", "待接单", "可被接单"],
        ["ACCEPTED", "已接单", "跑腿员已接"],
        ["PICKING", "取件中", ""],
        ["DELIVERING", "配送中", ""],
        ["DELIVERED", "已送达待确认", "等待发布方确认"],
        ["COMPLETED", "已完成", "终态"],
        ["CANCELLED", "已取消", "终态"],
        ["APPEALING", "申诉中", ""],
    ]
)
p("配送类型：1 = 取快递，2 = 取外卖", bold=True)

DOC.add_page_break()

h("2.5 用户管理（6 个）", 2)

p("① 用户列表", bold=True)
code_block(
"""GET /api/admin/users
  ?keyword=同学
  &minCredit=0
  &maxCredit=60
  &isRunner=true
  &status=1
  &page=1
  &pageSize=20

Response list 项：
{
  "id": "25c78b09fcc74449bd8bed3ef7252a96",
  "nickname": "同学",
  "phone": "13800001234",
  "studentNo": null,
  "creditScore": 60,
  "balance": 0.00,
  "income": 0.00,
  "isRunner": false,
  "isAdmin": true,
  "realNameVerified": false,
  "status": 1,
  "statusText": "正常",
  "createTime": "2026-10-12 20:31:27"
}"""
)

p("② 用户详情（含订单统计）", bold=True)
code_block(
"""GET /api/admin/users/{id}

Response data 增加：
{
  "openid": "dev_openid_default",
  "avatarUrl": null,
  "stats": {
    "total": 5,
    "published": 3,
    "taken": 2,
    "completed": 1,
    "earned": 10.00
  }
}"""
)

p("③ 调整信用分", bold=True)
code_block(
"""POST /api/admin/users/{id}/credit
Body: { "delta": -10, "reason": "虚假发单" }

Response:
{
  "code": 200,
  "data": {
    "ok": true,
    "before": 60,
    "after": 50,
    "message": "信用分已调整"
  }
}

规则：delta 不能为 0，绝对值不超过 100，reason 必填。
     最终分值限制在 0 ~ 100。"""
)

p("④ 冻结账号", bold=True)
code_block("""POST /api/admin/users/{id}/freeze
Body: { "reason": "多次违规" }""")

p("⑤ 解冻账号", bold=True)
code_block("""POST /api/admin/users/{id}/unfreeze""")

p("⑥ 设置 / 取消管理员", bold=True)
code_block("""POST /api/admin/users/{id}/admin
Body: { "isAdmin": true }""")

h("2.6 跑腿员审核（3 个）", 2)

p("① 申请列表", bold=True)
code_block(
"""GET /api/admin/runner-applications
  ?status=0
  &page=1
  &pageSize=20

status: 0=待审, 1=通过, 2=驳回, 不传=全部

Response list 项：
{
  "id": 1,
  "userId": "d4b303ce...",
  "realName": "张三",
  "studentNo": "2021001",
  "phone": "13800001234",
  "campus": "东校区",
  "idCardImg": "https://...",
  "intro": "空闲时间多",
  "status": 0,
  "statusText": "待审核",
  "rejectReason": null,
  "createTime": "2026-10-13 09:00:00",
  "reviewedAt": null
}"""
)

p("② 审核通过", bold=True)
code_block(
"""POST /api/admin/runner-applications/{id}/approve

Response:
{
  "code": 200,
  "data": {
    "ok": true,
    "userId": "d4b303ce...",
    "message": "已通过，该用户现在可以接单"
  }
}"""
)

p("③ 审核驳回", bold=True)
code_block(
"""POST /api/admin/runner-applications/{id}/reject
Body: { "reason": "学号与姓名不匹配" }

规则：reason 必填，最长 200 字。"""
)

DOC.add_page_break()

h("2.7 资金管理（3 个）", 2)

note("★★ 注意：这两个接口返回【下划线字段名】，不是 camelCase，前端必须按原字段名解析。", "danger")

p("① 全局流水", bold=True)
code_block(
"""GET /api/admin/transactions
  ?type=WITHDRAW
  &keyword=WD261013
  &page=1
  &pageSize=20

type 可选：INCOME / EXPENSE / WITHDRAW / REFUND

Response list 项（★ 下划线命名）：
{
  "id": 1,
  "user_id": "48cda97d...",
  "type": "INCOME",
  "amount": 10.00,
  "balance": 10.00,
  "order_no": "ZP26101215ZD71",
  "apply_no": null,
  "status": "SUCCESS",
  "remark": "跑腿收入",
  "created_at": "2026-10-12 20:09:52",
  "nickname": "测试用户B",
  "phone": "13800001234"
}"""
)

p("② 提现申请列表", bold=True)
code_block(
"""GET /api/admin/withdrawals?status=PENDING&page=1&pageSize=20

Response 结构同上，额外含 "user_balance"（用户当前余额）"""
)

p("③ 审核提现", bold=True)
code_block(
"""POST /api/admin/withdrawals/{id}/review
Body: { "pass": true, "reason": "已转账" }

★ pass 为 false 时，系统会自动把金额退回用户余额。"""
)

DOC.add_page_break()

# ============================================================
# 页面设计
# ============================================================
h("第三部分 · 页面设计要求", 1)

h("3.1 整体布局 AdminLayout.vue", 2)
code_block(
"""┌──────────────────────────────────────────────────────────┐
│  [Logo] 智跑校园后台          [管理员名] [退出]           │  顶栏 60px
├────────────┬─────────────────────────────────────────────┤
│            │                                             │
│  📊 数据看板│                                             │
│  📋 订单管理│            内容区                           │
│  👤 用户管理│                                             │
│  🏃 跑腿员审核│                                           │
│  💰 资金管理│                                             │
│            │                                             │
│  侧边栏 200px                              主内容区       │
└────────────┴─────────────────────────────────────────────┘"""
)
bullet("使用 el-container + el-aside + el-header + el-main")
bullet("侧边栏固定 200px，可折叠")
bullet("顶栏左侧显示标题，右侧显示管理员昵称 + 退出按钮")

h("3.2 六个页面清单", 2)
table(
    ["#", "路由", "页面", "优先级"],
    [
        ["1", "/login", "登录", "P0"],
        ["2", "/dashboard", "数据看板", "P0"],
        ["3", "/orders", "订单管理", "P0"],
        ["4", "/users", "用户管理", "P0"],
        ["5", "/runner-applications", "跑腿员审核", "P0"],
        ["6", "/finance", "资金管理（Tab：流水 / 提现）", "P1"],
    ]
)

h("3.3 登录页 /login", 2)
code_block(
"""┌───────────────────────────────────────┐
│                                       │
│            🏃 智跑校园                │
│            运营管理后台                │
│                                       │
│     ┌─────────────────────────┐       │
│     │ 📱 手机号                │       │
│     │ [13800001234        ]   │       │
│     └─────────────────────────┘       │
│                                       │
│     ┌─────────────────┬───────────┐   │
│     │ 🔑 验证码        │ [获取验证码]│   │
│     │ [654321    ]    │  60s      │   │
│     └─────────────────┴───────────┘   │
│                                       │
│     ┌─────────────────────────┐       │
│     │        登  录            │       │
│     └─────────────────────────┘       │
│                                       │
│     ⚠️ 仅管理员可登录                  │
└───────────────────────────────────────┘"""
)
bullet("手机号格式校验：/^1[3-9]\\d{9}$/")
bullet("点「获取验证码」后 60 秒倒计时")
bullet("若返回 devMode=true，提示「开发模式：验证码见服务端日志」")
bullet("登录成功后存 token 到 localStorage，并检查 isAdmin")

h("3.4 数据看板 /dashboard", 2)
code_block(
"""┌──────────┬──────────┬──────────┬──────────┐
│ 📦 订单总数│ ⏳ 待接单 │ 💰 今日成交│ 📊 今日订单│
│    15    │    5     │  ¥10.00  │    3     │
└──────────┴──────────┴──────────┴──────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ 👥 用户总数│ 🏃 跑腿员 │ 💳 待提现 │ ⚠️ 超时单 │
│    15    │    0     │    0     │    0     │
└──────────┴──────────┴──────────┴──────────┘

┌────────────────────────────────────────────┐
│  近 7 天订单趋势（ECharts 折线图，双 Y 轴）  │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│  📌 待办事项                                │
│  │ 🏃 2 个跑腿员申请待审核    [去处理 →] │  │
│  │ 💰 1 笔提现待审核          [去处理 →] │  │
│  │ ⏰ 3 个订单超时未接单       [查看 →]   │  │
└────────────────────────────────────────────┘"""
)
bullet("8 个 el-card 数字卡片，2 行 4 列")
bullet("折线图用 ECharts，双 Y 轴（订单数 + 金额）")
bullet("待办事项可点击跳转对应页面")
bullet("每 60 秒自动刷新，离开页面时清除定时器")

DOC.add_page_break()

h("3.5 订单管理 /orders（核心页面）", 2)
code_block(
"""┌─────────────────────────────────────────────────────────────┐
│ 状态[全部▾] 类型[全部▾] [日期范围] [🔍 订单号/驿站] [查询][重置]│
├─────────────────────────────────────────────────────────────┤
│ 订单号        │状态  │类型  │取件点      │送达      │报酬│操作│
├───────────────┼──────┼──────┼───────────┼─────────┼───┼───┤
│ZP261013LMGGAF │待接单│取快递│菜鸟驿站(3号)│1号楼 203│¥10│详情 取消│
│ZP26101215ZD71 │已完成│取快递│菜鸟驿站(3号)│1号楼 601│¥10│详情    │
└─────────────────────────────────────────────────────────────┘
                                    共 15 条  [< 1 2 3 >]"""
)

p("状态颜色映射（el-tag type）", bold=True)
table(
    ["status", "el-tag type", "说明"],
    [
        ["WAITING_ACCEPT", "warning", "待接单"],
        ["ACCEPTED / PICKING / DELIVERING", "primary", "进行中"],
        ["DELIVERED", "info", "已送达待确认"],
        ["COMPLETED", "success", "已完成"],
        ["CANCELLED", "info", "已取消"],
        ["APPEALING", "danger", "申诉中"],
    ]
)

p("订单详情抽屉（el-drawer）内容", bold=True)
code_block(
"""┌─────────────────────────────────────┐
│  订单详情                      [×]  │
├─────────────────────────────────────┤
│  订单号  ZP261013LMGGAF    [待接单] │
│                                     │
│  ── 配送路线 ──                      │
│  🟢 取  菜鸟驿站(3号楼店)            │
│         取件码: 8-2-3021  ← 明文!   │
│  🔵 送  1号楼 203                    │
│                                     │
│  ── 订单信息 ──                      │
│  类型    取快递 · 中件 · 1件         │
│  报酬    ¥10.00                     │
│  截止    2026-10-13 12:17:00        │
│                                     │
│  ── 参与方 ──                        │
│  发布方  同学 (13800001234)          │
│  跑腿员  —                          │
│                                     │
│  ── 时间线 ──                        │
│  创建    2026-10-13 10:17:29        │
│  接单    —                          │
│  完成    —                          │
│                                     │
│  [ 强制取消 ]  [ 强制完成 ]          │
└─────────────────────────────────────┘"""
)

h("3.6 用户管理 /users", 2)
code_block(
"""┌──────────────────────────────────────────────────────────────┐
│ [🔍 昵称/手机号/学号] 信用分[__]-[__] [是否跑腿员▾] [状态▾] [查询]│
├──────────────────────────────────────────────────────────────┤
│ 昵称    │手机号     │信用分│余额   │标签      │操作           │
├─────────┼───────────┼──────┼───────┼──────────┼───────────────┤
│同学     │13800001234│ 60   │¥0.00  │管理员     │详情           │
│测试用户B│13800005678│ 63   │¥10.00 │跑腿员     │详情           │
│测试用户C│13800009999│ 45   │¥0.00  │信用低     │详情           │
└──────────────────────────────────────────────────────────────┘"""
)

p("信用分颜色规则", bold=True)
table(
    ["分值区间", "颜色"],
    [
        [">= 90", "绿色（优秀）"],
        ["70 ~ 89", "青色（良好）"],
        ["60 ~ 69", "蓝色（正常）"],
        ["< 60", "红色（受限）"],
    ]
)

p("调整信用分弹窗", bold=True)
code_block(
"""┌─────────────────────────────┐
│  调整信用分                  │
│                             │
│  当前信用分: 60              │
│                             │
│  变动值  [ -10 ]  ← 可负可正 │
│  调整后:  50                │
│                             │
│  原因    [虚假发单        ]  │  ← 必填
│                             │
│  常用: 虚假发单-20 超时-5    │
│        态度恶劣-10 作弊-50   │
│                             │
│        [取消]  [确定]        │
└─────────────────────────────┘"""
)

DOC.add_page_break()

h("3.7 跑腿员审核 /runner-applications", 2)
code_block(
"""┌──────────────────────────────────────┐
│  [待审核 2]  [已通过 6]  [已驳回 1]   │  ← el-tabs
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ 张三                    [待审核]│  │
│  │ 学号: 2021001  校区: 东校区    │  │
│  │ 手机: 13800001234              │  │
│  │ 证件照: [图片缩略图]            │  │
│  │ 自我介绍: 空闲时间多            │  │
│  │                                │  │
│  │           [驳回]  [通过]       │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘"""
)
bullet("Tab 切换对应 status 参数（0 / 1 / 2）")
bullet("卡片式布局（不用表格，内容较长）")
bullet("证件照用 el-image 支持点击放大")
bullet("「通过」二次确认；「驳回」弹窗必填原因")

h("3.8 资金管理 /finance", 2)
p("Tab1：提现审核", bold=True)
code_block(
"""┌──────────────────────────────────────────────┐
│ 状态[待审核▾]                                 │
├──────────────────────────────────────────────┤
│ 申请号       │用户  │金额   │当前余额│操作    │
│ WD261013001  │测试B │¥10.00│¥10.00 │通过 驳回│
└──────────────────────────────────────────────┘"""
)
p("Tab2：全部流水（★ 字段为下划线命名）", bold=True)
code_block(
"""┌──────────────────────────────────────────────┐
│ 类型[全部▾] [🔍 订单号/申请号/用户]            │
├──────────────────────────────────────────────┤
│ 时间        │用户  │类型    │金额   │备注     │
│ 10-12 20:09 │测试B │跑腿收入│+¥10.00│跑腿收入 │
└──────────────────────────────────────────────┘"""
)

DOC.add_page_break()

# ============================================================
# 工程结构 + 关键代码
# ============================================================
h("第四部分 · 工程结构与关键代码", 1)

h("4.1 目录结构", 2)
code_block(
"""zhipao-admin/
├── package.json
├── vite.config.ts          （端口 5174，代理 /api → localhost:3000）
├── tsconfig.json
├── index.html
└── src/
    ├── main.ts             入口（注册 Element Plus + 图标 + Pinia + Router）
    ├── App.vue
    ├── router/index.ts     路由 + 登录守卫
    ├── stores/user.ts      Pinia：token / 用户信息
    ├── api/
    │   ├── request.ts      ★ Axios 封装（拆信封 + 401 跳转）
    │   ├── auth.ts
    │   ├── dashboard.ts
    │   ├── order.ts
    │   ├── user.ts
    │   ├── runner.ts
    │   └── finance.ts
    ├── types/index.ts      全部 TypeScript 类型
    ├── layout/AdminLayout.vue
    ├── views/
    │   ├── login/index.vue
    │   ├── dashboard/index.vue
    │   ├── order/index.vue
    │   ├── user/index.vue
    │   ├── runner/index.vue
    │   └── finance/index.vue
    └── utils/
        ├── format.ts       金额 / 时间格式化
        └── constants.ts    状态枚举映射"""
)

h("4.2 vite.config.ts（必须这样配置）", 2)
code_block(
"""import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  server: {
    port: 5174,                    // ★ 不要用 5173
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})"""
)

h("4.3 api/request.ts（必须这样实现）", 2)
code_block(
"""import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

// 请求拦截：自动带 token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('zhipao_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截：★ 拆信封
request.interceptors.response.use(
  (response) => {
    const body = response.data

    if (body.code !== 200) {
      // 401 / 403 → 跳登录
      if (body.code === 401 || body.code === 403) {
        localStorage.removeItem('zhipao_admin_token')
        ElMessage.error(body.msg || '登录已失效')
        router.push('/login')
        return Promise.reject(new Error(body.msg))
      }

      ElMessage.error(body.msg || '请求失败')
      return Promise.reject(new Error(body.msg))
    }

    // ★ 成功时直接返回业务数据
    return body.data
  },
  (error) => {
    ElMessage.error('网络异常，请检查后端是否启动')
    return Promise.reject(error)
  }
)

export default request"""
)

h("4.4 路由守卫", 2)
code_block(
"""router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('zhipao_admin_token')

  if (to.path === '/login') {
    next()
    return
  }

  if (!token) {
    next('/login')
    return
  }

  next()
})"""
)

h("4.5 utils/constants.ts", 2)
code_block(
"""export const ORDER_STATUS_COLOR: Record<string, string> = {
  CREATED: 'info',
  WAITING_ACCEPT: 'warning',
  ACCEPTED: 'primary',
  PICKING: 'primary',
  DELIVERING: 'primary',
  DELIVERED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'info',
  APPEALING: 'danger'
}

export const ORDER_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待接单', value: 'WAITING_ACCEPT' },
  { label: '已接单', value: 'ACCEPTED' },
  { label: '取件中', value: 'PICKING' },
  { label: '配送中', value: 'DELIVERING' },
  { label: '已送达待确认', value: 'DELIVERED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '申诉中', value: 'APPEALING' }
]

export const DELIVERY_TYPE_OPTIONS = [
  { label: '全部', value: undefined },
  { label: '取快递', value: 1 },
  { label: '取外卖', value: 2 }
]"""
)

DOC.add_page_break()

# ============================================================
# 注意事项
# ============================================================
h("第五部分 · 开发注意事项（必读）", 1)

h("5.1 六个容易踩的坑", 2)

table(
    ["#", "坑", "说明"],
    [
        ["1", "HTTP 状态码永远是 200", "必须看 body.code 判断成败，不能用 response.status"],
        ["2", "字段命名不一致", "/admin/transactions 和 /admin/withdrawals 返回下划线字段名"],
        ["3", "401 和 403 都要跳登录", "token 失效和无权限都返回这两个码"],
        ["4", "登录必须校验 isAdmin", "为 false 时拒绝进入后台"],
        ["5", "开发模式验证码不发短信", "提示用户查看服务端日志"],
        ["6", "Vite 端口用 5174", "5173 已被 uni-app 小程序占用"],
    ]
)

h("5.2 开发规范", 2)
bullet("所有代码写完整，不要用「// TODO」或「省略」占位")
bullet("所有页面必须有加载状态（v-loading）和空状态")
bullet("所有操作必须有成功 / 失败提示（ElMessage）")
bullet("危险操作（取消订单、冻结账号、驳回）必须二次确认")
bullet("表格数据必须支持分页")
bullet("时间字段后端已格式化为字符串，直接展示即可")
bullet("金额统一格式化为 ¥XX.XX 两位小数")
bullet("使用 <script setup lang=\"ts\"> 语法")
bullet("类型定义完整，不要用 any")
bullet("样式用 SCSS，组件样式加 scoped")

h("5.3 验收标准", 2)
table(
    ["#", "检查项"],
    [
        ["1", "npm run dev 能在 http://localhost:5174 启动"],
        ["2", "未登录访问任何页面 → 跳转 /login"],
        ["3", "非管理员登录 → 提示「无管理权限」"],
        ["4", "管理员登录 → 进入看板，显示真实数据"],
        ["5", "订单列表能按状态 / 类型 / 关键词筛选，分页正常"],
        ["6", "订单详情能看到取件码明文"],
        ["7", "能强制取消待接单的订单"],
        ["8", "用户列表能筛选，能看到信用分"],
        ["9", "能调整信用分（弹出确认，填原因）"],
        ["10", "能冻结 / 解冻账号"],
        ["11", "跑腿员审核能通过 / 驳回"],
        ["12", "提现列表和流水能查看"],
        ["13", "token 失效时自动跳登录"],
        ["14", "所有操作有成功 / 失败提示"],
    ]
)

DOC.add_page_break()

# ============================================================
# 附录
# ============================================================
h("第六部分 · 附录", 1)

h("6.1 接口速查表（21 个）", 2)
table(
    ["方法", "路径", "说明"],
    [
        ["POST", "/api/auth/sms/send", "发送验证码"],
        ["POST", "/api/auth/sms/login", "手机号登录"],
        ["GET", "/api/auth/me", "当前用户"],
        ["POST", "/api/auth/logout", "登出"],
        ["GET", "/api/admin/dashboard", "数据看板"],
        ["GET", "/api/admin/orders", "订单列表"],
        ["GET", "/api/admin/orders/{id}", "订单详情（不脱敏）"],
        ["POST", "/api/admin/orders/{id}/cancel", "强制取消"],
        ["POST", "/api/admin/orders/{id}/complete", "强制完成"],
        ["GET", "/api/admin/users", "用户列表"],
        ["GET", "/api/admin/users/{id}", "用户详情"],
        ["POST", "/api/admin/users/{id}/credit", "调整信用分"],
        ["POST", "/api/admin/users/{id}/freeze", "冻结账号"],
        ["POST", "/api/admin/users/{id}/unfreeze", "解冻账号"],
        ["POST", "/api/admin/users/{id}/admin", "设置管理员"],
        ["GET", "/api/admin/runner-applications", "跑腿员申请列表"],
        ["POST", "/api/admin/runner-applications/{id}/approve", "审核通过"],
        ["POST", "/api/admin/runner-applications/{id}/reject", "审核驳回"],
        ["GET", "/api/admin/transactions", "全局流水（下划线）"],
        ["GET", "/api/admin/withdrawals", "提现列表（下划线）"],
        ["POST", "/api/admin/withdrawals/{id}/review", "审核提现"],
    ]
)

h("6.2 常见问题 FAQ", 2)

p("Q1：登录后提示「无管理权限」？", bold=True)
code_block(
"""原因：该用户 is_admin = 0

解决（在 MySQL 中执行）：
UPDATE users SET is_admin = 1 WHERE phone = '你的手机号';"""
)

p("Q2：请求全部失败？", bold=True)
bullet("后端是否启动 → 浏览器打开 http://localhost:3000/api/health")
bullet("Vite 代理是否配置 → vite.config.ts 里的 proxy")
bullet("端口是否冲突 → 后台用 5174")

p("Q3：验证码收不到？", bold=True)
code_block(
"""开发模式下验证码不发短信，而是打印在后端控制台：

【开发模式】手机号 13800001234 的验证码为 654321（5 分钟内有效）"""
)

p("Q4：提现审核通过后余额没变？", bold=True)
bullet("通过（pass: true）只标记状态为 SUCCESS，表示已线下转账")
bullet("驳回（pass: false）才会把金额退回用户余额")

h("6.3 后端启动方式", 2)
code_block(
"""1. 双击启动脚本（推荐）
   D:\\msr150174\\项目\\智跑校园\\后端\\智跑校园-Java后端-完整包\\zhipao-server\\start.bat

2. 脚本会自动完成：
   - 检查 MySQL 服务
   - 启动 Redis
   - 编译后端
   - 启动 Spring Boot 并等待就绪

3. 验证
   浏览器打开：http://localhost:3000/api/health
   期望看到：{"status":"UP","mysql":{"connected":true},"redis":{"connected":true}}"""
)

h("6.4 给 Coze 的分步提示（如果一次生成不全）", 2)
table(
    ["步骤", "提示内容"],
    [
        ["第 1 步", "先生成工程骨架 + request.ts + types + 路由 + 布局"],
        ["第 2 步", "生成登录页 + 数据看板"],
        ["第 3 步", "生成订单管理页（含详情抽屉）"],
        ["第 4 步", "生成用户管理页（含信用分弹窗）"],
        ["第 5 步", "生成跑腿员审核 + 资金管理"],
    ]
)

DOC.add_paragraph()
DOC.add_paragraph()

final = DOC.add_paragraph()
final.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = final.add_run("—— 文档结束 ——")
r.font.size = Pt(11)
r.font.color.rgb = RGBColor(0x88, 0x88, 0x88)
set_cjk(r)

# ============================================================
# 保存
# ============================================================
OUT = r"C:\Users\msr150174\Documents\deepseek-harness\default-workspace\智跑校园-后台管理-Coze开发提示词.docx"
DOC.save(OUT)
print(f"已保存: {OUT}")
