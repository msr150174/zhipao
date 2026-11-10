"use strict";
const common_vendor = require("../common/vendor.js");
const __vite_import_meta_env__ = {};
const ENV = __vite_import_meta_env__ || {};
const BASE_URL = ENV.VITE_API_BASE_URL || // ★ 开发阶段指向本机后端（3000 端口）
"http://localhost:3000";
const TOKEN_KEY = "zhipao_token";
function getToken() {
  try {
    return common_vendor.index.getStorageSync(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
function setToken(token) {
  try {
    common_vendor.index.setStorageSync(TOKEN_KEY, token);
  } catch {
  }
}
function clearToken() {
  try {
    common_vendor.index.removeStorageSync(TOKEN_KEY);
  } catch {
  }
}
function request(options) {
  const { url, method = "GET", data, silent = false, header = {} } = options;
  const token = getToken();
  const finalHeader = {
    "Content-Type": "application/json",
    ...header
  };
  if (token) {
    finalHeader.Authorization = `Bearer ${token}`;
  }
  const fullUrl = /^https?:\/\//.test(url) ? url : `${BASE_URL}${url}`;
  return new Promise((resolve, reject) => {
    common_vendor.index.request({
      url: fullUrl,
      method,
      data,
      header: finalHeader,
      timeout: 15e3,
      success: (res) => {
        const status = res.statusCode || 0;
        const body = res.data;
        if (status < 200 || status >= 300) {
          const msg = `请求失败（${status}）`;
          if (!silent) toast(msg);
          reject(new Error(msg));
          return;
        }
        if (!body || typeof body.code !== "number") {
          if (!silent) toast("返回数据格式异常");
          reject(new Error("Invalid response"));
          return;
        }
        if (body.code !== 200) {
          if (body.code === 401) {
            clearToken();
          }
          if (!silent) toast(body.msg || "请求失败");
          reject(new Error(body.msg || "请求失败"));
          return;
        }
        resolve(body.data);
      },
      fail: (err) => {
        const msg = "网络异常，请检查网络";
        if (!silent) toast(msg);
        reject(err || new Error(msg));
      }
    });
  });
}
function uploadFile(filePath, url = "/api/upload", extraFormData = {}) {
  const token = getToken();
  return new Promise((resolve, reject) => {
    common_vendor.index.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath,
      name: "file",
      formData: extraFormData,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data);
          if (body.code !== 200) {
            toast(body.msg || "上传失败");
            reject(new Error(body.msg));
            return;
          }
          resolve(body.data);
        } catch {
          toast("上传返回格式异常");
          reject(new Error("parse error"));
        }
      },
      fail: (err) => {
        toast("上传失败，请重试");
        reject(err);
      }
    });
  });
}
function toast(title, icon = "none") {
  common_vendor.index.showToast({ title, icon, duration: 2e3 });
}
exports.clearToken = clearToken;
exports.getToken = getToken;
exports.request = request;
exports.setToken = setToken;
exports.uploadFile = uploadFile;
