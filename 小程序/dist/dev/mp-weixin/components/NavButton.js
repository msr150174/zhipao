"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "NavButton",
  props: {
    icon: {},
    label: {},
    value: {},
    showArrow: { type: Boolean, default: true }
  },
  emits: ["click"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: props.icon
      }, props.icon ? {
        b: common_vendor.t(props.icon)
      } : {}, {
        c: common_vendor.t(props.label),
        d: props.value
      }, props.value ? {
        e: common_vendor.t(props.value)
      } : {}, {
        f: props.showArrow
      }, props.showArrow ? {} : {}, {
        g: common_vendor.o(($event) => emit("click"))
      });
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-7e01b22f"]]);
wx.createComponent(Component);
