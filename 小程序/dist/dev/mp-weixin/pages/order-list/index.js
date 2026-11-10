"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const types_index = require("../../types/index.js");
const utils_order = require("../../utils/order.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + EmptyState + OrderCardSkeleton + FabGroup)();
}
const AppHeader = () => "../../components/AppHeader.js";
const EmptyState = () => "../../components/EmptyState.js";
const FabGroup = () => "../../components/FabGroup.js";
const OrderCardSkeleton = () => "../../components/OrderCardSkeleton.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const role = common_vendor.ref("all");
    const statusFilter = common_vendor.ref("");
    const list = common_vendor.ref([]);
    const loading = common_vendor.ref(false);
    const firstLoad = common_vendor.ref(true);
    const page = common_vendor.ref(1);
    const hasMore = common_vendor.ref(true);
    const loadError = common_vendor.ref("");
    const roles = [
      { key: "all", label: "全部" },
      { key: "publisher", label: "我发布的" },
      { key: "runner", label: "我接的" }
    ];
    const statusTabs = [
      { v: "", label: "全部" },
      { v: "WAITING_ACCEPT", label: "待接单" },
      { v: "ACCEPTED", label: "进行中" },
      { v: "COMPLETED", label: "已完成" }
    ];
    async function load(reset2 = false) {
      if (loading.value) return;
      if (!reset2 && !hasMore.value) return;
      if (!userStore.isLoggedIn) {
        firstLoad.value = false;
        return;
      }
      loading.value = true;
      loadError.value = "";
      try {
        const p = reset2 ? 1 : page.value;
        const res = await services_api.orderApi.mine({
          status: statusFilter.value || void 0,
          role: role.value === "all" ? void 0 : role.value,
          page: p,
          pageSize: 10
        });
        list.value = reset2 ? res.list : [...list.value, ...res.list];
        page.value = p + 1;
        hasMore.value = res.hasMore;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        loadError.value = msg;
        console.error("[我的订单] 加载失败:", msg);
      } finally {
        loading.value = false;
        firstLoad.value = false;
      }
    }
    function switchRole(k) {
      if (role.value === k) return;
      utils_haptics.haptic("light");
      role.value = k;
      reset();
    }
    function switchStatus(v) {
      if (statusFilter.value === v) return;
      utils_haptics.haptic("light");
      statusFilter.value = v;
      reset();
    }
    function reset() {
      list.value = [];
      page.value = 1;
      hasMore.value = true;
      firstLoad.value = true;
      loading.value = false;
      loadError.value = "";
      load(true);
    }
    common_vendor.onShow(() => {
      if (userStore.isLoggedIn) {
        reset();
      } else {
        firstLoad.value = false;
      }
    });
    common_vendor.onPullDownRefresh(async () => {
      try {
        await load(true);
      } finally {
        common_vendor.index.stopPullDownRefresh();
        utils_haptics.refreshFeedback();
      }
    });
    common_vendor.onReachBottom(() => load(false));
    function goDetail(id) {
      common_vendor.index.navigateTo({ url: `/pages/order-detail/index?id=${id}` });
    }
    function goLogin() {
      common_vendor.index.navigateTo({ url: "/pages/login/index" });
    }
    function statusText(s) {
      return types_index.ORDER_STATUS_TEXT[s] || s;
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "我的订单",
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.f(roles, (r, k0, i0) => {
          return {
            a: common_vendor.t(r.label),
            b: role.value === r.key ? 1 : "",
            c: r.key,
            d: role.value === r.key ? 1 : "",
            e: common_vendor.o(($event) => switchRole(r.key), r.key)
          };
        }),
        c: common_vendor.f(statusTabs, (s, k0, i0) => {
          return {
            a: common_vendor.t(s.label),
            b: statusFilter.value === s.v ? 1 : "",
            c: s.v,
            d: statusFilter.value === s.v ? 1 : "",
            e: common_vendor.o(($event) => switchStatus(s.v), s.v)
          };
        }),
        d: !common_vendor.unref(userStore).isLoggedIn
      }, !common_vendor.unref(userStore).isLoggedIn ? {
        e: common_vendor.o(goLogin),
        f: common_vendor.p({
          emoji: "🔐",
          title: "还没登录",
          desc: "登录后即可查看你的订单",
          ["action-text"]: "去登录"
        })
      } : firstLoad.value ? {
        h: common_vendor.f(3, (i, k0, i0) => {
          return {
            a: i,
            b: "312e3950-2-" + i0
          };
        })
      } : !list.value.length ? {
        j: common_vendor.p({
          emoji: "📋",
          title: "还没有订单",
          desc: "去首页看看有没有顺路的单子"
        })
      } : common_vendor.e({
        k: common_vendor.f(list.value, (o, k0, i0) => {
          return {
            a: common_vendor.t(o.orderNo),
            b: common_vendor.t(statusText(o.status)),
            c: common_vendor.t(o.stationName),
            d: common_vendor.t(o.buildingName),
            e: common_vendor.t(o.roomNo),
            f: common_vendor.t(Number(o.reward).toFixed(2)),
            g: common_vendor.t(common_vendor.unref(utils_order.sizeLabel)(o.packageSize, o.deliveryType)),
            h: common_vendor.t(o.deadlineText || ""),
            i: common_vendor.n(common_vendor.unref(utils_order.deadlineStyle)(o.deadline).cls),
            j: o.id,
            k: common_vendor.o(($event) => goDetail(o.id), o.id)
          };
        }),
        l: loading.value
      }, loading.value ? {} : !hasMore.value ? {} : {}, {
        m: !hasMore.value
      }), {
        g: firstLoad.value,
        i: !list.value.length,
        n: common_vendor.p({
          ["show-publish"]: true,
          ["show-assistant"]: true
        })
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-312e3950"]]);
wx.createPage(MiniProgramPage);
