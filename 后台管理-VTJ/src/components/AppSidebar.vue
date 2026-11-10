<template>
  <aside class="sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="sidebar-brand">
      <span class="brand-logo">🏃</span>
      <span v-show="!collapsed" class="brand-text">智跑校园</span>
    </div>

    <nav class="sidebar-menu">
      <RouterLink
        v-for="item in menus"
        :key="item.path"
        :to="item.path"
        class="menu-item"
        :class="{ 'is-active': isActive(item.path) }"
        :title="collapsed ? item.label : ''">
        <span class="menu-icon">{{ item.icon }}</span>
        <span v-show="!collapsed" class="menu-label">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <div class="sidebar-foot">
      <span v-show="!collapsed" class="foot-text">v1.0.0</span>
    </div>
  </aside>
</template>

<script lang="ts" setup>
/**
 * 侧边栏导航
 *
 * 用 RouterLink 而不是 el-menu：路由即菜单，少一层映射，
 * 且高亮状态直接由当前路由推导，不会出现菜单与页面对不上。
 */
import { RouterLink, useRoute } from 'vue-router'

defineProps<{ collapsed: boolean }>()

const route = useRoute()

const menus = [
  { path: '/dashboard', icon: '📊', label: '数据看板' },
  { path: '/orders', icon: '📋', label: '订单管理' },
  { path: '/users', icon: '👤', label: '用户管理' },
  { path: '/runner-applications', icon: '🏃', label: '跑腿员审核' },
  { path: '/finance', icon: '💰', label: '财务中心' }
]

function isActive(path: string) {
  return route.path === path || route.path.startsWith(path + '/')
}
</script>

<style lang="scss" scoped>
.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-right: 1px solid var(--border);
  transition: width var(--dur) var(--ease);

  &.is-collapsed {
    width: 64px;
  }
}

.sidebar-brand {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
}

.brand-logo {
  font-size: 22px;
  flex-shrink: 0;
}

.brand-text {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.sidebar-menu {
  flex: 1;
  padding: 12px 0;
  overflow-y: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 20px;
  color: var(--text-2);
  text-decoration: none;
  font-size: 14px;
  white-space: nowrap;
  border-left: 3px solid transparent;
  transition: all var(--dur) var(--ease);

  &:hover {
    background: #f9fafb;
    color: var(--text-1);
  }

  &.is-active {
    background: var(--brand-light);
    color: var(--brand-600);
    border-left-color: var(--brand);
    font-weight: 600;
  }
}

.menu-icon {
  font-size: 16px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.sidebar-foot {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid var(--border);
}

.foot-text {
  font-size: 12px;
  color: var(--text-3);
}
</style>
