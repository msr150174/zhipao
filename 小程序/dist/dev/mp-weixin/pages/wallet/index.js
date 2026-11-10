"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
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
    const showWithdraw = common_vendor.ref(false);
    const amount = common_vendor.ref("");
    const balance = common_vendor.computed(() => {
      var _a;
      return Number(((_a = userStore.profile) == null ? void 0 : _a.balance) ?? 0);
    });
    const income = common_vendor.computed(() => {
      var _a;
      return Number(((_a = userStore.profile) == null ? void 0 : _a.income) ?? 0);
    });
    common_vendor.onShow(async () => {
      await userStore.refreshProfile();
      try {
        records.value = await services_api.userApi.transactions(1, 30);
      } catch {
        records.value = [];
      } finally {
        loading.value = false;
      }
    });
    function openWithdraw() {
      if (balance.value <= 0) {
        common_vendor.index.showToast({ title: "暂无可提现余额", icon: "none" });
        return;
      }
      amount.value = "";
      showWithdraw.value = true;
    }
    function setAll() {
      amount.value = String(balance.value);
    }
    async function submitWithdraw() {
      const v = Number(amount.value);
      if (!v || v <= 0) {
        common_vendor.index.showToast({ title: "请输入正确的金额", icon: "none" });
        return;
      }
      if (v > balance.value) {
        common_vendor.index.showToast({ title: "超过可提现余额", icon: "none" });
        return;
      }
      common_vendor.index.showLoading({ title: "提交中…", mask: true });
      try {
        const res = await services_api.userApi.withdraw(v);
        common_vendor.index.hideLoading();
        showWithdraw.value = false;
        utils_haptics.hapticSuccess();
        common_vendor.index.showModal({
          title: "申请已提交",
          content: res.message || "平台将统一处理提现申请",
          showCancel: false
        });
        await userStore.refreshProfile();
        records.value = await services_api.userApi.transactions(1, 30);
      } catch {
        common_vendor.index.hideLoading();
      }
    }
    function formatTime(t) {
      return t ? t.replace("T", " ").substring(0, 16) : "";
    }
    function amountClass(type) {
      return type === "INCOME" || type === "REFUND" ? "change-up" : "change-down";
    }
    function amountPrefix(type) {
      return type === "INCOME" || type === "REFUND" ? "+" : "-";
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "钱包",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.t(balance.value.toFixed(2)),
        c: common_vendor.t(income.value.toFixed(2)),
        d: common_vendor.o(openWithdraw),
        e: !loading.value && !records.value.length
      }, !loading.value && !records.value.length ? {
        f: common_vendor.p({
          emoji: "💸",
          title: "暂无交易记录",
          desc: "完成订单后会显示在这里"
        })
      } : {}, {
        g: common_vendor.f(records.value, (r, k0, i0) => {
          return {
            a: common_vendor.t(r.typeText || r.type),
            b: common_vendor.t(formatTime(r.createTime)),
            c: common_vendor.t(amountPrefix(r.type)),
            d: common_vendor.t(Number(r.amount).toFixed(2)),
            e: common_vendor.n(amountClass(r.type)),
            f: common_vendor.t(Number(r.balance).toFixed(2)),
            g: r.id
          };
        }),
        h: showWithdraw.value
      }, showWithdraw.value ? {
        i: common_vendor.t(balance.value.toFixed(2)),
        j: amount.value,
        k: common_vendor.o(($event) => amount.value = $event.detail.value),
        l: common_vendor.o(setAll),
        m: common_vendor.o(($event) => showWithdraw.value = false),
        n: common_vendor.o(submitWithdraw),
        o: common_vendor.o(() => {
        }),
        p: common_vendor.o(($event) => showWithdraw.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-9914b066"]]);
wx.createPage(MiniProgramPage);
