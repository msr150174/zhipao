"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const loading = common_vendor.ref(false);
    async function onWxLogin() {
      if (loading.value) return;
      loading.value = true;
      const ok = await userStore.wxLogin();
      loading.value = false;
      if (ok) {
        utils_haptics.hapticSuccess();
        common_vendor.index.showToast({ title: "登录成功", icon: "success" });
        setTimeout(() => backOrHome(), 900);
      } else {
        common_vendor.index.showToast({ title: "登录失败，请重试", icon: "none" });
      }
    }
    function goPhone() {
      common_vendor.index.navigateTo({ url: "/pages/login-phone/index" });
    }
    function backOrHome() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        common_vendor.index.navigateBack();
      } else {
        common_vendor.index.switchTab({ url: "/pages/index/index" });
      }
    }
    function goPrivacy() {
      common_vendor.index.navigateTo({ url: "/pages/privacy/index" });
    }
    return (_ctx, _cache) => {
      return {
        a: common_vendor.p({
          title: "",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.t(loading.value ? "登录中…" : "微信一键登录"),
        c: loading.value,
        d: common_vendor.o(onWxLogin),
        e: common_vendor.o(goPhone),
        f: common_vendor.o(goPrivacy)
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-45258083"]]);
wx.createPage(MiniProgramPage);
