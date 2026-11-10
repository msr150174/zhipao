<template>
  <header class="app-header">
    <div class="header-left">
      <button class="collapse-btn" :title="collapsed ? '展开' : '收起'" @click="$emit('toggle')">
        {{ collapsed ? '☰' : '⇤' }}
      </button>
      <span class="page-title">{{ pageTitle }}</span>
    </div>

    <div class="header-right">
      <button class="icon-btn" title="刷新" @click="reload">🔄</button>

      <el-dropdown trigger="click" @command="onCommand">
        <span class="user-chip">
          <span class="avatar">{{ avatarText }}</span>
          <span class="user-name">{{ displayName }}</span>
          <span class="caret">▾</span>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="profile" disabled>{{ displayName }}</el-dropdown-item>
            <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </header>
</template>

<script lang="ts" setup>
/**
 * 顶栏
 *
 * 显示当前页面标题（从路由 meta 推导）与管理员信息。
 * 刷新按钮直接 reload 当前页面，最省事也最符合管理员直觉。
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElDropdown, ElDropdownMenu, ElDropdownItem, ElMessage } from 'element-plus'
import { useStore } from '@/vtj-compat'

defineProps<{ collapsed: boolean }>()
defineEmits<{ toggle: [] }>()

const route = useRoute()
const router = useRouter()
const store = useStore()

const pageTitle = computed(() => (route.meta?.title as string) || '智跑校园后台')

const displayName = computed(() => {
  const u = store.userInfo
  return u?.name || u?.nickname || '管理员'
})

const avatarText = computed(() => displayName.value.slice(0, 1))

function reload() {
  window.location.reload()
}

async function onCommand(cmd: string) {
  if (cmd !== 'logout') return
  store.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<style lang="scss" scoped>
.app-header {
  height: 60px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: #ffffff;
  border-bottom: 1px solid var(--border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
  color: var(--text-2);
  cursor: pointer;
  font-size: 14px;
  transition: all var(--dur) var(--ease);

  &:hover {
    border-color: var(--brand);
    color: var(--brand-600);
  }
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  transition: background var(--dur) var(--ease);

  &:hover {
    background: #f3f4f6;
  }
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  cursor: pointer;
  outline: none;
  transition: background var(--dur) var(--ease);

  &:hover {
    background: #f3f4f6;
  }
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-light);
  color: var(--brand-700);
  font-size: 13px;
  font-weight: 600;
}

.user-name {
  font-size: 14px;
  color: var(--text-1);
}

.caret {
  font-size: 10px;
  color: var(--text-3);
}
</style>
