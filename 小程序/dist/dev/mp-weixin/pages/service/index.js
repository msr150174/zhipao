"use strict";
const common_vendor = require("../../common/vendor.js");
const services_api = require("../../services/api.js");
const utils_haptics = require("../../utils/haptics.js");
if (!Math) {
  AppHeader();
}
const AppHeader = () => "../../components/AppHeader.js";
const _sfc_main = /* @__PURE__ */ common_vendor.defineComponent({
  __name: "index",
  setup(__props) {
    const messages = common_vendor.ref([
      {
        role: "assistant",
        content: "你好！我是智跑校园的智能助手 🏃\n可以问我：订单进度、信用分规则、怎么取件等。"
      }
    ]);
    const input = common_vendor.ref("");
    const sending = common_vendor.ref(false);
    const scrollTop = common_vendor.ref(0);
    const provider = common_vendor.ref("");
    const quickQuestions = [
      "我的订单到哪了",
      "信用分怎么算",
      "怎么取消订单",
      "提现多久到账"
    ];
    common_vendor.onLoad(async () => {
      try {
        provider.value = await services_api.aiApi.providers();
      } catch {
        provider.value = "";
      }
    });
    async function scrollToBottom() {
      await common_vendor.nextTick$1();
      scrollTop.value = scrollTop.value === 0 ? 1 : 0;
      setTimeout(() => {
        scrollTop.value = 999999;
      }, 50);
    }
    async function send(text) {
      const content = (text || input.value).trim();
      if (!content || sending.value) return;
      input.value = "";
      messages.value.push({ role: "user", content });
      await scrollToBottom();
      sending.value = true;
      utils_haptics.haptic("light");
      try {
        const res = await services_api.aiApi.chat(messages.value.slice(-10));
        messages.value.push({ role: "assistant", content: res.text });
        if (res.orderId) {
          messages.value.push({
            role: "assistant",
            content: `__ORDER_LINK__${res.orderId}`
          });
        }
      } catch {
        messages.value.push({
          role: "assistant",
          content: "抱歉，智能助手暂时不可用，请稍后再试或联系人工客服。"
        });
      } finally {
        sending.value = false;
        await scrollToBottom();
      }
    }
    function goOrder(orderId) {
      common_vendor.index.navigateTo({ url: `/pages/order-detail/index?id=${orderId}` });
    }
    return (_ctx, _cache) => {
      return common_vendor.e({
        a: common_vendor.p({
          title: "在线客服",
          ["show-back"]: true,
          ["bg-class"]: "grad-brand"
        }),
        b: common_vendor.f(messages.value, (m, i, i0) => {
          return common_vendor.e({
            a: m.content.startsWith("__ORDER_LINK__")
          }, m.content.startsWith("__ORDER_LINK__") ? {
            b: common_vendor.o(($event) => goOrder(m.content.replace("__ORDER_LINK__", "")), i)
          } : {
            c: common_vendor.t(m.content),
            d: common_vendor.n(m.role === "user" ? "bubble-user" : "bubble-ai")
          }, {
            e: i,
            f: common_vendor.n(m.role === "user" ? "msg-right" : "msg-left")
          });
        }),
        c: sending.value
      }, sending.value ? {} : {}, {
        d: scrollTop.value,
        e: messages.value.length <= 1
      }, messages.value.length <= 1 ? {
        f: common_vendor.f(quickQuestions, (q, k0, i0) => {
          return {
            a: common_vendor.t(q),
            b: q,
            c: common_vendor.o(($event) => send(q), q)
          };
        })
      } : {}, {
        g: common_vendor.o(($event) => send()),
        h: input.value,
        i: common_vendor.o(($event) => input.value = $event.detail.value),
        j: !input.value.trim() || sending.value ? 1 : "",
        k: common_vendor.o(($event) => send())
      });
    };
  }
});
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["__scopeId", "data-v-1070971e"]]);
wx.createPage(MiniProgramPage);
