<template>
  <div class="login-page">
    <div class="login-card">
      <div class="brand">
        <div class="brand-icon">🏃</div>
        <h1 class="brand-name">智跑校园</h1>
        <p class="brand-sub">运营管理后台</p>
      </div>

      <el-form class="login-form" @submit.prevent="submit">
        <el-form-item>
          <el-input
            v-model="phone"
            size="large"
            placeholder="手机号"
            maxlength="11"
            :prefix-icon="Iphone"
          />
        </el-form-item>

        <el-form-item>
          <div class="code-row">
            <el-input
              v-model="code"
              size="large"
              placeholder="验证码"
              maxlength="6"
              :prefix-icon="Key"
              @keyup.enter="submit"
            />
            <el-button
              size="large"
              class="code-btn"
              :disabled="counting || sending"
              :loading="sending"
              @click="sendCode"
            >
              {{ counting ? `${countdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>

        <el-alert
          v-if="devTip"
          :title="devTip"
          type="warning"
          :closable="false"
          show-icon
          class="dev-tip"
        />

        <el-button
          type="primary"
          size="large"
          class="submit-btn"
          :loading="loading"
          native-type="submit"
        >
          登 录
        </el-button>
      </el-form>

      <p class="admin-tip">
        <el-icon><WarningFilled /></el-icon>
        仅管理员可登录
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Iphone, Key, WarningFilled } from '@element-plus/icons-vue'
import { sendSmsCode } from '@/api/auth'
import { NO_ADMIN_ERROR, useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()

const phone = ref('')
const code = ref('')
const loading = ref(false)
const sending = ref(false)
const counting = ref(false)
const countdown = ref(60)
const devTip = ref('')

let timer: ReturnType<typeof setInterval> | null = null

const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phone.value))

function startCountdown() {
  counting.value = true
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      stopCountdown()
    }
  }, 1000)
}

function stopCountdown() {
  counting.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function sendCode() {
  if (!phoneValid.value) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  sending.value = true
  try {
    const res = await sendSmsCode(phone.value)
    if (res.devMode) {
      // 开发模式：验证码不发短信，打印在后端控制台
      devTip.value = res.devCode
        ? `开发模式：演示验证码 ${res.devCode}`
        : '开发模式：验证码见服务端日志'
    } else {
      devTip.value = ''
    }
    ElMessage.success('验证码已发送')
    startCountdown()
  } catch {
    // request.ts 已统一提示错误
  } finally {
    sending.value = false
  }
}

async function submit() {
  if (!phoneValid.value) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  if (!/^\d{6}$/.test(code.value)) {
    ElMessage.warning('请输入 6 位数字验证码')
    return
  }
  loading.value = true
  try {
    const user = await store.login(phone.value, code.value)
    ElMessage.success(`欢迎回来，${user.nickname}`)
    router.push('/dashboard')
  } catch (e) {
    // ★ 登录成功但非管理员：拒绝进入后台
    if (e instanceof Error && e.message === NO_ADMIN_ERROR) {
      ElMessage.error('无管理权限')
    }
    // 其余错误 request.ts 已提示
  } finally {
    loading.value = false
  }
}

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped lang="scss">
.login-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(1200px 500px at 80% -10%, rgba(20, 161, 82, 0.16), transparent 60%),
    linear-gradient(160deg, #0e2a1d 0%, #123726 55%, #14a152 130%);
  padding: 24px;
}

.login-card {
  width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 36px 32px 28px;
  box-shadow: 0 12px 40px rgba(14, 42, 29, 0.25);
}

.brand {
  text-align: center;
  margin-bottom: 28px;

  .brand-icon {
    font-size: 40px;
    line-height: 1;
  }

  .brand-name {
    margin: 10px 0 4px;
    font-size: 24px;
    font-weight: 700;
    color: #123726;
    letter-spacing: 2px;
  }

  .brand-sub {
    margin: 0;
    font-size: 13px;
    color: #8a9a90;
    letter-spacing: 4px;
  }
}

.login-form {
  .code-row {
    display: flex;
    gap: 10px;
    width: 100%;

    .code-btn {
      flex-shrink: 0;
      width: 118px;
    }
  }

  .dev-tip {
    margin-bottom: 18px;
  }

  .submit-btn {
    width: 100%;
    letter-spacing: 8px;
    font-weight: 600;
  }
}

.admin-tip {
  margin: 18px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
  color: var(--zp-urgent);
}
</style>
