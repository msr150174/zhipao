"use strict";
const common_vendor = require("../common/vendor.js");
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "LocationMap",
  props: {
    mode: { default: "view" },
    title: {},
    center: {},
    marker: {},
    markers: {},
    height: { default: "320rpx" }
  },
  emits: ["pick"],
  setup(__props, { emit: __emit }) {
    const props = __props;
    const emit = __emit;
    const isWeapp = common_vendor.computed(() => {
      return true;
    });
    const allMarks = common_vendor.computed(() => {
      if (props.markers && props.markers.length) return props.markers;
      if (props.marker) return [props.marker];
      return [{ lng: props.center.lng, lat: props.center.lat, title: props.title }];
    });
    const mapMarkers = common_vendor.computed(
      () => allMarks.value.map((m, i) => ({
        id: i + 1,
        longitude: m.lng,
        latitude: m.lat,
        title: m.title || "",
        width: 24,
        height: 24
      }))
    );
    const autoScale = common_vendor.computed(() => {
      if (allMarks.value.length < 2) return 16;
      const dLat = Math.abs(allMarks.value[0].lat - allMarks.value[1].lat);
      const dLng = Math.abs(allMarks.value[0].lng - allMarks.value[1].lng);
      const span = Math.max(dLat, dLng);
      if (span > 0.02) return 13;
      if (span > 0.01) return 14;
      return 16;
    });
    function onMapTap() {
      if (props.mode === "pick") {
        common_vendor.index.chooseLocation({
          success: (res) => {
            emit("pick", {
              lng: res.longitude,
              lat: res.latitude,
              address: res.address || res.name
            });
          },
          fail: () => {
          }
        });
      } else {
        const m = allMarks.value[0];
        common_vendor.index.openLocation({
          longitude: m.lng,
          latitude: m.lat,
          name: m.title || props.title || "",
          scale: 16
        });
      }
    }
    function onLocate(e) {
      var _a;
      (_a = e.stopPropagation) == null ? void 0 : _a.call(e);
      common_vendor.index.getLocation({
        type: "gcj02",
        success: (res) => {
          emit("pick", { lng: res.longitude, lat: res.latitude });
        },
        fail: () => {
          common_vendor.index.showToast({ title: "请授权位置权限", icon: "none" });
        }
      });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: props.title
      }, props.title ? {
        b: common_vendor.t(props.title),
        c: common_vendor.t(props.mode === "pick" ? "点击地图可修改" : "点击地图可导航")
      } : {}, {
        d: isWeapp.value
      }, isWeapp.value ? common_vendor.e({
        e: props.height,
        f: props.center.lng,
        g: props.center.lat,
        h: autoScale.value,
        i: mapMarkers.value,
        j: common_vendor.o(onMapTap),
        k: props.mode === "pick"
      }, props.mode === "pick" ? {
        l: common_vendor.o(onLocate)
      } : {}) : {
        m: props.height
      });
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-c5dd3015"]]);
wx.createComponent(Component);
