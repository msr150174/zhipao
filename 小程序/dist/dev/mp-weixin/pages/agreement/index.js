"use strict";
const common_vendor = require("../../common/vendor.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    return (_ctx, _cache) => {
      return {
        a: common_vendor.p({
          title: "用户协议",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        })
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-a362bb52"]]);
wx.createPage(MiniProgramPage);
