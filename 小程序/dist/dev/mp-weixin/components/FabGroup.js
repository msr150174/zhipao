"use strict";
const common_vendor = require("../common/vendor.js");
const utils_haptics = require("../utils/haptics.js");
if (!Math) {
  FloatingAssistant();
}
const FloatingAssistant = () => "./FloatingAssistant.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "FabGroup",
  props: {
    showPublish: { type: Boolean, default: true },
    showAssistant: { type: Boolean, default: true }
  },
  emits: ["publish"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const FAB_POS = {
      right: 20,
      publish: 110,
      assistant: 170
    };
    function onPublish() {
      utils_haptics.haptic("light");
      emit("publish");
      common_vendor.index.navigateTo({ url: "/pages/publish/index" });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: props.showPublish
      }, props.showPublish ? {
        b: FAB_POS.right + "px",
        c: FAB_POS.publish + "px",
        d: common_vendor.o(onPublish)
      } : {}, {
        e: props.showAssistant
      }, props.showAssistant ? {
        f: common_vendor.p({
          bottom: FAB_POS.assistant
        })
      } : {});
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-8b2f17db"]]);
wx.createComponent(Component);
