"use strict";
const types_index = require("../types/index.js");
function sizeLabel(size, deliveryType = types_index.DeliveryType.PICKUP) {
  var _a;
  const s = Number(size);
  return ((_a = types_index.PACKAGE_SIZE_TEXT[deliveryType]) == null ? void 0 : _a[s]) ?? types_index.PACKAGE_SIZE_TEXT[types_index.DeliveryType.PICKUP][s] ?? "中件";
}
function formatDistance(meters) {
  if (meters === null || meters === void 0) {
    return "测量中";
  }
  if (meters < 1e3) {
    return `距您 ${Math.round(meters)}m`;
  }
  return `距您 ${(meters / 1e3).toFixed(1)}km`;
}
function walkMinutes(meters) {
  if (meters === null || meters === void 0) {
    return null;
  }
  return Math.max(1, Math.ceil(meters / 80));
}
function deadlineStyle(deadline) {
  if (!deadline) {
    return { cls: "text-on-surface-variant", anim: "" };
  }
  const ms = new Date(deadline.replace(/-/g, "/")).getTime() - Date.now();
  const min = ms / 6e4;
  if (min <= 0) {
    return { cls: "text-error font-bold", anim: "anim-shake" };
  }
  if (min < 30) {
    return { cls: "text-error font-semibold", anim: "anim-pulse-soft" };
  }
  if (min < 120) {
    return { cls: "text-warning font-semibold", anim: "" };
  }
  return { cls: "text-on-surface-variant", anim: "" };
}
exports.deadlineStyle = deadlineStyle;
exports.formatDistance = formatDistance;
exports.sizeLabel = sizeLabel;
exports.walkMinutes = walkMinutes;
