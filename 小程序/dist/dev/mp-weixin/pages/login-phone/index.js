"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const phone = common_vendor.ref("");
    const code = common_vendor.ref("");
    const sending = common_vendor.ref(false);
    const countdown = common_vendor.ref(0);
    const submitting = common_vendor.ref(false);
    let timer = null;
    const phoneValid = common_vendor.computed(() => /^1[3-9]\d{9}$/.test(phone.value));
    const canSubmit = common_vendor.computed(() => phoneValid.value && code.value.length === 6);
    async function sendCode() {
      if (!phoneValid.value) {
        common_vendor.index.showToast({ title: "请输入正确的手机号", icon: "none" });
        return;
      }
      if (countdown.value > 0 || sending.value) return;
      sending.value = true;
      try {
        const res = await services_api.authApi.sendSms(phone.value);
        common_vendor.index.showToast({
          title: res.devMode ? "开发模式：验证码见服务端日志" : "验证码已发送",
          icon: "none",
          duration: 2500
        });
        countdown.value = 60;
        timer = setInterval(() => {
          countdown.value--;
          if (countdown.value <= 0 && timer) {
            clearInterval(timer);
            timer = null;
          }
        }, 1e3);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "发送失败";
        common_vendor.index.showToast({ title: msg, icon: "none" });
      } finally {
        sending.value = false;
      }
    }
    async function submit() {
      if (!canSubmit.value || submitting.value) return;
      submitting.value = true;
      const ok = await userStore.smsLogin(phone.value, code.value);
      submitting.value = false;
      if (ok) {
        utils_haptics.hapticSuccess();
        common_vendor.index.showToast({ title: "登录成功", icon: "success" });
        setTimeout(() => {
          const pages = getCurrentPages();
          if (pages.length > 1) {
            common_vendor.index.navigateBack();
          } else {
            common_vendor.index.switchTab({ url: "/pages/index/index" });
          }
        }, 900);
      } else {
        common_vendor.index.showToast({ title: "验证码错误或已过期", icon: "none" });
      }
    }
    common_vendor.onUnmounted(() => {
      if (timer) clearInterval(timer);
    });
    return (_ctx, _cache) => {
      return {
        a: common_vendor.p({
          title: "手机号登录",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: phone.value,
        c: common_vendor.o(($event) => phone.value = $event.detail.value),
        d: code.value,
        e: common_vendor.o(($event) => code.value = $event.detail.value),
        f: common_vendor.t(countdown.value > 0 ? countdown.value + "s" : "获取验证码"),
        g: countdown.value > 0 || !phoneValid.value ? 1 : "",
        h: common_vendor.o(sendCode),
        i: common_vendor.t(submitting.value ? "登录中…" : "登录"),
        j: !canSubmit.value || submitting.value ? 1 : "",
        k: !canSubmit.value || submitting.value,
        l: common_vendor.o(submit)
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-ff4abf57"]]);
wx.createPage(MiniProgramPage);
