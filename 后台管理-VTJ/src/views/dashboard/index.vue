<template>
<div class="dashboard">
  <div class="page-head">
    <div class="head-left">
      <h2 class="page-title">仪表盘</h2>
      <p class="page-sub">校园跑腿平台运营数据总览</p>
    </div>
    <ElButton
      type="primary" plain
      :loading="__state.loading"
      @click="loadAll">
      刷新数据</ElButton
    >
  </div>
  <div class="stat-grid">
    <StatCard
      icon="📦"
      title="累计订单"
      trend="+12.5%"
      :value="__state.stats.totalOrders"
      accent="#22C55E"
      trend-type="up"></StatCard>
    <StatCard
      icon="🧾"
      title="今日订单"
      trend="+6.2%"
      :value="__state.stats.todayOrders"
      accent="#0EA5E9"
      trend-type="up"></StatCard>
    <StatCard
      icon="👥"
      title="活跃用户"
      trend="+3.1%"
      :value="__state.stats.activeUsers"
      accent="#8B5CF6"
      trend-type="up"></StatCard>
    <StatCard
      icon="🏃"
      title="跑腿员"
      trend="-1.4%"
      :value="__state.stats.runnerCount"
      accent="#F59E0B"
      trend-type="down"></StatCard>
    <StatCard
      icon="💰"
      title="累计收入"
      trend="+18.9%"
      :value="formatMoney(__state.stats.revenue)"
      accent="#22C55E"
      prefix="¥"
      trend-type="up"></StatCard>
    <StatCard
      icon="⏳"
      title="待处理"
      :value="__state.stats.pendingCount"
      accent="#EF4444"></StatCard>
  </div>
  <div class="vtj-card chart-card">
    <div class="card-head">
      <h3 class="card-title">近 7 日趋势</h3>
      <ElTag type="success" round effect="light"> 订单 / 收入</ElTag>
    </div>
    <TrendChart
      :dates="__state.trend.dates"
      :orders="__state.trend.orders"
      :revenue="__state.trend.revenue"></TrendChart>
  </div>
</div>
</template>
<script lang="ts" setup>
import {useProvider } from '@/vtj-compat';
import { reactive, onMounted } from 'vue';
import { ElButton, ElTag } from 'element-plus';
import StatCard from '@/components/StatCard.vue';
import TrendChart from '@/components/TrendChart.vue';

const __provider = useProvider({ id: '19ptnw8au', version: '1791907268968' });

const __state: any = reactive({
  stats: {
    totalOrders: 0,
    todayOrders: 0,
    activeUsers: 0,
    runnerCount: 0,
    revenue: 0,
    pendingCount: 0
  },
  trend: { dates: [], orders: [], revenue: [] },
  loading: false
});
const loadAll = async () => {
  __state.loading = true;
  try {
    await Promise.all([loadStats(), loadTrend()]);
  } catch (err) {
    console.error(err);
  } finally {
    __state.loading = false;
  }
};
const pickData = (res: any) => {
  if (res && typeof res === 'object' && res.data !== undefined) {
    return res.data;
  }
  return res;
};
const loadStats = async () => {
  const res: any = await __provider.apis['getDashboardStats']();
  const data: any = pickData(res) || {};
  __state.stats = {
    totalOrders: data.totalOrders || 0,
    todayOrders: data.todayOrders || 0,
    activeUsers: data.activeUsers || 0,
    runnerCount: data.runnerCount || 0,
    revenue: data.revenue || 0,
    pendingCount: data.pendingCount || 0
  };
};
const loadTrend = async () => {
  const res: any = await __provider.apis['getDashboardTrend']();
  const data: any = pickData(res) || {};
  __state.trend = {
    dates: data.dates || [],
    orders: data.orders || [],
    revenue: data.revenue || []
  };
};
const formatMoney = (value: any) => {
  const num = Number(value || 0);
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

onMounted(() => {
  loadAll();
})
</script>
<style lang="css" scoped>
.dashboard {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space);
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
  letter-spacing: -0.01em;
}
.page-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space);
}
.chart-card {
  padding: var(--space-lg);
  min-height: 380px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space);
}
.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
</style>
