"use strict";
const common_vendor = require("../common/vendor.js");
const utils_haptics = require("../utils/haptics.js");
const SIZE = 48;
const EDGE = 16;
const STORAGE_KEY = "float_pos";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "FloatingAssistant",
  props: {
    bottom: { default: 170 }
  },
  setup(__props) {
    const props = __props;
    const side = common_vendor.ref("right");
    const baseY = common_vendor.ref(props.bottom);
    const drag = common_vendor.ref({ dx: 0, dy: 0, active: false });
    let startX = 0;
    let startY = 0;
    let moved = false;
    let longPressed = false;
    let pressTimer = null;
    common_vendor.onMounted(() => {
      try {
        const saved = common_vendor.index.getStorageSync(STORAGE_KEY);
        if (saved) {
          const p = JSON.parse(saved);
          if (p.side === "left" || p.side === "right") side.value = p.side;
          if (typeof p.y === "number") baseY.value = p.y;
        }
      } catch {
      }
    });
    function persist() {
      try {
        common_vendor.index.setStorageSync(
          STORAGE_KEY,
          JSON.stringify({ side: side.value, y: baseY.value })
        );
      } catch {
      }
    }
    function onTouchStart(e) {
      var _a, _b;
      const t = ((_a = e.touches) == null ? void 0 : _a[0]) || ((_b = e.changedTouches) == null ? void 0 : _b[0]);
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
      longPressed = false;
      pressTimer = setTimeout(() => {
        longPressed = true;
        drag.value = { dx: 0, dy: 0, active: true };
        utils_haptics.haptic("light");
      }, 300);
    }
    function onTouchMove(e) {
      var _a;
      const t = (_a = e.touches) == null ? void 0 : _a[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = startY - t.clientY;
      if (!longPressed) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        }
        return;
      }
      moved = true;
      drag.value = { dx, dy, active: true };
    }
    function onTouchEnd(e) {
      var _a;
      if (pressTimer) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (!longPressed && !moved) {
        drag.value = { dx: 0, dy: 0, active: false };
        common_vendor.index.navigateTo({ url: "/pages/service/index" });
        return;
      }
      const t = (_a = e.changedTouches) == null ? void 0 : _a[0];
      let finalY = baseY.value - drag.value.dy;
      const info = common_vendor.index.getSystemInfoSync();
      const maxY = (info.windowHeight ?? 600) - 140;
      finalY = Math.min(Math.max(finalY, 90), maxY);
      let nextSide = side.value;
      if (t) {
        const half = (info.windowWidth ?? 375) / 2;
        nextSide = t.clientX < half ? "left" : "right";
      }
      baseY.value = finalY;
      side.value = nextSide;
      drag.value = { dx: 0, dy: 0, active: false };
      persist();
    }
    const fabStyle = common_vendor.computed(() => {
      const base = {
        position: "fixed",
        width: SIZE + "px",
        height: SIZE + "px",
        "border-radius": "50%",
        "background-color": "#22c55e",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "box-shadow": "0 10px 25px rgba(0,0,0,0.1)",
        "z-index": "45",
        bottom: baseY.value + "px"
      };
      if (side.value === "left") {
        base.left = EDGE + "px";
      } else {
        base.right = EDGE + "px";
      }
      if (drag.value.active) {
        base.transform = `translate(${drag.value.dx}px, ${-drag.value.dy}px) scale(1.1)`;
        base.opacity = "1";
        base.transition = "none";
      } else {
        base.transform = "translate(0, 0) scale(1)";
        base.opacity = "0.35";
        base.transition = "left 0.28s cubic-bezier(0.34,1.56,0.64,1), right 0.28s cubic-bezier(0.34,1.56,0.64,1), bottom 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease-out, transform 0.2s ease-out";
      }
      return base;
    });
    return (_ctx, _cache) => {
      return {
        a: common_vendor.s(fabStyle.value),
        b: common_vendor.o(onTouchStart),
        c: common_vendor.o(onTouchMove),
        d: common_vendor.o(onTouchEnd),
        e: common_vendor.o(onTouchEnd)
      };
    };
  }
});
const Component = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-5036bb41"]]);
wx.createComponent(Component);
