"use strict";
const common_vendor = require("../common/vendor.js");
const services_api = require("../services/api.js");
const services_request = require("../services/request.js");
const USER_KEY = "zhipao_user";
const DEV_IDENTITY_KEY = "zhipao_dev_identity";
function getDevIdentity() {
  try {
    return common_vendor.index.getStorageSync(DEV_IDENTITY_KEY) || "default";
  } catch {
    return "default";
  }
}
function setDevIdentity(v) {
  try {
    common_vendor.index.setStorageSync(DEV_IDENTITY_KEY, v || "default");
  } catch {
  }
}
const useUserStore = common_vendor.defineStore("user", () => {
  const token = common_vendor.ref(services_request.getToken());
  const profile = common_vendor.ref(loadCachedUser());
  const loading = common_vendor.ref(false);
  const devIdentity = common_vendor.ref(getDevIdentity());
  const isLoggedIn = common_vendor.computed(() => Boolean(token.value));
  const isRunner = common_vendor.computed(() => {
    var _a;
    return Boolean((_a = profile.value) == null ? void 0 : _a.isRunner);
  });
  const isAdmin = common_vendor.computed(() => {
    var _a;
    return Boolean((_a = profile.value) == null ? void 0 : _a.isAdmin);
  });
  const creditScore = common_vendor.computed(() => {
    var _a;
    return ((_a = profile.value) == null ? void 0 : _a.creditScore) ?? 0;
  });
  const balance = common_vendor.computed(() => {
    var _a;
    return ((_a = profile.value) == null ? void 0 : _a.balance) ?? 0;
  });
  const canAccept = common_vendor.computed(() => creditScore.value >= 60);
  const canPublish = common_vendor.computed(() => creditScore.value >= 50);
  async function wxLogin(devUser) {
    loading.value = true;
    try {
      const identity = devUser ?? getDevIdentity();
      const code = await getWxCode();
      const res = await services_api.authApi.wxLogin(code, identity);
      applyLogin(res.token, res.user);
      return true;
    } catch {
      return false;
    } finally {
      loading.value = false;
    }
  }
  async function switchIdentity(devUser) {
    setDevIdentity(devUser);
    devIdentity.value = devUser;
    await logout();
    const ok = await wxLogin(devUser);
    if (ok) {
      common_vendor.index.$emit("identity-switched", devUser);
    }
    return ok;
  }
  async function smsLogin(phone, code) {
    loading.value = true;
    try {
      const res = await services_api.authApi.smsLogin(phone, code);
      applyLogin(res.token, res.user);
      return true;
    } catch {
      return false;
    } finally {
      loading.value = false;
    }
  }
  async function refreshProfile() {
    if (!token.value) return;
    try {
      const p = await services_api.userApi.profile();
      profile.value = p;
      cacheUser(p);
    } catch {
    }
  }
  async function logout() {
    try {
      await services_api.authApi.logout();
    } catch {
    }
    token.value = "";
    profile.value = null;
    services_request.clearToken();
    try {
      common_vendor.index.removeStorageSync(USER_KEY);
    } catch {
    }
  }
  async function deactivate() {
    try {
      await services_api.userApi.deactivate();
      await logout();
      return true;
    } catch {
      return false;
    }
  }
  function applyLogin(t, u) {
    token.value = t;
    profile.value = u;
    services_request.setToken(t);
    cacheUser(u);
  }
  function cacheUser(u) {
    try {
      common_vendor.index.setStorageSync(USER_KEY, JSON.stringify(u));
    } catch {
    }
  }
  function loadCachedUser() {
    try {
      const raw = common_vendor.index.getStorageSync(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  function getWxCode() {
    return new Promise((resolve, reject) => {
      common_vendor.index.login({
        provider: "weixin",
        success: (res) => resolve(res.code || ""),
        fail: reject
      });
    });
  }
  return {
    token,
    profile,
    loading,
    isLoggedIn,
    isRunner,
    isAdmin,
    creditScore,
    balance,
    canAccept,
    canPublish,
    wxLogin,
    switchIdentity,
    smsLogin,
    refreshProfile,
    logout,
    deactivate,
    devIdentity
  };
});
exports.useUserStore = useUserStore;
