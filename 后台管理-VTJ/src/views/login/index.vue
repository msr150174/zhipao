<template>
  <div class="login-page">
    <div class="login-bg">
      <span class="blob blob-1"></span>
      <span class="blob blob-2"></span>
      <span class="blob blob-3"></span>
    </div>

    <div class="login-shell">
      <!-- 左侧品牌区 -->
      <div class="brand-panel">
        <div class="brand-badge">🏃‍♂️</div>
        <h1 class="brand-title">智跑校园</h1>
        <p class="brand-desc">一站式校园代取 · 代买 · 代送服务管理平台</p>
        <ul class="brand-points">
          <li><i class="pdot"></i><span>订单全流程实时追踪</span></li>
          <li><i class="pdot"></i><span>跑腿员申请与认证管理</span></li>
          <li><i class="pdot"></i><span>资金流水清晰透明</span></li>
        </ul>
        <div class="brand-foot">Campus Runner Admin Console</div>
      </div>

      <!-- 右侧表单区 -->
      <div class="form-panel">
        <h2 class="form-title">欢迎回来 👋</h2>
        <p class="form-sub">请使用管理员手机号登录后台</p>

        <ElForm
          ref="formRef"
          class="login-form"
          :model="__state"
          :rules="rules"
          label-position="top"
          @submit.prevent="() => {}">
          <ElFormItem prop="phone">
            <ElInput
              v-model="__state.phone"
              size="large"
              clearable
              maxlength="11"
              placeholder="请输入 11 位手机号"
              @keyup.enter="focusCode">
              <template #prefix><span class="input-icon">👤</span></template>
            </ElInput>
          </ElFormItem>

          <ElFormItem prop="code">
            <div class="code-row">
              <ElInput
                ref="codeRef"
                v-model="__state.code"
                size="large"
                maxlength="6"
                placeholder="6 位验证码"
                @keyup.enter="handleLogin">
                <template #prefix><span class="input-icon">🔒</span></template>
              </ElInput>
              <ElButton
                class="code-btn"
                size="large"
                :disabled="!phoneValid || counting > 0"
                :loading="sending"
                @click="handleSendCode">
                {{ counting > 0 ? `${counting}s 后重发` : '获取验证码' }}
              </ElButton>
            </div>
          </ElFormItem>

          <div class="form-row">
            <ElCheckbox v-model="__state.remember">记住手机号</ElCheckbox>
            <span class="link" @click="showHelp">收不到验证码？</span>
          </div>

          <ElButton
            size="large"
            type="primary"
            class="submit-btn"
            :loading="loading"
            :disabled="!canSubmit"
            @click="handleLogin">
            登 录
          </ElButton>
        </ElForm>

        <p class="tip">
          <span>演示手机号：</span>
          <b>13800001234</b>
        </p>
      </div>
    </div>

    <div class="login-copyright">© 2024 智跑校园 · 智慧校园跑腿平台</div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 登录页
 *
 * 后端是「手机号 + 短信验证码」登录，不是用户名密码。
 * 开发模式下验证码不真的发短信，而是打印在后端控制台日志里。
 */
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ElForm,
  ElFormItem,
  ElInput,
  ElCheckbox,
  ElButton,
  ElMessage,
  ElMessageBox
} from 'element-plus'
import type { FormInstance, InputInstance } from 'element-plus'
import { useProvider, useStore } from '@/vtj-compat'

const PHONE_KEY = 'zhipao_login_phone'

const __provider = useProvider({ id: '13ptnvaho', version: '1' })
const __store = useStore()
const __router = useRouter()
const __route = useRoute()

const formRef = ref<FormInstance>()
const codeRef = ref<InputInstance>()

const loading = ref(false)
const sending = ref(false)
const counting = ref(0)
let timer: number | undefined

const rules = reactive({
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  code: [
    { required: true, message: '请输入验证码', trigger: 'blur' },
    { len: 6, message: '验证码为 6 位', trigger: 'blur' }
  ]
})

const __state: any = reactive({ phone: '', code: '', remember: true })

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(__state.phone))
const canSubmit = computed(() => phoneValid.value && __state.code.length === 6)

function focusCode() {
  codeRef.value?.focus()
}

/** 开发模式验证码不会发到手机，直接告诉用户去哪找 */
function showHelp() {
  ElMessageBox.alert(
    '开发模式下短信不会真实发送。<br/>请在后端控制台日志中查找：<br/><code>【开发模式】手机号 xxx 的验证码为 XXXXXX</code>',
    '如何获取验证码',
    { dangerouslyUseHTMLString: true, confirmButtonText: '知道了' }
  )
}

