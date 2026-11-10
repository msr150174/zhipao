"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "EmptyState",
  props: {
    emoji: { default: "📭" },
    title: {},
    desc: {},
    actionText: {}
  },
  emits: ["action"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.t(props.emoji),
        b: common_vendor.t(props.title),
        c: props.desc
      }, props.desc ? {
        d: common_vendor.t(props.desc)
      } : {}, {
        e: props.actionText
      }, props.actionText ? {
        f: common_vendor.t(props.actionText),
        g: common_vendor.o(($event) => emit("action"))
      } : {});
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-f262d0f3"]]);
wx.createComponent(Component);
