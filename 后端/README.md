# 智跑校园服务端

> **技术栈**：Java 17 + Spring Boot 3.2.5 + MyBatis-Plus + MySQL 8 + Redis 7 + 双 AI
> **来源**：从 Taro + NestJS 工程转换而来
> **路由**：39 个 · **Java 文件**：64 个 · **代码行数**：5,562

---

## 快速开始（5 步）

### 1. 建数据库

```sql
CREATE DATABASE xyzp DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
```

### 2. 执行脚本（**注意顺序**）

```bash
cd db
mysql -u root -p xyzp < V1__init_schema.sql        # 10 张表
mysql -u root -p xyzp < V2__atomic_procedures.sql  # 6 个存储过程
```

**验证**：
```sql
USE xyzp;
SHOW TABLES;              -- 期望 10 张
SHOW PROCEDURE STATUS;    -- 期望 6 个
SELECT COUNT(*) FROM station;   -- 期望 7
SELECT COUNT(*) FROM building;  -- 期望 8
```

### 3. 启动 Redis

```bash
redis-server          # 或 docker run -d -p 6379:6379 redis:7-alpine
redis-cli ping        # 期望 PONG
```

### 4. 配置连接

**改 `src/main/resources/application.yml`**，或设环境变量：

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=xyzp
MYSQL_USER=root
MYSQL_PASSWORD=你的密码

REDIS_HOST=localhost
REDIS_PORT=6379
```

### 5. 启动

```bash
mvn spring-boot:run
```

**成功标志**：
```
Tomcat started on port(s): 3000 (http) with context path '/api'
```

---

## ★ 密钥可以全部留空

**未配置任何密钥时，服务照常启动**，各功能走降级：

| 配置 | 留空后的行为 |
|---|---|
| `WX_APP_ID` / `WX_APP_SECRET` | 微信登录用 `dev_openid_xxx`（code 派生，稳定可复现） |
| `TENCENT_SECRET_ID` 等 | 短信走**开发模式**（验证码打印到日志） |
| `OLLAMA_BASE_URL` | 跳过本地 AI |
| `COZE_API_TOKEN` | 跳过云 AI → 用规则库 |
| `TENCENT_MAP_KEY` | 跳过地理编码（距离显示「测量中」） |
| `TOS_*` | 上传返回占位 URL |
| `JWT_SECRET` | 用开发默认值（**生产必须配置 ≥32 位**） |

**→ 可以先跑起来，密钥后面慢慢补。**

---

## 验证连通性

```bash
curl http://localhost:3000/api/health
```

**期望返回**：

```json
{
  "code": 200,
  "data": {
    "status": "UP",
    "mysql": { "connected": true, "database": "xyzp", "tables": 10,
               "stations": 7, "buildings": 8, "users": 0 },
    "procedures": 6,
    "redis": { "connected": true },
    "ai": "local"
  }
}
```

**这几个数字对上了，就说明「后端 ↔ 数据库 ↔ Redis」全通了。**

---

## 路由总览（39 个）

### 鉴权（5）
```
POST   /api/auth/wx-login          微信登录
POST   /api/auth/sms/send          发送验证码
POST   /api/auth/sms/login         手机号登录
GET    /api/auth/me                当前用户
POST   /api/auth/logout            登出
```

### 用户（7）
```
GET    /api/user/profile           个人信息
PATCH  /api/user/profile           改昵称/头像
POST   /api/user/change-phone      更换手机号
GET    /api/user/credit-records    信用分记录
GET    /api/user/transactions      交易明细
POST   /api/user/withdraw          提现
DELETE /api/user/account           注销账号
```

### 订单（11）
```
GET    /api/orders/available          待接单列表
GET    /api/orders/mine               我的订单
GET    /api/orders/{id}               订单详情
POST   /api/orders                    发布订单
POST   /api/orders/{id}/accept        接单
POST   /api/orders/{id}/advance       推进状态
POST   /api/orders/{id}/complete      确认收货
POST   /api/orders/{id}/cancel        取消订单
POST   /api/orders/{id}/evaluate      提交评价
GET    /api/orders/{id}/evaluations   评价列表
POST   /api/orders/parse-demand       一句话解析
```

### 地理（3）
```
GET    /api/geo/stations              驿站/店铺列表
GET    /api/geo/buildings             楼栋列表
GET    /api/geo/nearby-stations       附近驿站
```

### 跑腿员（2）
```
POST   /api/runner/apply              提交入驻申请
GET    /api/runner/my-application     查我的申请
```

### 管理员（3）
```
GET    /api/admin/runner-applications              申请列表
POST   /api/admin/runner-applications/{id}/approve 通过
POST   /api/admin/runner-applications/{id}/reject  驳回
```

### AI（2）
```
POST   /api/ai/chat                   对话
GET    /api/ai/providers              查看可用提供方
```

### 其他（6）
```
POST   /api/ocr/pickup-code           取件码识别
POST   /api/upload                    文件上传
POST   /api/subscribe/request         上报订阅授权
GET    /api/health                    健康检查
GET    /api/health/ping               存活探针
GET    /api/hello                     服务信息
```

---

## 双 AI 架构

```
                  ┌─ 【安全词】→ 直接转人工（不走 AI）
