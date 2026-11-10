"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const common_vendor = require("./common/vendor.js");
const stores_user = require("./stores/user.js");
if (!Math) {
  "./pages/index/index.js";
  "./pages/login/index.js";
  "./pages/login-phone/index.js";
  "./pages/publish/index.js";
  "./pages/order-list/index.js";
  "./pages/order-detail/index.js";
  "./pages/mine/index.js";
  "./pages/credit/index.js";
  "./pages/credit-rule/index.js";
  "./pages/wallet/index.js";
  "./pages/service/index.js";
  "./pages/evaluate/index.js";
  "./pages/runner-apply/index.js";
  "./pages/account/index.js";
  "./pages/admin/index.js";
  "./pages/privacy/index.js";
  "./pages/agreement/index.js";
  "./pages/about/index.js";
}
const KEY = "privacy_agreed";
const _sfc_main$1 = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "FirstVisitDialog",
  setup(__props) {
    const visible = common_vendor.ref(false);
    common_vendor.onMounted(() => {
      try {
        const agreed = common_vendor.index.getStorageSync(KEY);
        if (!agreed) {
          setTimeout(() => {
            visible.value = true;
          }, 400);
        }
      } catch {
      }
    });
    function agree() {
      try {
        common_vendor.index.setStorageSync(KEY, "1");
      } catch {
      }
      visible.value = false;
    }
    function disagree() {
      visible.value = false;
      common_vendor.index.showModal({
        title: "无法继续使用",
        content: "需要同意隐私政策才能使用本服务",
        showCancel: false,
        success: () => {
          common_vendor.index.exitMiniProgram({});
        }
      });
    }
    function openPrivacy() {
      common_vendor.index.navigateTo({ url: "/pages/privacy/index" });
    }
    function openAgreement() {
      common_vendor.index.navigateTo({ url: "/pages/agreement/index" });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: visible.value
      }, visible.value ? {
        b: common_vendor.o(openPrivacy),
        c: common_vendor.o(openAgreement),
        d: common_vendor.o(agree),
        e: common_vendor.o(disagree)
      } : {});
    };
  }
});
const FirstVisitDialog = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main$1, [["__scopeId", "data-v-a52ecd47"]]);
if (!Math) {
  FirstVisitDialog();
}
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "App",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    common_vendor.onLaunch(() => {
      console.log("[智跑校园] App Launch");
      if (userStore.isLoggedIn) {
        userStore.refreshProfile();
      }
    });
    common_vendor.onShow(() => {
      console.log("[智跑校园] App Show");
    });
    return (_ctx, _cache) => {
      return {};
    };
  }
});
function createApp() {
  const app = common_vendor.createSSRApp(_sfc_main);
  app.use(common_vendor.createPinia());
  return { app };
}
createApp().app.mount("#app");
exports.createApp = createApp;
