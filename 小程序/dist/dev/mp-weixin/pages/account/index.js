"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
if (!Math) {
  (AppHeader + NavButton)();
}
const AppHeader = () => "../../components/AppHeader.js";
const NavButton = () => "../../components/NavButton.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const showNickname = common_vendor.ref(false);
    const showPhone = common_vendor.ref(false);
    const nickname = common_vendor.ref("");
    const newPhone = common_vendor.ref("");
    const code = common_vendor.ref("");
    const countdown = common_vendor.ref(0);
    const sending = common_vendor.ref(false);
    let timer = null;
    const profile = common_vendor.computed(() => userStore.profile);
    common_vendor.onMounted(() => {
      if (userStore.isLoggedIn) userStore.refreshProfile();
    });
    function openNickname() {
      var _a;
      nickname.value = ((_a = profile.value) == null ? void 0 : _a.nickname) || "";
      showNickname.value = true;
    }
    async function saveNickname() {
      const v = nickname.value.trim();
      if (!v) {
        common_vendor.index.showToast({ title: "昵称不能为空", icon: "none" });
        return;
      }
      try {
        await services_api.userApi.updateNickname(v);
        await userStore.refreshProfile();
        showNickname.value = false;
        common_vendor.index.showToast({ title: "已保存", icon: "success" });
      } catch {
      }
    }
    function changeAvatar() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          const path = res.tempFilePaths[0];
          if (!path) return;
          common_vendor.index.showLoading({ title: "上传中…", mask: true });
          try {
            const up = await services_api.uploadApi.image(path, "avatar");
            await services_api.userApi.updateAvatar(up.url);
            await userStore.refreshProfile();
            common_vendor.index.showToast({ title: "已更新", icon: "success" });
          } catch {
          } finally {
            common_vendor.index.hideLoading();
          }
        }
      });
    }
    function openPhone() {
      newPhone.value = "";
      code.value = "";
      showPhone.value = true;
    }
    async function sendCode() {
      if (!/^1[3-9]\d{9}$/.test(newPhone.value)) {
        common_vendor.index.showToast({ title: "请输入正确的手机号", icon: "none" });
        return;
      }
      if (countdown.value > 0 || sending.value) return;
      sending.value = true;
      try {
        const res = await services_api.authApi.sendSms(newPhone.value);
        common_vendor.index.showToast({
          title: res.devMode ? "开发模式：看服务端日志" : "验证码已发送",
          icon: "none"
        });
        countdown.value = 60;
        timer = setInterval(() => {
          countdown.value--;
          if (countdown.value <= 0 && timer) {
            clearInterval(timer);
            timer = null;
          }
        }, 1e3);
      } catch {
      } finally {
        sending.value = false;
      }
    }
    async function savePhone() {
      if (code.value.length !== 6) {
        common_vendor.index.showToast({ title: "请输入 6 位验证码", icon: "none" });
        return;
      }
      try {
        await services_api.userApi.changePhone(newPhone.value, code.value);
        await userStore.refreshProfile();
        showPhone.value = false;
        common_vendor.index.showToast({ title: "已更换", icon: "success" });
      } catch {
      }
    }
    function onDeactivate() {
      common_vendor.index.showModal({
        title: "注销账号",
        content: "注销后账号将无法登录，订单与资金记录会保留留档。确定继续吗？",
        confirmColor: "#ef4444",
        success: async (res) => {
          if (!res.confirm) return;
          const ok = await userStore.deactivate();
          if (ok) {
            common_vendor.index.showToast({ title: "已注销", icon: "none" });
            setTimeout(() => common_vendor.index.switchTab({ url: "/pages/index/index" }), 1e3);
          }
        }
      });
    }
    function go(url) {
      common_vendor.index.navigateTo({ url });
    }
    return (_ctx, _cache) => {
      var _a, _b, _c;
      return common_vendor.e({
        a: common_vendor.p({
          title: "账户设置",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.o(openNickname),
        c: common_vendor.p({
          icon: "👤",
          label: "修改昵称",
          value: (_a = profile.value) == null ? void 0 : _a.nickname
        }),
        d: common_vendor.o(changeAvatar),
        e: common_vendor.p({
          icon: "🖼️",
          label: "更换头像"
        }),
        f: common_vendor.o(openPhone),
        g: common_vendor.p({
          icon: "📱",
          label: "绑定手机号",
          value: ((_b = profile.value) == null ? void 0 : _b.phone) || "未绑定"
        }),
        h: common_vendor.o(($event) => go("/pages/credit/index")),
        i: common_vendor.p({
          icon: "⭐",
          label: "信用分",
          value: String(((_c = profile.value) == null ? void 0 : _c.creditScore) ?? 0)
        }),
        j: common_vendor.o(($event) => go("/pages/credit-rule/index")),
        k: common_vendor.p({
          icon: "📜",
          label: "信用分规则"
        }),
        l: common_vendor.o(($event) => go("/pages/privacy/index")),
        m: common_vendor.p({
          icon: "🔒",
          label: "隐私政策"
        }),
        n: common_vendor.o(($event) => go("/pages/agreement/index")),
        o: common_vendor.p({
          icon: "📄",
          label: "用户协议"
        }),
        p: common_vendor.o(onDeactivate),
        q: showNickname.value
      }, showNickname.value ? {
        r: nickname.value,
        s: common_vendor.o(($event) => nickname.value = $event.detail.value),
        t: common_vendor.o(($event) => showNickname.value = false),
        v: common_vendor.o(saveNickname),
        w: common_vendor.o(() => {
        }),
        x: common_vendor.o(($event) => showNickname.value = false)
      } : {}, {
        y: showPhone.value
      }, showPhone.value ? {
        z: newPhone.value,
        A: common_vendor.o(($event) => newPhone.value = $event.detail.value),
        B: code.value,
        C: common_vendor.o(($event) => code.value = $event.detail.value),
        D: common_vendor.t(countdown.value > 0 ? countdown.value + "s" : "获取验证码"),
        E: countdown.value > 0 ? 1 : "",
        F: common_vendor.o(sendCode),
        G: common_vendor.o(($event) => showPhone.value = false),
        H: common_vendor.o(savePhone),
        I: common_vendor.o(() => {
        }),
        J: common_vendor.o(($event) => showPhone.value = false)
      } : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-56e6cf70"]]);
wx.createPage(MiniProgramPage);
