"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "AppHeader",
  props: {
    title: {},
    showBack: { type: Boolean, default: false },
    bgClass: { default: "grad-brand" }
  },
  setup(__props) {
    const props = __props;
    const nav = common_vendor.computed(() => {
      var _a, _b;
      try {
        const info = common_vendor.index.getSystemInfoSync();
        const statusBarHeight = info.statusBarHeight ?? 20;
        let capsuleRight = 16;
        try {
          const rect = (_b = (_a = common_vendor.index).getMenuButtonBoundingClientRect) == null ? void 0 : _b.call(_a);
          if (rect && rect.width) {
            capsuleRight = (info.windowWidth ?? 375) - rect.left + 8;
          }
        } catch {
        }
        return { statusBarHeight, capsuleRight };
      } catch {
        return { statusBarHeight: 20, capsuleRight: 16 };
      }
    });
    function onBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        common_vendor.index.navigateBack();
      } else {
        common_vendor.index.switchTab({ url: "/pages/index/index" });
      }
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: props.showBack
      }, props.showBack ? {
        b: common_vendor.o(onBack)
      } : {}, {
        c: common_vendor.t(props.title),
        d: nav.value.capsuleRight + 16 + "px",
        e: common_vendor.n(props.bgClass),
        f: nav.value.statusBarHeight + "px"
      });
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-48a13218"]]);
wx.createComponent(Component);
