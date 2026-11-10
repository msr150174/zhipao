"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + EmptyState)();
}
const AppHeader = () => "../../components/AppHeader.js";
const EmptyState = () => "../../components/EmptyState.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const list = common_vendor.ref([]);
    const loading = common_vendor.ref(true);
    const filter = common_vendor.ref(0);
    const tabs = [
      { v: 0, label: "待审核" },
      { v: 1, label: "已通过" },
      { v: 2, label: "已驳回" },
      { v: void 0, label: "全部" }
    ];
    async function load() {
      loading.value = true;
      try {
        const res = await services_api.adminApi.listApplications(filter.value, 1, 50);
        list.value = res.list || [];
      } catch {
        list.value = [];
      } finally {
        loading.value = false;
      }
    }
    common_vendor.onMounted(load);
    function switchFilter(v) {
      filter.value = v;
      load();
    }
    function onApprove(item) {
      common_vendor.index.showModal({
        title: "确认通过",
        content: `通过 ${item.realName} 的入驻申请？`,
        success: async (res) => {
          if (!res.confirm) return;
          try {
            await services_api.adminApi.approve(Number(item.id));
            utils_haptics.hapticSuccess();
            common_vendor.index.showToast({ title: "已通过", icon: "success" });
            load();
          } catch {
          }
        }
      });
    }
    function onReject(item) {
      common_vendor.index.showModal({
        title: "驳回申请",
        editable: true,
        placeholderText: "请输入驳回原因",
        success: async (res) => {
          var _a;
          if (!res.confirm) return;
          const reason = (_a = res.content) == null ? void 0 : _a.trim();
          if (!reason) {
            common_vendor.index.showToast({ title: "请填写驳回原因", icon: "none" });
            return;
          }
          try {
            await services_api.adminApi.reject(Number(item.id), reason);
            common_vendor.index.showToast({ title: "已驳回", icon: "success" });
            load();
          } catch {
          }
        }
      });
    }
    function statusTag(s) {
      if (s === 0) return { text: "待审核", cls: "tag-primary" };
      if (s === 1) return { text: "已通过", cls: "tag-gray" };
      return { text: "已驳回", cls: "tag-error" };
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "入驻审核",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: !common_vendor.unref(userStore).isAdmin
      }, !common_vendor.unref(userStore).isAdmin ? {
        c: common_vendor.p({
          emoji: "🚫",
          title: "无管理权限",
          desc: "该功能仅管理员可用"
        })
      } : common_vendor.e({
        d: common_vendor.f(tabs, (t, k0, i0) => {
          return {
            a: common_vendor.t(t.label),
            b: filter.value === t.v ? 1 : "",
            c: String(t.v),
            d: filter.value === t.v ? 1 : "",
            e: common_vendor.o(($event) => switchFilter(t.v), String(t.v))
          };
        }),
        e: !loading.value && !list.value.length
      }, !loading.value && !list.value.length ? {
        f: common_vendor.p({
          emoji: "📭",
          title: "暂无申请",
          desc: "当前筛选条件下没有记录"
        })
      } : {}, {
        g: common_vendor.f(list.value, (item, k0, i0) => {
          return common_vendor.e({
            a: common_vendor.t(item.realName),
            b: common_vendor.t(statusTag(item.status).text),
            c: common_vendor.n(statusTag(item.status).cls),
            d: common_vendor.t(item.studentNo),
            e: common_vendor.t(item.phone),
            f: item.campus
          }, item.campus ? {
            g: common_vendor.t(item.campus)
          } : {}, {
            h: item.intro
          }, item.intro ? {
            i: common_vendor.t(item.intro)
          } : {}, {
            j: item.status === 0
          }, item.status === 0 ? {
            k: common_vendor.o(($event) => onReject(item), item.id),
            l: common_vendor.o(($event) => onApprove(item), item.id)
          } : item.rejectReason ? {
            n: common_vendor.t(item.rejectReason)
          } : {}, {
            m: item.rejectReason,
            o: item.id
          });
        })
      }));
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-f94c733c"]]);
wx.createPage(MiniProgramPage);
