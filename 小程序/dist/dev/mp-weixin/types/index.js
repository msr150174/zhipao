"use strict";
const ORDER_STATUS_TEXT = {
  CREATED: "已创建",
  WAITING_ACCEPT: "待接单",
  ACCEPTED: "已接单",
  PICKING: "取件中",
  DELIVERING: "配送中",
  DELIVERED: "已送达待确认",
  COMPLETED: "已完成",
  CANCELLED: "已取消",
  APPEALING: "申诉中"
};
var DeliveryType = /* @__PURE__ */ ((DeliveryType2) => {
  DeliveryType2[DeliveryType2["PICKUP"] = 1] = "PICKUP";
  DeliveryType2[DeliveryType2["MEAL"] = 2] = "MEAL";
  return DeliveryType2;
})(DeliveryType || {});
var PackageSize = /* @__PURE__ */ ((PackageSize2) => {
  PackageSize2[PackageSize2["SMALL"] = 1] = "SMALL";
  PackageSize2[PackageSize2["MEDIUM"] = 2] = "MEDIUM";
  PackageSize2[PackageSize2["LARGE"] = 3] = "LARGE";
  return PackageSize2;
})(PackageSize || {});
const PACKAGE_SIZE_TEXT = {
  [
    1
    /* PICKUP */
  ]: { 1: "小件", 2: "中件", 3: "大件" },
  [
    2
    /* MEAL */
  ]: { 1: "小份", 2: "中份", 3: "大份" }
};
exports.DeliveryType = DeliveryType;
exports.ORDER_STATUS_TEXT = ORDER_STATUS_TEXT;
exports.PACKAGE_SIZE_TEXT = PACKAGE_SIZE_TEXT;
exports.PackageSize = PackageSize;
