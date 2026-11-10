"use strict";
const common_vendor = require("../common/vendor.js");
function haptic(type = "light") {
  try {
    common_vendor.index.vibrateShort({ type });
  } catch {
  }
}
function hapticSuccess() {
  haptic("medium");
}
function hapticError() {
  haptic("heavy");
}
function refreshFeedback() {
  try {
    common_vendor.index.showToast({ title: "已更新", icon: "none", duration: 1e3 });
  } catch {
  }
}
exports.haptic = haptic;
exports.hapticError = hapticError;
exports.hapticSuccess = hapticSuccess;
exports.refreshFeedback = refreshFeedback;
