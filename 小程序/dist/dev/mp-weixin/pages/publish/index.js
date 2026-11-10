"use strict";
const common_vendor = require("../../common/vendor.js");
const stores_user = require("../../stores/user.js");
const services_api = require("../../services/api.js");
const types_index = require("../../types/index.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  (AppHeader + LocationMap)();
}
const AppHeader = () => "../../components/AppHeader.js";
const LocationMap = () => "../../components/LocationMap.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const userStore = stores_user.useUserStore();
    const deliveryType = common_vendor.ref(types_index.DeliveryType.PICKUP);
    const station = common_vendor.ref(null);
    const building = common_vendor.ref(null);
    const roomNo = common_vendor.ref("");
    const pickupCodes = common_vendor.ref([""]);
    const shopNo = common_vendor.ref("");
    const packageSize = common_vendor.ref(types_index.PackageSize.MEDIUM);
    const reward = common_vendor.ref("");
    const remark = common_vendor.ref("");
    const urgent = common_vendor.ref(false);
    const deadlineHours = common_vendor.ref(2);
    const stations = common_vendor.ref([]);
    const buildings = common_vendor.ref([]);
    const showStationPicker = common_vendor.ref(false);
    const showBuildingPicker = common_vendor.ref(false);
    const stationKeyword = common_vendor.ref("");
    const buildingKeyword = common_vendor.ref("");
    const submitting = common_vendor.ref(false);
    const filteredStations = common_vendor.computed(() => {
      const k = stationKeyword.value.trim().toLowerCase();
      if (!k) return stations.value;
      return stations.value.filter((s) => s.name.toLowerCase().includes(k));
    });
    const filteredBuildings = common_vendor.computed(() => {
      const k = buildingKeyword.value.trim().toLowerCase();
      if (!k) return buildings.value;
      return buildings.value.filter(
        (b) => b.name.toLowerCase().includes(k) || (b.alias || "").toLowerCase().includes(k)
      );
    });
    const stationPoint = common_vendor.computed(() => {
      var _a, _b;
      if (((_a = station.value) == null ? void 0 : _a.lng) && ((_b = station.value) == null ? void 0 : _b.lat)) {
        return { lng: station.value.lng, lat: station.value.lat };
      }
      return { lng: 113.335, lat: 23.155 };
    });
    const buildingPoint = common_vendor.computed(() => {
      var _a, _b;
      if (((_a = building.value) == null ? void 0 : _a.lng) && ((_b = building.value) == null ? void 0 : _b.lat)) {
        return { lng: building.value.lng, lat: building.value.lat };
      }
      return stationPoint.value;
    });
    const mapMarkers = common_vendor.computed(() => {
      var _a, _b, _c, _d;
      const marks = [];
      if (((_a = station.value) == null ? void 0 : _a.lng) && ((_b = station.value) == null ? void 0 : _b.lat)) {
        marks.push({
          lng: station.value.lng,
          lat: station.value.lat,
          title: station.value.name
        });
      }
      if (((_c = building.value) == null ? void 0 : _c.lng) && ((_d = building.value) == null ? void 0 : _d.lat)) {
        marks.push({
          lng: building.value.lng,
          lat: building.value.lat,
          title: building.value.name
        });
      }
      return marks;
    });
    const deadline = common_vendor.computed(() => {
      const d = new Date(Date.now() + deadlineHours.value * 3600 * 1e3);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}:00`;
    });
    const canSubmit = common_vendor.computed(() => {
      if (!station.value) return false;
      if (!building.value) return false;
      if (!roomNo.value.trim()) return false;
      if (!reward.value || Number(reward.value) <= 0) return false;
      if (deliveryType.value === types_index.DeliveryType.PICKUP) {
        return pickupCodes.value.some((c) => c.trim());
      }
      return Boolean(shopNo.value.trim());
    });
    common_vendor.onMounted(async () => {
      await Promise.all([loadStations(), loadBuildings()]);
    });
    async function loadStations() {
      try {
        stations.value = await services_api.geoApi.stations();
      } catch {
        stations.value = [];
      }
    }
    async function loadBuildings() {
      try {
        buildings.value = await services_api.geoApi.buildings();
      } catch {
        buildings.value = [];
      }
    }
    function switchType(t) {
      if (deliveryType.value === t) return;
      utils_haptics.haptic("light");
      deliveryType.value = t;
    }
    function pickStation(s) {
      station.value = s;
      showStationPicker.value = false;
      stationKeyword.value = "";
      utils_haptics.haptic("light");
    }
    function pickBuilding(b) {
      building.value = b;
      showBuildingPicker.value = false;
      buildingKeyword.value = "";
      utils_haptics.haptic("light");
    }
    function onPickStation(loc) {
      station.value = {
        id: "",
        name: loc.address || "自定义取件点",
        type: 1,
        lng: loc.lng,
        lat: loc.lat
      };
    }
    function onPickBuilding(loc) {
      building.value = {
        id: "",
        name: loc.address || "自定义送达点",
        lng: loc.lng,
        lat: loc.lat
      };
    }
    function addCode() {
      if (pickupCodes.value.length >= 5) {
        common_vendor.index.showToast({ title: "最多 5 个取件码", icon: "none" });
        return;
      }
      pickupCodes.value.push("");
    }
    function removeCode(i) {
      if (pickupCodes.value.length <= 1) {
        pickupCodes.value = [""];
        return;
      }
      pickupCodes.value.splice(i, 1);
    }
    function onOcr() {
      common_vendor.index.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        success: async (res) => {
          const path = res.tempFilePaths[0];
          if (!path) return;
          common_vendor.index.showLoading({ title: "识别中…", mask: true });
          try {
            const up = await services_api.uploadApi.image(path, "pickup");
            const r = await services_api.ocrApi.pickupCode(up.url);
            if (r.codes && r.codes.length) {
              common_vendor.index.showActionSheet({
                itemList: r.codes,
                success: (s) => {
                  const code = r.codes[s.tapIndex];
                  const emptyIdx = pickupCodes.value.findIndex((c) => !c.trim());
                  if (emptyIdx >= 0) {
                    pickupCodes.value[emptyIdx] = code;
                  } else {
                    pickupCodes.value.push(code);
                  }
                  utils_haptics.hapticSuccess();
                }
              });
            } else {
              common_vendor.index.showToast({ title: "没识别到，请手动输入", icon: "none" });
            }
          } catch {
            common_vendor.index.showToast({ title: "识别失败，请手动输入", icon: "none" });
          } finally {
            common_vendor.index.hideLoading();
          }
        }
      });
    }
    async function submit() {
      if (!canSubmit.value || submitting.value) return;
      if (!userStore.canPublish) {
        common_vendor.index.showToast({ title: "信用分不足 50，暂不能发单", icon: "none" });
        return;
      }
      submitting.value = true;
      common_vendor.index.showLoading({ title: "发布中…", mask: true });
      try {
        const input = {
          deliveryType: deliveryType.value,
          stationId: station.value.id || void 0,
          stationName: station.value.name,
          buildingId: building.value.id || void 0,
          buildingName: building.value.name,
          roomNo: roomNo.value.trim(),
          packageSize: packageSize.value,
          reward: Number(reward.value),
          deadline: deadline.value,
          remark: remark.value.trim() || void 0,
          urgent: urgent.value
        };
        if (deliveryType.value === types_index.DeliveryType.PICKUP) {
          input.pickupCodes = pickupCodes.value.map((c) => c.trim()).filter(Boolean);
        } else {
          input.shopNo = shopNo.value.trim();
        }
        await services_api.orderApi.publish(input);
        utils_haptics.hapticSuccess();
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: "发布成功", icon: "success" });
        setTimeout(() => {
          common_vendor.index.switchTab({ url: "/pages/order-list/index" });
        }, 1200);
      } catch {
        common_vendor.index.hideLoading();
      } finally {
        submitting.value = false;
      }
    }
    const sizeOptions = [
      { v: types_index.PackageSize.SMALL, label: "小", desc: "文件/小盒" },
      { v: types_index.PackageSize.MEDIUM, label: "中", desc: "常规包裹" },
      { v: types_index.PackageSize.LARGE, label: "大", desc: "箱装/多件" }
    ];
    const rewardPresets = [3, 5, 8, 10];
    const hourPresets = [1, 2, 4, 8];
    return (_ctx, _cache) => {
      var _a, _b;
      return common_vendor.e({
        a: common_vendor.p({
          title: "发布需求",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: deliveryType.value === common_vendor.unref(types_index.DeliveryType).PICKUP ? 1 : "",
        c: common_vendor.o(($event) => switchType(common_vendor.unref(types_index.DeliveryType).PICKUP)),
        d: deliveryType.value === common_vendor.unref(types_index.DeliveryType).MEAL ? 1 : "",
        e: common_vendor.o(($event) => switchType(common_vendor.unref(types_index.DeliveryType).MEAL)),
        f: common_vendor.t(deliveryType.value === common_vendor.unref(types_index.DeliveryType).PICKUP ? "取件地点" : "取餐地点"),
        g: common_vendor.t(((_a = station.value) == null ? void 0 : _a.name) || "选择驿站 / 店铺"),
        h: !station.value ? 1 : "",
        i: common_vendor.o(($event) => showStationPicker.value = true),
        j: common_vendor.o(onPickStation),
        k: common_vendor.p({
          mode: "pick",
          title: "取件点位置",
          center: stationPoint.value,
          marker: station.value ? {
            lng: stationPoint.value.lng,
            lat: stationPoint.value.lat,
            title: station.value.name
          } : null,
          height: "260rpx"
        }),
        l: deliveryType.value === common_vendor.unref(types_index.DeliveryType).PICKUP
      }, deliveryType.value === common_vendor.unref(types_index.DeliveryType).PICKUP ? {
        m: common_vendor.o(onOcr),
        n: common_vendor.f(pickupCodes.value, (code, i, i0) => {
          return {
            a: pickupCodes.value[i],
            b: common_vendor.o(($event) => pickupCodes.value[i] = $event.detail.value, i),
            c: common_vendor.o(($event) => removeCode(i), i),
            d: i
          };
        }),
        o: common_vendor.o(addCode)
      } : {
        p: shopNo.value,
        q: common_vendor.o(($event) => shopNo.value = $event.detail.value)
      }, {
        r: common_vendor.t(((_b = building.value) == null ? void 0 : _b.name) || "选择楼栋"),
        s: !building.value ? 1 : "",
        t: common_vendor.o(($event) => showBuildingPicker.value = true),
        v: roomNo.value,
        w: common_vendor.o(($event) => roomNo.value = $event.detail.value),
        x: common_vendor.o(onPickBuilding),
        y: common_vendor.p({
          mode: "pick",
          title: "送达点位置",
          center: buildingPoint.value,
          markers: mapMarkers.value,
          height: "300rpx"
        }),
        z: common_vendor.f(sizeOptions, (s, k0, i0) => {
          return {
            a: common_vendor.t(s.label),
            b: packageSize.value === s.v ? 1 : "",
            c: common_vendor.t(s.desc),
            d: s.v,
            e: packageSize.value === s.v ? 1 : "",
            f: common_vendor.o(($event) => packageSize.value = s.v, s.v)
          };
        }),
        A: reward.value,
        B: common_vendor.o(($event) => reward.value = $event.detail.value),
        C: common_vendor.f(rewardPresets, (p, k0, i0) => {
          return {
            a: common_vendor.t(p),
            b: p,
            c: Number(reward.value) === p ? 1 : "",
            d: common_vendor.o(($event) => reward.value = String(p), p)
          };
        }),
        D: common_vendor.f(hourPresets, (h, k0, i0) => {
          return {
            a: common_vendor.t(h),
            b: h,
            c: deadlineHours.value === h ? 1 : "",
            d: common_vendor.o(($event) => deadlineHours.value = h, h)
          };
        }),
        E: urgent.value,
        F: common_vendor.o((e) => urgent.value = e.detail.value),
        G: remark.value,
        H: common_vendor.o(($event) => remark.value = $event.detail.value),
        I: common_vendor.t(Number(reward.value || 0).toFixed(2)),
        J: common_vendor.t(submitting.value ? "发布中…" : "立即发布"),
        K: !canSubmit.value || submitting.value ? 1 : "",
        L: !canSubmit.value || submitting.value,
        M: common_vendor.o(submit),
        N: showStationPicker.value
      }, showStationPicker.value ? common_vendor.e({
        O: common_vendor.o(($event) => showStationPicker.value = false),
        P: stationKeyword.value,
        Q: common_vendor.o(($event) => stationKeyword.value = $event.detail.value),
        R: common_vendor.f(filteredStations.value, (s, k0, i0) => {
          return {
            a: common_vendor.t(s.name),
            b: common_vendor.t(s.campus || ""),
            c: common_vendor.t(s.address || ""),
            d: s.id,
            e: common_vendor.o(($event) => pickStation(s), s.id)
          };
        }),
        S: !filteredStations.value.length
      }, !filteredStations.value.length ? {} : {}, {
        T: common_vendor.o(() => {
        }),
        U: common_vendor.o(($event) => showStationPicker.value = false)
      }) : {}, {
        V: showBuildingPicker.value
      }, showBuildingPicker.value ? common_vendor.e({
        W: common_vendor.o(($event) => showBuildingPicker.value = false),
        X: buildingKeyword.value,
        Y: common_vendor.o(($event) => buildingKeyword.value = $event.detail.value),
        Z: common_vendor.f(filteredBuildings.value, (b, k0, i0) => {
          return {
            a: common_vendor.t(b.name),
            b: common_vendor.t(b.campus || ""),
            c: common_vendor.t(b.alias || ""),
            d: b.id,
            e: common_vendor.o(($event) => pickBuilding(b), b.id)
          };
        }),
        aa: !filteredBuildings.value.length
      }, !filteredBuildings.value.length ? {} : {}, {
        ab: common_vendor.o(() => {
        }),
        ac: common_vendor.o(($event) => showBuildingPicker.value = false)
      }) : {});
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-ce8f53b1"]]);
wx.createPage(MiniProgramPage);
