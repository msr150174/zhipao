<template>
<div class="order-page">
  <div class="page-header">
    <div>
      <h2 class="page-title">订单管理</h2>
      <p class="page-desc">查看并管理平台的全部订单信息</p>
    </div>
    <ElTag type="success" round effect="light">
      <span>
        <span> 共</span>
        <span> {{ __state.total }}</span>
        <span> 条订单</span></span
      ></ElTag
    >
  </div>
  <ElCard class="filter-card" shadow="never">
    <ElForm :model="__state.query" inline>
      <ElFormItem label="订单号">
        <ElInput
          v-model="__state.query.orderNo"
          :style="{ width: '180px' }" clearable
          placeholder="请输入订单号"
          class="ElInput_6diptnxqgw"></ElInput
      ></ElFormItem>
      <ElFormItem label="用户">
        <ElInput
          v-model="__state.query.userName"
          :style="{ width: '160px' }" clearable
          placeholder="请输入用户名称"
          class="ElInput_6dkptnxqgw"></ElInput
      ></ElFormItem>
      <ElFormItem label="订单状态">
        <ElSelect
          v-model="__state.query.status"
          :style="{ width: '150px' }" clearable
          placeholder="全部状态"
          class="ElSelect_6dmptnxqgw">
          <ElOption label="待接单" value="待接单"></ElOption>
          <ElOption label="配送中" value="配送中"></ElOption>
          <ElOption label="已完成" value="已完成"></ElOption>
          <ElOption label="已取消" value="已取消"></ElOption></ElSelect
      ></ElFormItem>
      <ElFormItem>
        <ElButton type="primary" @click="handleSearch"> 查询</ElButton>
        <ElButton @click="handleReset"> 重置</ElButton></ElFormItem
      ></ElForm
    ></ElCard
  >
  <ElCard class="table-card" shadow="never">
    <ElTable
      :data="__state.list"
      :style="{ width: '100%' }" stripe
      class="ElTable_6dvptnxqgw">
      <ElTableColumn
        prop="order_no"
        label="订单号"
        min-width="150"></ElTableColumn>
      <ElTableColumn
        prop="user_name"
        label="用户"
        min-width="110"></ElTableColumn>
      <ElTableColumn
        prop="address"
        label="配送地址"
        min-width="200" show-overflow-tooltip></ElTableColumn>
      <ElTableColumn prop="amount" align="right" label="金额" min-width="110">
        <template #default="{ row }">
          <span class="amount">
            <span>
              <span> ¥</span>
              <span> {{ formatMoney(row.amount) }}</span></span
            ></span
          >
        </template></ElTableColumn
      >
      <ElTableColumn
        prop="status"
        align="center"
        label="状态"
        min-width="110">
        <template #default="{ row }">
          <ElTag :type="statusType((row.status as any))" round effect="light">
            {{ row.status }}</ElTag
          >
        </template></ElTableColumn
      >
      <ElTableColumn
        prop="create_time"
        label="下单时间"
        min-width="170"></ElTableColumn>
      <ElTableColumn align="center" fixed="right" label="操作" width="100">
        <template #default="{ row }">
          <ElButton link type="primary" @click="openDetail(row)">
            详情</ElButton
          >
        </template></ElTableColumn
      ></ElTable
    >
    <div class="pager">
      <ElPagination
        v-model:current-page="__state.page"
        v-model:page-size="__state.pageSize"
        :total="__state.total"
        layout="total, sizes, prev, pager, next, jumper" background
        :page-sizes="[10, 20, 50, 100]"
        @size-change="handleSizeChange"
        @current-change="loadOrders"></ElPagination></div
  ></ElCard>
  <ElDrawer v-model="__state.detailVisible" size="440px" title="订单详情">
    <div class="detail">
      <div class="detail-head">
        <span class="detail-no">
          <span>
            <span> #</span>
            <span> {{ __state.detail.order_no || '-' }}</span></span
          ></span
        >
        <ElTag
          v-if="__state.detail.status"
          :type="statusType(__state.detail.status)" round
          effect="light">
          {{ __state.detail.status }}</ElTag
        >
      </div>
      <ElDescriptions size="small" border :column="1">
        <ElDescriptionsItem label="下单用户">
          {{ __state.detail.user_name || '-' }}</ElDescriptionsItem
        >
        <ElDescriptionsItem label="接单跑腿员">
          {{ __state.detail.runner_name || '待分配' }}</ElDescriptionsItem
        >
        <ElDescriptionsItem label="订单金额">
          <span class="amount">
            <span>
              <span> ¥</span>
              <span> {{ formatMoney(__state.detail.amount) }}</span></span
            ></span
          ></ElDescriptionsItem
        >
        <ElDescriptionsItem label="配送地址">
          {{ __state.detail.address || '-' }}</ElDescriptionsItem
        >
        <ElDescriptionsItem label="下单时间">
          {{ __state.detail.create_time || '-' }}</ElDescriptionsItem
        >
        <ElDescriptionsItem label="备注">
          {{ __state.detail.remark || '无' }}</ElDescriptionsItem
        ></ElDescriptions
      >
      <div class="timeline">
        <h4 class="timeline-title">订单动态</h4>
        <ElTimeline v-if="timelineList.length">
          <ElTimelineItem
            v-for="(item, index) in timelineList"
            :key="index"
            :timestamp="item.time">
            {{ item.text }}</ElTimelineItem
          ></ElTimeline
        >
        <ElEmpty v-else :image-size="80" description="暂无动态"></ElEmpty>
      </div></div
  ></ElDrawer>
