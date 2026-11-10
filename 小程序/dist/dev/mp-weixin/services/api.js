"use strict";
const services_request = require("./request.js");
const authApi = {
  /**
   * 微信登录
   *
   * @param code    微信登录凭证
   * @param devUser 开发模式身份（如 'a' / 'b'），未配微信密钥时用于区分测试账号
   */
  wxLogin(code, devUser) {
    return services_request.request({
      url: "/api/auth/wx-login",
      method: "POST",
      data: devUser ? { code, devUser } : { code },
      silent: true
    });
  },
  /** 发送短信验证码 */
  sendSms(phone) {
    return services_request.request({
      url: "/api/auth/sms/send",
      method: "POST",
      data: { phone },
      silent: true
    });
  },
  /** 手机号 + 验证码登录 */
  smsLogin(phone, code) {
    return services_request.request({
      url: "/api/auth/sms/login",
      method: "POST",
      data: { phone, code },
      silent: true
    });
  },
  /** 当前用户 */
  me() {
    return services_request.request({ url: "/api/auth/me", silent: true });
  },
  /** 登出 */
  logout() {
    return services_request.request({ url: "/api/auth/logout", method: "POST", silent: true });
  }
};
const userApi = {
  /** 个人信息 */
  profile() {
    return services_request.request({ url: "/api/user/profile" });
  },
  /** 改昵称 */
  updateNickname(nickname) {
    return services_request.request({
      url: "/api/user/profile",
      method: "PATCH",
      data: { nickname }
    });
  },
  /** 改头像 */
  updateAvatar(avatarUrl) {
    return services_request.request({
      url: "/api/user/profile",
      method: "PATCH",
      data: { avatarUrl }
    });
  },
  /** 更换手机号（需验证码） */
  changePhone(phone, code) {
    return services_request.request({
      url: "/api/user/change-phone",
      method: "POST",
      data: { phone, code }
    });
  },
  /** 信用分记录 */
  creditRecords(page = 1, pageSize = 20) {
    return services_request.request({
      url: `/api/user/credit-records?page=${page}&pageSize=${pageSize}`
    });
  },
  /** 交易明细 */
  transactions(page = 1, pageSize = 20) {
    return services_request.request({
      url: `/api/user/transactions?page=${page}&pageSize=${pageSize}`
    });
  },
  /** 提现 */
  withdraw(amount, idempotencyKey) {
    return services_request.request({
      url: "/api/user/withdraw",
      method: "POST",
      data: { amount, idempotencyKey }
    });
  },
  /** 注销账号 */
  deactivate() {
    return services_request.request({ url: "/api/user/account", method: "DELETE" });
  }
};
function buildQuery(params) {
  const parts = [];
  for (const key of Object.keys(params)) {
    const v = params[key];
    if (v === void 0 || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.join("&");
}
const orderApi = {
  /** 待接单列表 */
  available(params) {
    const q = buildQuery({
      deliveryType: params.deliveryType,
      keyword: params.keyword,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    });
    return services_request.request({ url: `/api/orders/available?${q}` });
  },
  /** 我的订单 */
  mine(params) {
    const q = buildQuery({
      status: params.status,
      role: params.role,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    });
    return services_request.request({ url: `/api/orders/mine?${q}` });
  },
  /** 订单详情 */
  detail(id) {
    return services_request.request({ url: `/api/orders/${id}` });
  },
  /** 发布订单 */
  publish(input) {
    return services_request.request({
      url: "/api/orders",
      method: "POST",
      data: input
    });
  },
  /** 接单 */
  accept(id) {
    return services_request.request({ url: `/api/orders/${id}/accept`, method: "POST" });
  },
  /** 推进状态：pick / deliver / arrive */
  advance(id, action) {
    return services_request.request({
      url: `/api/orders/${id}/advance`,
      method: "POST",
      data: { action }
    });
  },
  /** 确认收货 */
  complete(id) {
    return services_request.request({ url: `/api/orders/${id}/complete`, method: "POST" });
  },
  /** 取消订单 */
  cancel(id, reason) {
    return services_request.request({
      url: `/api/orders/${id}/cancel`,
      method: "POST",
      data: { reason }
    });
  },
  /** 提交评价 */
  evaluate(id, input) {
    return services_request.request({
      url: `/api/orders/${id}/evaluate`,
      method: "POST",
      data: input
    });
  },
  /** 评价列表 */
  evaluations(id) {
    return services_request.request({
      url: `/api/orders/${id}/evaluations`
    });
  },
  /** 一句话解析 */
  parseDemand(text) {
    return services_request.request({
      url: "/api/orders/parse-demand",
      method: "POST",
      data: { text },
      silent: true
    });
  }
};
const geoApi = {
  /** 驿站/店铺列表 */
  stations(keyword) {
    const q = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
    return services_request.request({ url: `/api/geo/stations${q}`, silent: true });
  },
  /** 楼栋列表 */
  buildings(keyword) {
    const q = keyword ? `?keyword=${encodeURIComponent(keyword)}` : "";
    return services_request.request({ url: `/api/geo/buildings${q}`, silent: true });
  },
  /** 附近驿站 */
  nearbyStations(lng, lat, limit = 10) {
    return services_request.request({
      url: `/api/geo/nearby-stations?lng=${lng}&lat=${lat}&limit=${limit}`,
      silent: true
    });
  }
};
const runnerApi = {
  /** 提交申请 */
  apply(input) {
    return services_request.request({
      url: "/api/runner/apply",
      method: "POST",
      data: input
    });
  },
  /** 查我的申请 */
  myApplication() {
    return services_request.request({
      url: "/api/runner/my-application",
      silent: true
    });
  }
};
const adminApi = {
  /** 申请列表 */
  listApplications(status, page = 1, pageSize = 20) {
    const q = buildQuery({ status, page, pageSize });
    return services_request.request({
      url: `/api/admin/runner-applications?${q}`
    });
  },
  /** 审核通过 */
  approve(id) {
    return services_request.request({
      url: `/api/admin/runner-applications/${id}/approve`,
      method: "POST"
    });
  },
  /** 审核驳回 */
  reject(id, reason) {
    return services_request.request({
      url: `/api/admin/runner-applications/${id}/reject`,
      method: "POST",
      data: { reason }
    });
  }
};
const aiApi = {
  /** 对话 */
  chat(messages) {
    return services_request.request({
      url: "/api/ai/chat",
      method: "POST",
      data: { messages },
      silent: true
    });
  },
  /** 查看可用提供方（调试） */
  providers() {
    return services_request.request({ url: "/api/ai/providers", silent: true });
  }
};
const ocrApi = {
  /** 识别取件码 */
  pickupCode(imageUrl) {
    return services_request.request({
      url: "/api/ocr/pickup-code",
      method: "POST",
      data: { imageUrl },
      silent: true
    });
  }
};
const uploadApi = {
  /** 上传图片 */
  image(filePath, scene = "misc") {
    return services_request.uploadFile(filePath, "/api/upload", { scene });
  }
};
const healthApi = {
  check() {
    return services_request.request({ url: "/api/health", silent: true });
  }
};
exports.adminApi = adminApi;
exports.aiApi = aiApi;
exports.authApi = authApi;
exports.geoApi = geoApi;
exports.healthApi = healthApi;
exports.ocrApi = ocrApi;
exports.orderApi = orderApi;
exports.runnerApi = runnerApi;
exports.uploadApi = uploadApi;
exports.userApi = userApi;
