import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/login/index.vue'),
      meta: { title: '登录' }
    },
    {
      path: '/',
      component: () => import('@/layout/AdminLayout.vue'),
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/dashboard/index.vue'),
          meta: { title: '数据看板' }
        },
        {
          path: 'orders',
          name: 'Orders',
          component: () => import('@/views/order/index.vue'),
          meta: { title: '订单管理' }
        },
        {
          path: 'users',
          name: 'Users',
          component: () => import('@/views/user/index.vue'),
          meta: { title: '用户管理' }
        },
        {
          path: 'runner-applications',
          name: 'RunnerApplications',
          component: () => import('@/views/runner/index.vue'),
          meta: { title: '跑腿员审核' }
        },
        {
          path: 'finance',
          name: 'Finance',
          component: () => import('@/views/finance/index.vue'),
          meta: { title: '资金管理' }
        }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

// 登录守卫：未登录访问任何页面 → /login
router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('zhipao_admin_token')

  if (to.path === '/login') {
    next()
    return
  }

  if (!token) {
    next('/login')
    return
  }

  next()
})

export default router
