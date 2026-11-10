"use strict";
const common_vendor = require("../../common/vendor.js");
const services_api = require("../../services/api.js");
if (!Math) {
  (AppHeader + NavButton)();
}
const AppHeader = () => "../../components/AppHeader.js";
const NavButton = () => "../../components/NavButton.js";
const version = "1.0.0";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const checking = common_vendor.ref(false);
    const healthText = common_vendor.ref("");
    async function checkHealth() {
      if (checking.value) return;
      checking.value = true;
      healthText.value = "";
      try {
        const res = await services_api.healthApi.check();
        const mysql = res.mysql;
        const redis = res.redis;
        healthText.value = `状态：${res.status}
数据库：${(mysql == null ? void 0 : mysql.connected) ? "已连接" : "未连接"}（表 ${(mysql == null ? void 0 : mysql.tables) ?? 0}）
缓存：${(redis == null ? void 0 : redis.connected) ? "已连接" : "未连接"}
AI：${res.ai || "未知"}`;
      } catch {
        healthText.value = "无法连接服务器，请检查后端是否启动";
      } finally {
        checking.value = false;
      }
    }
    function go(url) {
      common_vendor.index.navigateTo({ url });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "关于我们",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.t(version),
        c: common_vendor.o(($event) => go("/pages/agreement/index")),
        d: common_vendor.p({
          icon: "📄",
          label: "用户协议"
        }),
        e: common_vendor.o(($event) => go("/pages/privacy/index")),
        f: common_vendor.p({
          icon: "🔒",
          label: "隐私政策"
        }),
        g: common_vendor.o(($event) => go("/pages/credit-rule/index")),
        h: common_vendor.p({
          icon: "⭐",
          label: "信用分规则"
        }),
        i: common_vendor.o(($event) => go("/pages/service/index")),
        j: common_vendor.p({
          icon: "💬",
          label: "在线客服"
        }),
        k: common_vendor.o(checkHealth),
        l: common_vendor.p({
          icon: "🩺",
          label: "检查服务状态",
          value: checking.value ? "检查中…" : ""
        }),
        m: healthText.value
      }, healthText.value ? {
        n: common_vendor.t(healthText.value)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-6b4e7e2d"]]);
wx.createPage(MiniProgramPage);
