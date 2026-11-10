<template>
<div class="finance-page">
  <div class="page-header">
    <div class="page-title">
      <h2>财务中心</h2>
      <p class="page-desc">平台资金收支概览与流水明细</p>
    </div>
    <div class="page-actions">
      <ElDatePicker
        v-model="__state.dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        end-placeholder="结束日期"
        range-separator="至"
        start-placeholder="开始日期"
        @change="handleSearch"></ElDatePicker>
      <ElButton type="primary" @click="loadAll"> 刷新</ElButton>
    </div>
  </div>
  <div class="stat-grid">
    <StatCard
      icon="💰"
      title="总收入"
      :value="__state.overview.totalIncome"
      prefix="¥"
      trend-type="up"></StatCard>
    <StatCard
      icon="📤"
      title="总支出"
      :value="__state.overview.totalExpense"
      prefix="¥"
      trend-type="down"></StatCard>
    <StatCard
      icon="🏦"
      title="平台服务费"
      :value="__state.overview.platformFee"
      prefix="¥"
      trend-type="up"></StatCard>
    <StatCard
      icon="🛵"
      title="跑腿员结算"
      :value="__state.overview.runnerPayout"
      prefix="¥"
      trend-type="neutral"></StatCard>
  </div>
  <ElCard class="table-card" shadow="never">
    <div class="table-head">
      <span class="table-title"> 资金流水</span>
      <span class="table-sub">
        <span>
          <span> 共</span>
          <span> {{ __state.total }}</span>
          <span> 条记录</span></span
        ></span
      >
    </div>
    <ElTable
      :data="__state.records"
      :style="{ width: '100%' }" stripe
      class="ElTable_6ncptnzkst">
      <ElTableColumn
        prop="trade_no"
        label="交易号"
        min-width="170"></ElTableColumn>
      <ElTableColumn prop="type" label="类型" width="110">
        <template #default="scope">
          <ElTag
            :type="scope.row.type === '收入' ? 'success' : 'danger'"
            effect="light">
            {{ scope.row.type }}</ElTag
          >
        </template></ElTableColumn
      >
      <ElTableColumn prop="amount" label="金额" width="140">
        <template #default="scope">
          <span
            :class="scope.row.type === '收入' ? 'amount-in' : 'amount-out'">
            <span>
              <span> {{ scope.row.type === '收入' ? '+' : '-' }}</span>
              <span> {{ formatMoney(scope.row.amount) }}</span></span
            ></span
          >
        </template></ElTableColumn
      >
      <ElTableColumn
        prop="order_no"
        label="关联订单号"
        min-width="170"></ElTableColumn>
      <ElTableColumn
        prop="create_time"
        label="交易时间"
        min-width="180"></ElTableColumn
    ></ElTable>
    <div class="pager">
      <ElPagination
        v-model:current-page="__state.pagination.page"
        v-model:page-size="__state.pagination.size"
        :total="__state.total"
        layout="total, sizes, prev, pager, next" background
        :page-sizes="[10, 20, 50]"
        @size-change="handleSearch"
        @current-change="loadRecords"></ElPagination></div
  ></ElCard>
</div>
</template>
<script lang="ts" setup>
import {useProvider } from '@/vtj-compat';
import { reactive, onMounted } from 'vue';
import {
  ElDatePicker,
  ElButton,
  ElCard,
  ElTable,
  ElTableColumn,
  ElTag,
  ElPagination
} from 'element-plus';
import StatCard from '@/components/StatCard.vue';

const __provider = useProvider({ id: '1lptnz7fy', version: '1791907318562' });

const __state: any = reactive({
  total: 0,
  loading: false,
  records: [],
  overview: {
    totalIncome: 0,
    totalExpense: 0,
    platformFee: 0,
    runnerPayout: 0
  },
  dateRange: [],
  pagination: { page: 1, size: 10 }
});
const loadAll = () => {
  loadOverview();
  loadRecords();
};
const formatMoney = (val: any) => {
  return '¥' + formatAmount(val);
};
const loadRecords = () => {
  __state.loading = true;
  const params: any = {
    page: __state.pagination.page,
    size: __state.pagination.size
  };
  if (__state.dateRange && __state.dateRange.length === 2) {
    params.startDate = __state.dateRange[0];
    params.endDate = __state.dateRange[1];
  }
  return __provider.apis['getFinanceRecords'](params)
    .then((res: any) => {
      const data: any = res && res.data ? res.data : res;
      __state.records = (data && data.list) || [];
      __state.total = (data && data.total) || 0;
      __state.loading = false;
      return res;
    })
    .catch(() => {
      __state.loading = false;
    });
};
const formatAmount = (val: any) => {
  if (val === null || val === undefined || val === '') return '0.00';
  return Number(val).toFixed(2);
};
const handleSearch = () => {
  __state.pagination.page = 1;
  loadRecords();
};
const loadOverview = () => {
  return __provider.apis['getFinanceOverview']().then((res: any) => {
    const data: any = res && res.data ? res.data : res;
    __state.overview = Object.assign({}, __state.overview, data || {});
    return res;
  });
};

onMounted(() => {
  loadAll();
})
</script>
<style lang="css" scoped>
.finance-page {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space);
  flex-wrap: wrap;
}
.page-title h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
}
.page-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.page-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space);
}
.table-card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
}
.table-card :deep(.el-card__body) {
  padding: var(--space-lg);
}
.table-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin-bottom: var(--space);
}
.table-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.table-sub {
  font-size: 12px;
  color: var(--text-3);
}
.amount-in {
  color: var(--brand-600);
  font-weight: 600;
}
.amount-out {
  color: #dc2626;
  font-weight: 600;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space);
}
@media (max-width: 1100px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
