<template>
  <div v-loading="loading" class="dashboard">
    <!-- 统计卡片：2 行 4 列 -->
    <el-row :gutter="16">
      <el-col v-for="card in cards" :key="card.label" :span="6">
        <div class="stat-card" @click="card.to ? go(card.to) : undefined">
          <div class="stat-icon">{{ card.icon }}</div>
          <div class="stat-info">
            <div class="stat-label">{{ card.label }}</div>
            <div class="stat-value" :style="{ color: card.color || '#1f2d3d' }">{{ card.value }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 近 7 天订单趋势：双 Y 轴 -->
    <div class="page-card chart-card">
      <div class="card-title">近 7 天订单趋势</div>
      <div ref="chartRef" class="trend-chart" />
    </div>

    <!-- 待办事项 -->
    <div class="page-card todo-card">
      <div class="card-title">📌 待办事项</div>
      <template v-if="todos.length">
        <div v-for="todo in todos" :key="todo.text" class="todo-row" @click="go(todo.to)">
          <span class="todo-text">{{ todo.icon }} {{ todo.text }}</span>
          <span class="todo-action">{{ todo.action }} →</span>
        </div>
      </template>
      <el-empty v-else description="暂无待办事项" :image-size="60" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])
import { getDashboard } from '@/api/dashboard'
import { formatMoney } from '@/utils/format'
import type { DashboardData } from '@/types'

const router = useRouter()

const loading = ref(false)
const data = ref<DashboardData | null>(null)
const chartRef = ref<HTMLElement | null>(null)

let chart: echarts.ECharts | null = null
let refreshTimer: ReturnType<typeof setInterval> | null = null

const cards = computed(() => {
  const d = data.value
  return [
    { icon: '📦', label: '订单总数', value: d ? d.orders.total : '—', to: '/orders' },
    { icon: '⏳', label: '待接单', value: d ? d.orders.waiting_accept : '—', color: '#e6a23c', to: '/orders' },
    { icon: '💰', label: '今日成交', value: d ? formatMoney(d.orders.today_amount) : '—', color: '#14a152', to: '/finance' },
    { icon: '📊', label: '今日订单', value: d ? d.orders.today_total : '—', to: '/orders' },
    { icon: '👥', label: '用户总数', value: d ? d.users.total : '—', to: '/users' },
    { icon: '🏃', label: '跑腿员', value: d ? d.users.runners : '—', to: '/runner-applications' },
    { icon: '💳', label: '待提现', value: d ? d.pending.withdrawals : '—', color: d && d.pending.withdrawals ? '#f97316' : undefined, to: '/finance' },
    { icon: '⚠️', label: '超时单', value: d ? d.pending.overdueOrders : '—', color: d && d.pending.overdueOrders ? '#f56c6c' : undefined, to: '/orders' }
  ]
})

const todos = computed(() => {
  const d = data.value
  if (!d) return []
  const list: Array<{ icon: string; text: string; action: string; to: string }> = []
  if (d.pending.runnerApplications > 0) {
    list.push({ icon: '🏃', text: `${d.pending.runnerApplications} 个跑腿员申请待审核`, action: '去处理', to: '/runner-applications' })
  }
  if (d.pending.withdrawals > 0) {
    list.push({ icon: '💰', text: `${d.pending.withdrawals} 笔提现待审核`, action: '去处理', to: '/finance' })
  }
  if (d.pending.appealingOrders > 0) {
    list.push({ icon: '📢', text: `${d.pending.appealingOrders} 个订单申诉中`, action: '去处理', to: '/orders' })
  }
  if (d.pending.overdueOrders > 0) {
    list.push({ icon: '⏰', text: `${d.pending.overdueOrders} 个订单超时未接单`, action: '查看', to: '/orders' })
  }
  return list
})

function go(path: string) {
  router.push(path)
}

function renderChart() {
  if (!chartRef.value || !data.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  const trend = data.value.trend
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['订单数', '成交金额'], right: 8, top: 0 },
    grid: { left: 12, right: 12, top: 36, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map((t) => t.day.slice(5)),
      axisLine: { lineStyle: { color: '#c9d6ce' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '订单数',
        minInterval: 1,
        splitLine: { lineStyle: { color: '#eef2f0' } }
      },
      {
        type: 'value',
        name: '金额(¥)',
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '订单数',
        type: 'bar',
        data: trend.map((t) => t.order_count),
        barMaxWidth: 28,
        itemStyle: { color: '#14a152', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '成交金额',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        data: trend.map((t) => t.amount),
        lineStyle: { color: '#f97316', width: 2 },
        itemStyle: { color: '#f97316' },
        areaStyle: { color: 'rgba(249, 115, 22, 0.08)' }
      }
    ]
  })
}

function handleResize() {
  if (chart) chart.resize()
}

async function load() {
  loading.value = true
  try {
    data.value = await getDashboard()
    renderChart()
  } catch {
    // request.ts 已统一提示错误
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  // 每 60 秒自动刷新，离开页面时清除
  refreshTimer = setInterval(load, 60000)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  window.removeEventListener('resize', handleResize)
  if (chart) chart.dispose()
  chart = null
})
</script>

<style scoped lang="scss">
.dashboard {
  min-height: 200px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(14, 42, 29, 0.06);
  transition:
    transform 0.2s ease-out,
    box-shadow 0.2s ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(14, 42, 29, 0.1);
  }

  .stat-icon {
    font-size: 30px;
    line-height: 1;
  }

  .stat-label {
    font-size: 13px;
    color: #8a9a90;
    margin-bottom: 6px;
  }

  .stat-value {
    font-size: 28px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
}

.chart-card {
  margin-bottom: 16px;

  .trend-chart {
    height: 300px;
    margin-top: 8px;
  }
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #1f2d3d;
}

.todo-card {
  .todo-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 4px;
    border-bottom: 1px solid #f0f4f1;
    cursor: pointer;
    transition: background 0.15s ease-out;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: #f7faf8;
    }

    .todo-text {
      color: #3a4a40;
    }

    .todo-action {
      color: var(--el-color-primary);
      font-size: 13px;
    }
  }
}
</style>
