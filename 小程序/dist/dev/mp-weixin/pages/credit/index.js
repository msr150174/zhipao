"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
if (!Math) {
  (AppHeader + EmptyState)();
}
const AppHeader = () => "../../components/AppHeader.js";
const EmptyState = () => "../../components/EmptyState.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const records = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const score = common_vendor.computed(() => userStore.creditScore);
    const progress = common_vendor.computed(() => Math.min(100, Math.max(0, score.value)));
    const level = common_vendor.computed(() => {
      const s = score.value;
      if (s >= 90) return { text: "优秀", color: "#22c55e" };
      if (s >= 70) return { text: "良好", color: "#10b981" };
      if (s >= 60) return { text: "正常", color: "#3b82f6" };
      if (s >= 40) return { text: "受限", color: "#f59e0b" };
      return { text: "冻结", color: "#ef4444" };
    });
    common_vendor.onShow(async () => {
      await userStore.refreshProfile();
      try {
        records.value = await services_api.userApi.creditRecords(1, 30);
      } catch {
        records.value = [];
      } finally {
        loading.value = false;
      }
    });
    function goRule() {
      common_vendor.index.navigateTo({ url: "/pages/credit-rule/index" });
    }
    function formatTime(t) {
      return t ? t.replace("T", " ").substring(0, 16) : "";
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "信用分",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.t(score.value),
        c: level.value.color,
        d: common_vendor.t(level.value.text),
        e: progress.value + "%",
        f: level.value.color,
        g: common_vendor.t(score.value >= 60 ? "当前可正常接单" : "信用分低于 60，暂不能接单"),
        h: common_vendor.o(goRule),
        i: !loading.value && !records.value.length
      }, !loading.value && !records.value.length ? {
        j: common_vendor.p({
          emoji: "📊",
          title: "暂无记录",
          desc: "完成订单后会产生信用分记录"
        })
      } : {}, {
        k: common_vendor.f(records.value, (r, k0, i0) => {
          return {
            a: common_vendor.t(r.reason || "信用分变动"),
            b: common_vendor.t(formatTime(r.createTime)),
            c: common_vendor.t(r.change > 0 ? "+" : ""),
            d: common_vendor.t(r.change),
            e: common_vendor.n(r.change > 0 ? "change-up" : "change-down"),
            f: common_vendor.t(r.balance),
            g: r.id
          };
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-26a7f753"]]);
wx.createPage(MiniProgramPage);
