"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const types_index = require("../../types/index.js");
const utils_order = require("../../utils/order.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + OrderCardSkeleton + EmptyState + FabGroup)();
}
const AppHeader = () => "../../components/AppHeader.js";
const EmptyState = () => "../../components/EmptyState.js";
const FabGroup = () => "../../components/FabGroup.js";
const OrderCardSkeleton = () => "../../components/OrderCardSkeleton.js";
const PAGE_SIZE = 10;
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const tab = common_vendor.ref("all");
    const keyword = common_vendor.ref("");
    const list = common_vendor.ref([]);
    const loading = common_vendor.ref(false);
    const firstLoad = common_vendor.ref(true);
    const page = common_vendor.ref(1);
    const hasMore = common_vendor.ref(true);
    const tabs = [
      { key: "all", label: "全部", icon: "🎯" },
      { key: "pickup", label: "取快递", icon: "📦" },
      { key: "meal", label: "取外卖", icon: "🍜" }
    ];
    const deliveryType = common_vendor.computed(() => {
      if (tab.value === "pickup") return 1;
      if (tab.value === "meal") return 2;
      return void 0;
    });
    const loadError = common_vendor.ref("");
    const needLogin = common_vendor.ref(false);
    async function load(reset = false) {
      if (loading.value) return;
      if (!reset && !hasMore.value) return;
      if (!userStore.isLoggedIn) {
        needLogin.value = true;
        loadError.value = "";
        list.value = [];
        loading.value = false;
        firstLoad.value = false;
        return;
      }
      needLogin.value = false;
      loading.value = true;
      loadError.value = "";
      try {
        const p = reset ? 1 : page.value;
        const res = await services_api.orderApi.available({
          deliveryType: deliveryType.value,
          keyword: keyword.value || void 0,
          page: p,
          pageSize: PAGE_SIZE
        });
        list.value = reset ? res.list : [...list.value, ...res.list];
        page.value = p + 1;
        hasMore.value = res.hasMore;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        loadError.value = msg;
        console.error("[首页] 加载订单失败:", msg);
      } finally {
        loading.value = false;
        firstLoad.value = false;
      }
    }
    function goLogin() {
      common_vendor.index.navigateTo({ url: "/pages/login/index" });
    }
    function switchTab(k) {
      if (tab.value === k) return;
      utils_haptics.haptic("light");
      tab.value = k;
      list.value = [];
      page.value = 1;
      hasMore.value = true;
      firstLoad.value = true;
      load(true);
    }
    function onSearch() {
      list.value = [];
      page.value = 1;
      hasMore.value = true;
      firstLoad.value = true;
      load(true);
    }
    function onClearSearch() {
      keyword.value = "";
      onSearch();
    }
    const lastUserId = common_vendor.ref(null);
    function reload() {
      var _a;
      lastUserId.value = ((_a = userStore.profile) == null ? void 0 : _a.id) ?? null;
      list.value = [];
      page.value = 1;
      hasMore.value = true;
      firstLoad.value = true;
      loading.value = false;
      load(true);
    }
    common_vendor.onShow(async () => {
      var _a;
      if (userStore.isLoggedIn) {
        userStore.refreshProfile();
      }
      const currentUserId = ((_a = userStore.profile) == null ? void 0 : _a.id) ?? null;
      const switched = lastUserId.value !== null && lastUserId.value !== currentUserId;
      const empty = list.value.length === 0;
      if (firstLoad.value || empty || switched) {
        reload();
      }
    });
    common_vendor.onMounted(() => {
      common_vendor.index.$on("identity-switched", reload);
    });
    common_vendor.onUnmounted(() => {
      common_vendor.index.$off("identity-switched", reload);
    });
    common_vendor.onPullDownRefresh(async () => {
      try {
        await load(true);
        await userStore.refreshProfile();
        utils_haptics.refreshFeedback();
      } finally {
        common_vendor.index.stopPullDownRefresh();
      }
    });
    common_vendor.onReachBottom(() => {
      load(false);
    });
    function goDetail(id) {
      common_vendor.index.navigateTo({ url: `/pages/order-detail/index?id=${id}` });
    }
    function goPublish() {
      common_vendor.index.navigateTo({ url: "/pages/publish/index" });
    }
    function statusText(s) {
      return types_index.ORDER_STATUS_TEXT[s] || s;
    }
    function deadlineText(o) {
      return o.deadlineText || "";
    }
    function typeBarClass(o) {
      return Number(o.deliveryType) === 2 ? "bar-meal" : "bar-pickup";
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "智跑校园",
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.o(onSearch),
        c: keyword.value,
        d: common_vendor.o(($event) => keyword.value = $event.detail.value),
        e: keyword.value
      }, keyword.value ? {
        f: common_vendor.o(onClearSearch)
      } : {}, {
        g: common_vendor.f(tabs, (t, k0, i0) => {
          return {
            a: common_vendor.t(t.icon),
            b: common_vendor.t(t.label),
            c: tab.value === t.key ? 1 : "",
            d: t.key,
            e: tab.value === t.key ? 1 : "",
            f: common_vendor.o(($event) => switchTab(t.key), t.key)
          };
        }),
        h: needLogin.value
      }, needLogin.value ? {
        i: common_vendor.o(goLogin)
      } : firstLoad.value ? {
        k: common_vendor.f(3, (i, k0, i0) => {
          return {
            a: i,
            b: "83a5a03c-1-" + i0
          };
        })
      } : loadError.value ? {
        m: common_vendor.t(loadError.value),
        n: common_vendor.o(($event) => reload())
      } : !list.value.length ? {
        p: common_vendor.o(goPublish),
        q: common_vendor.p({
          emoji: "📭",
          title: "暂无待接订单",
          desc: "换个分类看看，或者自己发布一个需求",
          ["action-text"]: "去发布需求"
        })
      } : common_vendor.e({
        r: common_vendor.f(list.value, (o, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.n(typeBarClass(o)),
            b: common_vendor.t(Number(o.deliveryType) === 2 ? "🍜 取外卖" : "📦 取快递"),
            c: o.urgent
          }, o.urgent ? {} : {}, {
            d: common_vendor.t(statusText(o.status)),
            e: common_vendor.t(o.stationName),
            f: common_vendor.t(o.buildingName),
            g: common_vendor.t(o.roomNo),
            h: common_vendor.t(common_vendor.unref(utils_order.sizeLabel)(o.packageSize, o.deliveryType)),
            i: common_vendor.t(o.itemCount),
            j: common_vendor.t(Number(o.reward).toFixed(2)),
            k: common_vendor.t(common_vendor.unref(utils_order.formatDistance)(o.distanceMeters)),
            l: common_vendor.t(deadlineText(o)),
            m: common_vendor.n(common_vendor.unref(utils_order.deadlineStyle)(o.deadline).cls),
            n: o.id,
            o: common_vendor.o(($event) => goDetail(o.id), o.id)
          });
        }),
        s: loading.value
      }, loading.value ? {} : !hasMore.value ? {} : {}, {
        t: !hasMore.value
      }), {
        j: firstLoad.value,
        l: loadError.value,
        o: !list.value.length,
        v: common_vendor.p({
          ["show-publish"]: true,
          ["show-assistant"]: true
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-83a5a03c"]]);
wx.createPage(MiniProgramPage);
