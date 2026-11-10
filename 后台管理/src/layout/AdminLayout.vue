<template>
  <el-container class="admin-layout">
    <!-- 侧边栏：墨绿渐变，200px 可折叠至 64px -->
    <el-aside :width="collapsed ? '64px' : '200px'" class="sidebar">
      <div class="logo" @click="go('/dashboard')">
        <span class="logo-icon">🏃</span>
        <span v-show="!collapsed" class="logo-text">智跑校园后台</span>
      </div>
      <el-menu
        class="side-menu"
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <template #title>数据看板</template>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <template #title>订单管理</template>
        </el-menu-item>
        <el-menu-item index="/users">
          <el-icon><User /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item index="/runner-applications">
          <el-icon><Bicycle /></el-icon>
          <template #title>跑腿员审核</template>
        </el-menu-item>
        <el-menu-item index="/finance">
          <el-icon><Wallet /></el-icon>
          <template #title>资金管理</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="body-container">
      <!-- 顶栏 60px：左侧标题，右侧管理员 + 退出 -->
      <el-header class="header" height="60px">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed">
            <Fold v-if="!collapsed" />
            <Expand v-else />
          </el-icon>
          <span class="page-title">{{ route.meta.title || '智跑校园' }}</span>
        </div>
        <div class="header-right">
          <el-tag type="success" effect="plain" size="small" class="admin-badge">管理员</el-tag>
          <span class="admin-name">{{ store.userInfo ? store.userInfo.nickname : '管理员' }}</span>
          <el-button text class="logout-btn" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
            <span>退出</span>
          </el-button>
        </div>
      </el-header>

      <el-main class="main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  Bicycle,
  DataAnalysis,
  Expand,
  Fold,
  SwitchButton,
  Tickets,
  User,
  Wallet
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

const collapsed = ref(false)

const activeMenu = computed(() => route.path)

function go(path: string) {
  router.push(path)
}

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出登录？', '退出', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  await store.logout()
  router.push('/login')
}

onMounted(() => {
  // 刷新页面后恢复管理员昵称
  if (store.token && !store.userInfo) {
    store.fetchMe().catch(() => {
      // token 失效时 request.ts 已统一跳转登录
    })
  }
})
</script>

<style scoped lang="scss">
.admin-layout {
  height: 100%;
}

.sidebar {
  background: linear-gradient(180deg, var(--zp-sidebar-from) 0%, var(--zp-sidebar-to) 100%);
  transition: width 0.2s ease-out;
  overflow: hidden;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 16px;
    cursor: pointer;
    white-space: nowrap;

    .logo-icon {
      font-size: 24px;
      line-height: 1;
    }

    .logo-text {
      color: #fff;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 1px;
    }
  }

  .side-menu {
    border-right: none;
    background: transparent;
    padding: 8px;

    :deep(.el-menu-item) {
      color: #9fb8aa;
      border-radius: 6px;
      margin-bottom: 4px;
      height: 44px;
      line-height: 44px;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #d8e6dd;
      }

      &.is-active {
        background: var(--el-color-primary);
        color: #fff;
      }
    }
  }
}

.body-container {
  min-width: 0;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8eeea;
  padding: 0 20px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 14px;

    .collapse-btn {
      font-size: 18px;
      cursor: pointer;
      color: #5a6b62;
      transition: color 0.15s ease-out;

      &:hover {
        color: var(--el-color-primary);
      }
    }

    .page-title {
      font-size: 18px;
      font-weight: 600;
      color: #1f2d3d;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;

    .admin-name {
      font-weight: 500;
      color: #1f2d3d;
    }

    .logout-btn {
      color: #5a6b62;

      &:hover {
        color: var(--el-color-danger);
      }
    }
  }
}

.main {
  background: var(--zp-bg);
  padding: 16px 20px;
  overflow-y: auto;
}
</style>
