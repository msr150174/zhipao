"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "SuccessOverlay",
  props: {
    visible: { type: Boolean },
    title: { default: "操作成功" },
    amount: {}
  },
  setup(__props) {
    const props = __props;
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: props.visible
      }, props.visible ? common_vendor.e({
        b: common_vendor.t(props.title),
        c: props.amount !== void 0
      }, props.amount !== void 0 ? {
        d: common_vendor.t(props.amount.toFixed(2))
      } : {}) : {});
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-8ee1442d"]]);
wx.createComponent(Component);
