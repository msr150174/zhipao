"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    stores_user.useUserStore();
    const app = common_vendor.ref(null);
    const loading = common_vendor.ref(true);
    const realName = common_vendor.ref("");
    const studentNo = common_vendor.ref("");
    const phone = common_vendor.ref("");
    const campus = common_vendor.ref("");
    const intro = common_vendor.ref("");
    const submitting = common_vendor.ref(false);
    const status = common_vendor.computed(() => {
      var _a;
      return ((_a = app.value) == null ? void 0 : _a.status) ?? null;
    });
    common_vendor.computed(() => {
      var _a;
      return Boolean((_a = app.value) == null ? void 0 : _a.hasApplication);
    });
    const isApproved = common_vendor.computed(() => status.value === 1);
    const isPending = common_vendor.computed(() => status.value === 0);
    const isRejected = common_vendor.computed(() => status.value === 2);
    const canSubmit = common_vendor.computed(
      () => realName.value.trim() && studentNo.value.trim() && /^1[3-9]\d{9}$/.test(phone.value)
    );
    common_vendor.onMounted(async () => {
      try {
        app.value = await services_api.runnerApi.myApplication();
        if (isRejected.value) {
          realName.value = app.value.realName || "";
          studentNo.value = app.value.studentNo || "";
          campus.value = app.value.campus || "";
        }
      } catch {
        app.value = null;
      } finally {
        loading.value = false;
      }
    });
    async function submit() {
      if (!canSubmit.value || submitting.value) return;
      submitting.value = true;
      common_vendor.index.showLoading({ title: "提交中…", mask: true });
      try {
        await services_api.runnerApi.apply({
          realName: realName.value.trim(),
          studentNo: studentNo.value.trim(),
          phone: phone.value.trim(),
          campus: campus.value.trim() || void 0,
          intro: intro.value.trim() || void 0
        });
        common_vendor.index.hideLoading();
        utils_haptics.hapticSuccess();
        common_vendor.index.showToast({ title: "已提交，请等待审核", icon: "success" });
        app.value = await services_api.runnerApi.myApplication();
      } catch {
        common_vendor.index.hideLoading();
      } finally {
        submitting.value = false;
      }
    }
    function goOrders() {
      common_vendor.index.switchTab({ url: "/pages/index/index" });
    }
    return (_ctx, _cache) => {
      var _a;
      return common_vendor.e({
        a: common_vendor.p({
          title: "跑腿员入驻",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: isApproved.value
      }, isApproved.value ? {
        c: common_vendor.o(goOrders)
      } : isPending.value ? {} : common_vendor.e({
        e: isRejected.value
      }, isRejected.value ? {
        f: common_vendor.t(((_a = app.value) == null ? void 0 : _a.rejectReason) || "资料不完整")
      } : {}, {
        g: realName.value,
        h: common_vendor.o(($event) => realName.value = $event.detail.value),
        i: studentNo.value,
        j: common_vendor.o(($event) => studentNo.value = $event.detail.value),
        k: phone.value,
        l: common_vendor.o(($event) => phone.value = $event.detail.value),
        m: campus.value,
        n: common_vendor.o(($event) => campus.value = $event.detail.value),
        o: intro.value,
        p: common_vendor.o(($event) => intro.value = $event.detail.value),
        q: common_vendor.t(submitting.value ? "提交中…" : "提交申请"),
        r: !canSubmit.value || submitting.value ? 1 : "",
        s: !canSubmit.value || submitting.value,
        t: common_vendor.o(submit)
      }), {
        d: isPending.value
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-46ad2a46"]]);
wx.createPage(MiniProgramPage);