用户提问 → 路由   ├─ 【查订单】→ 本地查库（走脱敏视图，不交给 AI）
                  └─ 【其他】 → ① Ollama（本地优先，快、免费、数据不出内网）
                                ② Coze（云兜底）
                                ③ 规则库（保底，永远可用）
```

**配置**：

```yaml
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

COZE_API_TOKEN=pat_xxx
COZE_BOT_ID=7xxxxxxxx
```

**三条安全红线**：
1. 安全词（退款/封号/被骗）**不走 AI**，直接转人工
2. 查订单**走 `toOrderView` 脱敏视图**
3. AI 系统提示词**明确禁止**泄露取件码/手机号

---

## 目录结构

```
src/main/java/com/zhipao/
├── ZhipaoApplication.java
├── common/              通用层
│   ├── ApiResponse.java             统一响应 { code, msg, data }
│   ├── OrderStatus.java             九态枚举
│   ├── BizException.java            业务异常 + 存储过程错误码映射
│   ├── GlobalExceptionHandler.java  全局异常处理
│   ├── MaskUtil.java                脱敏
│   └── OrderNoGenerator.java        订单号生成
├── config/              配置
│   ├── WebConfig.java               拦截器注册
│   ├── RedisConfig.java             Redis 序列化
│   └── AsyncConfig.java             异步线程池
├── interceptor/
│   ├── AuthInterceptor.java         JWT 鉴权
│   └── AdminInterceptor.java        管理员校验
├── entity/              实体（10 张表）
├── mapper/              Mapper（含 6 个存储过程调用）
├── dto/
│   ├── request/
│   └── response/
├── service/             业务服务（10 个）
│   └── ai/              双 AI（5 个类）
├── controller/          接口层（12 个）
└── task/                定时任务
```

---

## 技术改进（相对原 NestJS 版）

| # | 项 | NestJS 版 | Java 版 |
|---|---|---|---|
| 1 | **短信验证码** | 内存 Map（多实例失效） | **Redis**（多实例共享） |
| 2 | **JWT** | 手写 base64url | **jjwt 库** + jti 黑名单 |
| 3 | **坐标回填** | 只回写距离 | **同时回写坐标**（修"取件没地图"） |
| 4 | **存储过程错误** | 英文错误码直出 | **20 个码 → 中文映射** |
| 5 | **AI** | 纯正则 | **双 AI**（Ollama + Coze + 规则） |
| 6 | **管理员校验** | Guard | **拦截器**（后端强制） |

---

## 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `Access denied` | MySQL 密码错 | 检查 `MYSQL_PASSWORD` |
| `Unknown database 'xyzp'` | 库不存在 | 先 `CREATE DATABASE` |
| `Unable to connect to Redis` | Redis 没启动 | `redis-server` |
| `/api/health` 里 `tables < 10` | V1 没跑全 | 重跑 V1 |
| `/api/health` 里 `procedures < 6` | V2 没跑全 | 重跑 V2 |
| `stations = 0` | 种子数据没插 | 手动跑 V1 末尾的 INSERT |
| `Port 3000 was already in use` | 端口占用 | 设 `SERVER_PORT=3001` |
| 存储过程权限不足 | 缺 CREATE ROUTINE | `GRANT CREATE ROUTINE ON xyzp.* TO 'user'@'%';` |

---

## 待接入（不影响启动）

| 项 | 需要 | 留空后 |
|---|---|---|
| **微信登录** | AppID + Secret | 用 dev_openid |
| **短信** | 腾讯云密钥 + 签名 + 模板 | 验证码进日志 |
| **OCR** | 腾讯云密钥（**地域必须国内**） | 返回空，走手输 |
| **对象存储** | TOS/COS 密钥 | 返回占位 URL |
| **订阅消息** | 4 个模板 ID | 跳过推送 |
| **本地 AI** | Ollama 地址 + 模型 | 跳过 |
| **云 AI** | Coze Token + Bot ID | 跳过 |
| **地图** | 腾讯位置服务 Key | 跳过地理编码 |
| **微信支付** | 商户号 + 证书 | 未实现（待决策分账方案）|
