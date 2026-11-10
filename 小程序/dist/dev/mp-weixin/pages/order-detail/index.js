"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const types_index = require("../../types/index.js");
const utils_order = require("../../utils/order.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + LocationMap + SuccessOverlay)();
}
const AppHeader = () => "../../components/AppHeader.js";
const LocationMap = () => "../../components/LocationMap.js";
const SuccessOverlay = () => "../../components/SuccessOverlay.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const orderId = common_vendor.ref("");
    const order = common_vendor.ref(null);
    const loading = common_vendor.ref(false);
    const acting = common_vendor.ref(false);
    const showSuccess = common_vendor.ref(false);
    const isPublisher = common_vendor.computed(
      () => {
        var _a;
        return Boolean(order.value && ((_a = userStore.profile) == null ? void 0 : _a.id) === order.value.publisherId);
      }
    );
    const isRunner = common_vendor.computed(
      () => {
        var _a;
        return Boolean(order.value && ((_a = userStore.profile) == null ? void 0 : _a.id) === order.value.runnerId);
      }
    );
    const isStakeholder = common_vendor.computed(() => isPublisher.value || isRunner.value);
    const stationPoint = common_vendor.computed(() => {
      const o = order.value;
      if ((o == null ? void 0 : o.stationLng) && (o == null ? void 0 : o.stationLat)) {
        return { lng: Number(o.stationLng), lat: Number(o.stationLat) };
      }
      return null;
    });
    const buildingPoint = common_vendor.computed(() => {
      const o = order.value;
      if ((o == null ? void 0 : o.buildingLng) && (o == null ? void 0 : o.buildingLat)) {
        return { lng: Number(o.buildingLng), lat: Number(o.buildingLat) };
      }
      return null;
    });
    const mapCenter = common_vendor.computed(() => buildingPoint.value || stationPoint.value || { lng: 113.335, lat: 23.155 });
    const hasCoord = common_vendor.computed(() => Boolean(stationPoint.value || buildingPoint.value));
    const mapMarkers = common_vendor.computed(() => {
      var _a, _b;
      const marks = [];
      if (stationPoint.value) {
        marks.push({ ...stationPoint.value, title: ((_a = order.value) == null ? void 0 : _a.stationName) || "取件点" });
      }
      if (buildingPoint.value) {
        marks.push({ ...buildingPoint.value, title: ((_b = order.value) == null ? void 0 : _b.buildingName) || "送达点" });
      }
      return marks;
    });
    async function load() {
      if (!orderId.value || loading.value) return;
      loading.value = true;
      try {
        order.value = await services_api.orderApi.detail(orderId.value);
      } catch {
      } finally {
        loading.value = false;
      }
    }
    common_vendor.onLoad((options) => {
      orderId.value = (options == null ? void 0 : options.id) || "";
      load();
    });
    common_vendor.onShow(() => {
      if (orderId.value && order.value) load();
    });
    common_vendor.onPullDownRefresh(async () => {
      try {
        await load();
        utils_haptics.refreshFeedback();
      } finally {
        common_vendor.index.stopPullDownRefresh();
      }
    });
    async function doAccept() {
      if (acting.value || !order.value) return;
      if (!userStore.canAccept) {
        common_vendor.index.showToast({ title: "信用分不足 60，暂不能接单", icon: "none" });
        return;
      }
      acting.value = true;
      try {
        order.value = await services_api.orderApi.accept(order.value.id);
        utils_haptics.hapticSuccess();
        showSuccess.value = true;
        setTimeout(() => showSuccess.value = false, 1600);
      } catch {
        utils_haptics.hapticError();
      } finally {
        acting.value = false;
      }
    }
    async function doAdvance(action) {
      if (acting.value || !order.value) return;
      acting.value = true;
      try {
        order.value = await services_api.orderApi.advance(order.value.id, action);
        utils_haptics.haptic("medium");
      } catch {
        utils_haptics.hapticError();
      } finally {
        acting.value = false;
      }
    }
    async function doComplete() {
      if (acting.value || !order.value) return;
      common_vendor.index.showModal({
        title: "确认收货",
        content: "确认已收到物品？确认后报酬将结算给跑腿员。",
        success: async (res) => {
          if (!res.confirm || !order.value) return;
          acting.value = true;
          try {
            order.value = await services_api.orderApi.complete(order.value.id);
            utils_haptics.hapticSuccess();
            showSuccess.value = true;
            setTimeout(() => showSuccess.value = false, 1600);
            await userStore.refreshProfile();
          } catch {
            utils_haptics.hapticError();
          } finally {
            acting.value = false;
          }
        }
      });
    }
    async function doCancel() {
      if (acting.value || !order.value) return;
      const reasons = ["不需要了", "下错单了", "等太久了", "其他原因"];
      common_vendor.index.showActionSheet({
        itemList: reasons,
        success: async (res) => {
          if (!order.value) return;
          acting.value = true;
          try {
            order.value = await services_api.orderApi.cancel(order.value.id, reasons[res.tapIndex]);
            utils_haptics.haptic("medium");
            common_vendor.index.showToast({ title: "已取消", icon: "success" });
          } catch {
            utils_haptics.hapticError();
          } finally {
            acting.value = false;
          }
        }
      });
    }
    function goEvaluate() {
      if (!order.value) return;
      common_vendor.index.navigateTo({ url: `/pages/evaluate/index?id=${order.value.id}` });
    }
    function goService() {
      common_vendor.index.navigateTo({ url: "/pages/service/index" });
    }
    function copyOrderNo() {
      if (!order.value) return;
      common_vendor.index.setClipboardData({
        data: order.value.orderNo,
        success: () => common_vendor.index.showToast({ title: "已复制", icon: "none" })
      });
    }
    function statusText(s) {
      return types_index.ORDER_STATUS_TEXT[s] || s;
    }
    function statusHint(o) {
      var _a;
      const me = (_a = userStore.profile) == null ? void 0 : _a.id;
      switch (o.status) {
        case "WAITING_ACCEPT":
          return o.publisherId === me ? "正在等待跑腿员接单…" : "接单后请尽快取件";
        case "ACCEPTED":
          return "跑腿员已接单，正在赶往取件点";
        case "PICKING":
          return "跑腿员正在取件";
        case "DELIVERING":
          return "物品正在配送中";
        case "DELIVERED":
          return o.publisherId === me ? "物品已送达，请确认收货" : "等待发布方确认";
        case "COMPLETED":
          return "订单已完成";
        case "CANCELLED":
          return o.cancelReason || "订单已取消";
        default:
          return "";
      }
    }
    const primaryAction = common_vendor.computed(() => {
      const o = order.value;
      if (!o) return null;
      if (o.status === "WAITING_ACCEPT" && !isPublisher.value) {
        return { text: "立即接单", type: "accept" };
      }
      if (isRunner.value) {
        if (o.status === "ACCEPTED") return { text: "我已取件", type: "pick" };
        if (o.status === "PICKING") return { text: "开始配送", type: "deliver" };
        if (o.status === "DELIVERING") return { text: "已送达", type: "arrive" };
      }
      if (o.status === "DELIVERED" && isPublisher.value) {
        return { text: "确认收货", type: "complete" };
      }
      if (o.status === "COMPLETED" && isStakeholder.value) {
        return { text: "去评价", type: "evaluate" };
      }
      return null;
    });
    function onPrimary() {
      const a = primaryAction.value;
      if (!a) return;
      if (a.type === "accept") doAccept();
      else if (a.type === "pick") doAdvance("pick");
      else if (a.type === "deliver") doAdvance("deliver");
      else if (a.type === "arrive") doAdvance("arrive");
      else if (a.type === "complete") doComplete();
      else if (a.type === "evaluate") goEvaluate();
    }
    const canCancel = common_vendor.computed(() => {
      const o = order.value;
      if (!o || !isStakeholder.value) return false;
      return ["WAITING_ACCEPT", "ACCEPTED", "PICKING", "DELIVERING"].includes(o.status);
    });
    const pickupCodeHidden = common_vendor.computed(
      () => {
        var _a;
        return ((_a = order.value) == null ? void 0 : _a.pickupCode) === "[已隐藏]";
      }
    );
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "订单详情",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: order.value
      }, order.value ? common_vendor.e({
        c: common_vendor.t(statusText(order.value.status)),
        d: common_vendor.t(statusHint(order.value)),
        e: order.value.status !== "COMPLETED" && order.value.status !== "CANCELLED"
      }, order.value.status !== "COMPLETED" && order.value.status !== "CANCELLED" ? {
        f: common_vendor.t(Number(order.value.reward).toFixed(2))
      } : {}, {
        g: common_vendor.t(order.value.stationName),
        h: order.value.shopNo
      }, order.value.shopNo ? {
        i: common_vendor.t(order.value.shopNo)
      } : {}, {
        j: order.value.pickupCode
      }, order.value.pickupCode ? {
        k: common_vendor.t(order.value.pickupCode),
        l: pickupCodeHidden.value ? 1 : ""
      } : {}, {
        m: common_vendor.t(order.value.buildingName),
        n: common_vendor.t(order.value.roomNo),
        o: common_vendor.t(common_vendor.unref(utils_order.formatDistance)(order.value.distanceMeters)),
        p: common_vendor.unref(utils_order.walkMinutes)(order.value.distanceMeters)
      }, common_vendor.unref(utils_order.walkMinutes)(order.value.distanceMeters) ? {
        q: common_vendor.t(common_vendor.unref(utils_order.walkMinutes)(order.value.distanceMeters))
      } : {}, {
        r: hasCoord.value
      }, hasCoord.value ? {
        s: common_vendor.p({
          mode: "view",
          title: "配送地图",
          center: mapCenter.value,
          markers: mapMarkers.value,
          height: "340rpx"
        })
      } : {}, {
        t: common_vendor.t(order.value.orderNo),
        v: common_vendor.o(copyOrderNo),
        w: common_vendor.t(Number(order.value.deliveryType) === 2 ? "取外卖" : "取快递"),
        x: common_vendor.t(common_vendor.unref(utils_order.sizeLabel)(order.value.packageSize, order.value.deliveryType)),
        y: common_vendor.t(order.value.itemCount),
        z: common_vendor.t(Number(order.value.reward).toFixed(2)),
        A: common_vendor.t(order.value.deadlineText || order.value.deadline),
        B: order.value.urgent
      }, order.value.urgent ? {} : {}, {
        C: order.value.remark
      }, order.value.remark ? {
        D: common_vendor.t(order.value.remark)
      } : {}, {
        E: order.value.runnerName
      }, order.value.runnerName ? common_vendor.e({
        F: common_vendor.t(order.value.runnerName),
        G: order.value.runnerCredit
      }, order.value.runnerCredit ? {
        H: common_vendor.t(order.value.runnerCredit)
      } : {}) : {}, {
        I: common_vendor.o(goService)
      }) : loading.value ? {} : {}, {
        J: loading.value,
        K: order.value && (primaryAction.value || canCancel.value)
      }, order.value && (primaryAction.value || canCancel.value) ? common_vendor.e({
        L: canCancel.value
      }, canCancel.value ? {
        M: acting.value,
        N: common_vendor.o(doCancel)
      } : {}, {
        O: primaryAction.value
      }, primaryAction.value ? {
        P: common_vendor.t(acting.value ? "处理中…" : primaryAction.value.text),
        Q: acting.value ? 1 : "",
        R: acting.value,
        S: common_vendor.o(onPrimary)
      } : {}) : {}, {
        T: common_vendor.p({
          visible: showSuccess.value,
          title: "操作成功"
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-4882039d"]]);
wx.createPage(MiniProgramPage);
