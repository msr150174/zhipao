"use strict";
const common_vendor = require("../../common/vendor.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const orderId = common_vendor.ref("");
    const score = common_vendor.ref(5);
    const tags = common_vendor.ref([]);
    const comment = common_vendor.ref("");
    const submitting = common_vendor.ref(false);
    const allTags = ["准时送达", "态度很好", "沟通顺畅", "包装完好", "速度很快", "下次还找你"];
    const scoreText = ["", "很差", "较差", "一般", "满意", "非常满意"];
    common_vendor.onLoad((o) => {
      orderId.value = (o == null ? void 0 : o.id) || "";
    });
    function setScore(s) {
      utils_haptics.haptic("light");
      score.value = s;
    }
    function toggleTag(t) {
      utils_haptics.haptic("light");
      const i = tags.value.indexOf(t);
      if (i >= 0) tags.value.splice(i, 1);
      else tags.value.push(t);
    }
    async function submit() {
      if (submitting.value || !orderId.value) return;
      submitting.value = true;
      common_vendor.index.showLoading({ title: "提交中…", mask: true });
      try {
        await services_api.orderApi.evaluate(orderId.value, {
          score: score.value,
          tags: tags.value,
          comment: comment.value.trim() || void 0
        });
        common_vendor.index.hideLoading();
        utils_haptics.hapticSuccess();
        common_vendor.index.showToast({ title: "评价成功", icon: "success" });
        setTimeout(() => common_vendor.index.navigateBack(), 1e3);
      } catch {
        common_vendor.index.hideLoading();
      } finally {
        submitting.value = false;
      }
    }
    return (_ctx, _cache) => {
      return {
        a: common_vendor.p({
          title: "评价",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.f(5, (i, k0, i0) => {
          return {
            a: i,
            b: i <= score.value ? 1 : "",
            c: common_vendor.o(($event) => setScore(i), i)
          };
        }),
        c: common_vendor.t(scoreText[score.value]),
        d: common_vendor.f(allTags, (t, k0, i0) => {
          return {
            a: common_vendor.t(t),
            b: tags.value.includes(t) ? 1 : "",
            c: t,
            d: tags.value.includes(t) ? 1 : "",
            e: common_vendor.o(($event) => toggleTag(t), t)
          };
        }),
        e: comment.value,
        f: common_vendor.o(($event) => comment.value = $event.detail.value),
        g: common_vendor.t(submitting.value ? "提交中…" : "提交评价"),
        h: submitting.value ? 1 : "",
        i: submitting.value,
        j: common_vendor.o(submit)
      };
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-0d0846d8"]]);
wx.createPage(MiniProgramPage);