async function handleSendCode() {
  if (!phoneValid.value || counting.value > 0) return
  sending.value = true
  try {
    await __provider.apis['sendSmsCode']({ phone: __state.phone })
    ElMessage.success('验证码已发送，请查看后端控制台日志')
    counting.value = 60
    timer = window.setInterval(() => {
      counting.value -= 1
      if (counting.value <= 0) {
        window.clearInterval(timer)
        timer = undefined
      }
    }, 1000)
  } catch {
    /* request.ts 已统一提示 */
  } finally {
    sending.value = false
  }
}

async function handleLogin() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const payload: any = (await __provider.apis['login']({
      phone: __state.phone,
      code: __state.code
    })) as { token: string; role: string; userInfo: Record<string, unknown> }

    if (!payload.userInfo?.isAdmin) {
      ElMessage.error('该账号没有管理权限')
      return
    }

    __store.setUser({
      token: payload.token,
      userInfo: payload.userInfo as never,
      role: payload.role,
      isAdmin: true
    })

    if (__state.remember) {
      localStorage.setItem(PHONE_KEY, __state.phone)
    } else {
      localStorage.removeItem(PHONE_KEY)
    }

    ElMessage.success('登录成功，正在进入后台…')
    const redirect = (__route.query.redirect as string) || '/dashboard'
    setTimeout(() => __router.replace(redirect), 300)
  } catch {
    /* request.ts 已提示具体错误 */
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  __state.phone = localStorage.getItem(PHONE_KEY) || '13800001234'
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  overflow: hidden;
  background:
    radial-gradient(1200px 600px at 10% 0%, #ecfdf5 0%, transparent 60%),
    radial-gradient(900px 500px at 95% 100%, #f0fdf4 0%, transparent 55%),
    linear-gradient(160deg, #f6f8fa 0%, #eef7f1 100%);
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  opacity: 0.55;
}

.blob-1 {
  width: 380px;
  height: 380px;
  top: -120px;
  left: -80px;
  background: rgba(34, 197, 94, 0.28);
}

.blob-2 {
  width: 320px;
  height: 320px;
  bottom: -100px;
  right: -60px;
  background: rgba(16, 185, 129, 0.22);
}

.blob-3 {
  width: 240px;
  height: 240px;
  top: 40%;
  right: 22%;
  background: rgba(74, 222, 128, 0.18);
}

.login-shell {
  position: relative;
  z-index: 2;
  display: flex;
  width: 940px;
  max-width: 100%;
  min-height: 540px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(16, 24, 40, 0.12);
  overflow: hidden;
}

/* 品牌区 */
.brand-panel {
  width: 44%;
  padding: 48px 40px;
  color: #ffffff;
  background: linear-gradient(155deg, #22c55e 0%, #16a34a 55%, #15803d 100%);
  display: flex;
  flex-direction: column;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: -60px;
    bottom: -80px;
    width: 240px;
    height: 240px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
  }
}

.brand-badge {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.brand-title {
  margin: 22px 0 10px;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 2px;
}

.brand-desc {
  margin: 0 0 28px;
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.9);
}

.brand-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;

  li {
    display: flex;
    align-items: center;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.95);
  }
}

.pdot {
  width: 8px;
  height: 8px;
  margin-right: 10px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.22);
}

.brand-foot {
  margin-top: auto;
  font-size: 12px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.7);
}

/* 表单区 */
.form-panel {
  flex: 1;
  padding: 56px 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-1);
}

.form-sub {
  margin: 0 0 28px;
  font-size: 13px;
  color: var(--text-2);
}

.code-row {
  display: flex;
  gap: 10px;
  width: 100%;
}

.code-btn {
  flex-shrink: 0;
  min-width: 120px;
}

.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: var(--radius);
  box-shadow: 0 0 0 1px var(--border) inset;
  padding: 2px 12px;
  transition: all 0.2s ease;
}

.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #86efac inset;
}

.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 1px #22c55e inset,
    0 0 0 3px rgba(34, 197, 94, 0.14);
}

.input-icon {
  font-size: 15px;
  line-height: 1;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.link {
  font-size: 13px;
  color: var(--brand-600);
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 4px;
  border-radius: var(--radius);
  box-shadow: 0 10px 20px rgba(34, 197, 94, 0.25);
}

.tip {
  margin: 22px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);

  b {
    color: var(--brand-600);
  }
}

.login-copyright {
  position: absolute;
  bottom: 18px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
  z-index: 2;
}

@media (max-width: 820px) {
  .login-shell {
    flex-direction: column;
    min-height: auto;
  }

  .brand-panel {
    width: 100%;
    padding: 32px 28px;
  }

  .brand-points {
    display: none;
  }

  .form-panel {
    padding: 32px 24px 40px;
  }

  .login-copyright {
    position: static;
    margin-top: 20px;
  }
}
</style>