</div>
</template>
<script lang="ts" setup>
import {useProvider } from '@/vtj-compat';
import { reactive, computed, onMounted } from 'vue';
import {
  ElTag,
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElButton,
  ElTable,
  ElTableColumn,
  ElPagination,
  ElDrawer,
  ElDescriptions,
  ElDescriptionsItem,
  ElTimeline,
  ElTimelineItem,
  ElEmpty
} from 'element-plus';

const __provider = useProvider({ id: '1cptnwwek', version: '1791907278945' });

const timelineList = computed(() => {
  const list: any = __state.detail && __state.detail.timeline;
  return Array.isArray(list) ? list : [];
});
const __state: any = reactive({
  list: [],
  page: 1,
  query: { orderNo: '', userName: '', status: '' },
  total: 0,
  detail: {},
  loading: false,
  pageSize: 20,
  detailLoading: false,
  detailVisible: false
});
const unwrap = (res: any) => {
  if (!res || typeof res !== 'object') return {};
  if (res.data && typeof res.data === 'object') {
    return res.data.data !== undefined ? res.data.data : res.data;
  }
  return res;
};
const loadOrders = async () => {
  __state.loading = true;
  try {
    const res: any = await __provider.apis['getOrderList'](null, {
      params: {
        page: __state.page,
        pageSize: __state.pageSize,
        orderNo: __state.query.orderNo,
        userName: __state.query.userName,
        status: __state.query.status
      }
    });
    const payload: any = unwrap(res);
    __state.list = (payload && payload.list) || [];
    __state.total = (payload && payload.total) || 0;
  } catch (e) {
    __state.list = [];
    __state.total = 0;
  } finally {
    __state.loading = false;
  }
};
const openDetail = async (row: any) => {
  __state.detailVisible = true;
  __state.detailLoading = true;
  __state.detail = {};
  try {
    const res: any = await __provider.apis['getOrderDetail'](null, {
      params: { id: row.id }
    });
    const payload: any = unwrap(res);
    __state.detail = payload || {};
  } catch (e) {
    __state.detail = {};
  } finally {
    __state.detailLoading = false;
  }
};
/** 订单状态 -> el-tag 颜色（键为后端返回的中文状态文案） */
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
const statusType = (status: any): TagType => {
  const map: Record<string, TagType> = {
    待接单: 'warning',
    已接单: 'primary',
    取件中: 'primary',
    配送中: 'primary',
    待确认: 'info',
    已完成: 'success',
    已取消: 'info',
    申诉中: 'danger'
  };
  return map[String(status)] || 'info';
};
const formatMoney = (value: any) => {
  const num = Number(value || 0);
  return num.toFixed(2);
};
const handleReset = () => {
  __state.query.orderNo = '';
  __state.query.userName = '';
  __state.query.status = '';
  __state.page = 1;
  loadOrders();
};
const handleSearch = () => {
  __state.page = 1;
  loadOrders();
};
const handleSizeChange = () => {
  __state.page = 1;
  loadOrders();
};

onMounted(() => {
  loadOrders();
})
</script>
<style lang="css" scoped>
.order-page {
  padding: var(--space-lg);
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space);
}
.page-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
}
.page-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.filter-card {
  margin-bottom: var(--space);
  border-radius: var(--radius);
}
.filter-card :deep(.el-form-item) {
  margin-bottom: 8px;
}
.table-card {
  border-radius: var(--radius);
}
.amount {
  color: var(--brand-600);
  font-weight: 600;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space);
}
.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  margin-bottom: 16px;
  border-bottom: 1px dashed var(--border);
}
.detail-no {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.timeline {
  margin-top: 24px;
}
.timeline-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
</style>
