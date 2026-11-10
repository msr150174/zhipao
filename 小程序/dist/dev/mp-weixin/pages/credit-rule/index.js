"use strict";
const common_vendor = require("../../common/vendor.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const gains = [
      { t: "实名认证", v: "+20", once: true },
      { t: "完成一单（跑腿方）", v: "+2" },
      { t: "收到好评（5 星）", v: "+1" },
      { t: "连续 7 天无违规", v: "+3" }
    ];
    const losses = [
      { t: "超时未送达", v: "-5" },
      { t: "接单后取消", v: "-10" },
      { t: "虚假发单", v: "-20" },
      { t: "被有效申诉", v: "-15" },
      { t: "收到差评（1-2 星）", v: "-1 ~ -3" }
    ];
    const thresholds = [
      { t: "可发单", v: "≥ 50 分", cls: "ok" },
      { t: "可接单", v: "≥ 60 分", cls: "ok" },
      { t: "冻结 7 天", v: "< 40 分", cls: "bad" }
    ];
    return (_ctx, _cache) => {
      return {
        a: common_vendor.p({
          title: "信用分规则",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.f(gains, (g, k0, i0) => {
          return {
            a: common_vendor.t(g.t),
            b: common_vendor.t(g.v),
            c: g.t
          };
        }),
        c: common_vendor.f(losses, (l, k0, i0) => {
          return {
            a: common_vendor.t(l.t),
            b: common_vendor.t(l.v),
            c: l.t
          };
        }),
        d: common_vendor.f(thresholds, (t, k0, i0) => {
          return {
            a: common_vendor.t(t.t),
            b: common_vendor.t(t.v),
            c: common_vendor.n(t.cls === "ok" ? "gain" : "loss"),
            d: t.t
          };
        })
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-c50cbe59"]]);
wx.createPage(MiniProgramPage);
