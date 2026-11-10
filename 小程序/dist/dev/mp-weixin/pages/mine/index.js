"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + NavButton + FabGroup)();
}
const AppHeader = () => "../../components/AppHeader.js";
const NavButton = () => "../../components/NavButton.js";
const FabGroup = () => "../../components/FabGroup.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const isDevMode = common_vendor.ref(true);
    const profile = common_vendor.computed(() => userStore.profile);
    const creditLevel = common_vendor.computed(() => {
      const s = userStore.creditScore;
      if (s >= 90) return { text: "优秀", cls: "excellent" };
      if (s >= 70) return { text: "良好", cls: "good" };
      if (s >= 60) return { text: "正常", cls: "normal" };
      return { text: "受限", cls: "limited" };
    });
    function onSwitchIdentity() {
      const identities = ["default", "a", "b"];
      const labels = ["默认账号", "账号 A（发布方）", "账号 B（跑腿员）"];
      common_vendor.index.showActionSheet({
        itemList: labels,
        success: async (res) => {
          const target = identities[res.tapIndex];
          if (target === userStore.devIdentity) {
            common_vendor.index.showToast({ title: "已是该身份", icon: "none" });
            return;
          }
          common_vendor.index.showLoading({ title: "切换中…", mask: true });
          const ok = await userStore.switchIdentity(target);
          common_vendor.index.hideLoading();
          if (ok) {
            common_vendor.index.showToast({ title: "已切换为" + labels[res.tapIndex], icon: "none", duration: 2e3 });
            await userStore.refreshProfile();
          } else {
            common_vendor.index.showToast({ title: "切换失败", icon: "none" });
          }
        }
      });
    }
    common_vendor.onShow(() => {
      if (userStore.isLoggedIn) userStore.refreshProfile();
    });
    common_vendor.onPullDownRefresh(async () => {
      try {
        await userStore.refreshProfile();
        utils_haptics.refreshFeedback();
      } finally {
        common_vendor.index.stopPullDownRefresh();
      }
    });
    function go(url) {
      common_vendor.index.navigateTo({ url });
    }
    function goLogin() {
      common_vendor.index.navigateTo({ url: "/pages/login/index" });
    }
    async function onLogout() {
      common_vendor.index.showModal({
        title: "退出登录",
        content: "确定要退出当前账号吗？",
        success: async (res) => {
          if (res.confirm) {
            await userStore.logout();
            common_vendor.index.showToast({ title: "已退出", icon: "none" });
          }
        }
      });
    }
    return (_ctx, _cache) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i;
      return common_vendor.e({
        a: common_vendor.p({
          title: "我的",
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.unref(userStore).isLoggedIn
      }, common_vendor.unref(userStore).isLoggedIn ? common_vendor.e({
        c: common_vendor.t(((_a = profile.value) == null ? void 0 : _a.nickname) || "同学"),
        d: common_vendor.t(((_b = profile.value) == null ? void 0 : _b.phone) || "未绑定手机号"),
        e: (_c = profile.value) == null ? void 0 : _c.isRunner
      }, ((_d = profile.value) == null ? void 0 : _d.isRunner) ? {} : {}, {
        f: (_e = profile.value) == null ? void 0 : _e.realNameVerified
      }, ((_f = profile.value) == null ? void 0 : _f.realNameVerified) ? {} : {}, {
        g: isDevMode.value
      }, isDevMode.value ? {
        h: common_vendor.t(common_vendor.unref(userStore).devIdentity)
      } : {}, {
        i: isDevMode.value
      }, isDevMode.value ? {
        j: common_vendor.o(onSwitchIdentity)
      } : {}, {
        k: common_vendor.t(((_g = profile.value) == null ? void 0 : _g.creditScore) ?? 0),
        l: common_vendor.n("text-" + creditLevel.value.cls),
        m: common_vendor.t(creditLevel.value.text),
        n: common_vendor.o(($event) => go("/pages/credit/index")),
        o: common_vendor.t(Number(((_h = profile.value) == null ? void 0 : _h.balance) ?? 0).toFixed(2)),
        p: common_vendor.o(($event) => go("/pages/wallet/index"))
      }) : {
        q: common_vendor.o(goLogin)
      }, {
        r: common_vendor.o(($event) => _ctx.uni.switchTab({
          url: "/pages/order-list/index"
        })),
        s: common_vendor.p({
          icon: "📋",
          label: "我的订单"
        }),
        t: common_vendor.o(($event) => go("/pages/wallet/index")),
        v: common_vendor.p({
          icon: "💰",
          label: "钱包"
        }),
        w: common_vendor.o(($event) => go("/pages/credit/index")),
        x: common_vendor.p({
          icon: "⭐",
          label: "信用分"
        }),
        y: common_vendor.o(($event) => go("/pages/runner-apply/index")),
        z: common_vendor.p({
          icon: "🏃",
          label: "成为跑腿员",
          value: ((_i = profile.value) == null ? void 0 : _i.isRunner) ? "已认证" : "去申请"
        }),
        A: common_vendor.o(($event) => go("/pages/service/index")),
        B: common_vendor.p({
          icon: "💬",
          label: "联系客服"
        }),
        C: common_vendor.unref(userStore).isAdmin
      }, common_vendor.unref(userStore).isAdmin ? {
        D: common_vendor.o(($event) => go("/pages/admin/index")),
        E: common_vendor.p({
          icon: "🛡️",
          label: "入驻审核"
        })
      } : {}, {
        F: common_vendor.o(($event) => go("/pages/account/index")),
        G: common_vendor.p({
          icon: "⚙️",
          label: "账户设置"
        }),
        H: common_vendor.o(($event) => go("/pages/about/index")),
        I: common_vendor.p({
          icon: "ℹ️",
          label: "关于我们"
        }),
        J: common_vendor.unref(userStore).isLoggedIn
      }, common_vendor.unref(userStore).isLoggedIn ? {
        K: common_vendor.o(onLogout)
      } : {}, {
        L: common_vendor.p({
          ["show-publish"]: true,
          ["show-assistant"]: true
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-9023ef44"]]);
wx.createPage(MiniProgramPage);
