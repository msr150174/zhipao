<template>
<div class="runner-apps">
  <div class="page-head">
    <div>
      <h2 class="page-title">跑腿员申请</h2>
      <p class="page-desc">审核校园跑腿员的入驻申请，通过后即可接单</p>
    </div>
    <ElButton class="transition" @click="loadData"> 刷新数据</ElButton>
  </div>
  <ElCard class="panel vtj-card" shadow="never">
    <ElTabs
      v-model="__state.activeTab"
      class="tabs"
      @tab-change="handleTabChange">
      <ElTabPane
        v-for="tab in __state.tabs"
        :key="tab.value"
        :name="tab.value"
        :label="tab.label"></ElTabPane
    ></ElTabs>
    <ElTable
      :data="__state.list"
      :style="{ width: '100%' }" stripe
      class="ElTable_6kxptnz3dr">
      <ElTableColumn prop="name" label="姓名" width="120"></ElTableColumn>
      <ElTableColumn prop="phone" label="手机号" width="150"></ElTableColumn>
      <ElTableColumn
        prop="student_no"
        label="学号"
        width="150"></ElTableColumn>
      <ElTableColumn
        prop="apply_time"
        label="申请时间"
        min-width="180"></ElTableColumn>
      <ElTableColumn label="状态" width="120">
        <template #default="{ row }">
          <ElTag :type="statusType((row.status as any))" round effect="light">
            {{ row.status }}</ElTag
          >
        </template></ElTableColumn
      >
      <ElTableColumn fixed="right" label="操作" width="180">
        <template #default="{ row }">
          <div v-if="row.status === '待审核'" class="row-actions">
            <ElButton link type="primary" @click="handleApprove(row)">
              通过</ElButton
            >
            <ElButton link type="danger" @click="handleReject(row)">
              拒绝</ElButton
            >
          </div>
          <span v-else class="muted"> 已处理</span>
        </template></ElTableColumn
      >
      <template #empty>
        <div class="empty">暂无申请数据</div>
      </template></ElTable
    >
    <div class="pager">
      <ElPagination
        :total="__state.total"
        layout="total, prev, pager, next"
        :page-size="__state.pageSize" background
        :current-page="__state.page"
        @current-change="handlePageChange"></ElPagination></div
  ></ElCard>
</div>
</template>
<script lang="ts" setup>
import {useProvider } from '@/vtj-compat';
import { reactive, onMounted } from 'vue';
import {
  ElButton,
  ElCard,
  ElTabs,
  ElTabPane,
  ElTable,
  ElTableColumn,
  ElTag,
  ElPagination,
  ElMessageBox,
  ElMessage
} from 'element-plus';

const __provider = useProvider({ id: '1iptnylv9', version: '1791907307038' });

const __state: any = reactive({
  list: [],
  page: 1,
  tabs: [
    { label: '全部', value: 'all' },
    { label: '待审核', value: '待审核' },
    { label: '已通过', value: '已通过' },
    { label: '已拒绝', value: '已拒绝' }
  ],
  total: 0,
  loading: false,
  pageSize: 10,
  activeTab: 'all'
});
const loadData = async () => {
  __state.loading = true;
  try {
    const res: any = await __provider.apis['getRunnerApplications']({
      params: {
        status: __state.activeTab === 'all' ? '' : __state.activeTab,
        page: __state.page,
        size: __state.pageSize
      }
    });
    const data: any = res || {};
    __state.list = data.list || [];
    __state.total = data.total || 0;
  } catch (e) {
    __state.list = [];
    __state.total = 0;
  } finally {
    __state.loading = false;
  }
};
const statusType = (status: any) => {
  if (status === '已通过') return 'success';
  if (status === '已拒绝') return 'danger';
  if (status === '待审核') return 'warning';
  return 'info';
};
const handleReject = (row: any) => {
  ElMessageBox.confirm(`确认拒绝「${row.name}」的跑腿员申请？`, '审核确认', {
    confirmButtonText: '确认拒绝',
    cancelButtonText: '取消',
    type: 'error'
  })
    .then(() => {
      row.status = '已拒绝';
      ElMessage.warning('已拒绝该申请');
    })
    .catch(() => {});
};
const handleApprove = (row: any) => {
  ElMessageBox.confirm(`确认通过「${row.name}」的跑腿员申请？`, '审核确认', {
    confirmButtonText: '确认通过',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(() => {
      row.status = '已通过';
      ElMessage.success('审核已通过');
    })
    .catch(() => {});
};
const handleTabChange = () => {
  __state.page = 1;
  loadData();
};
const handlePageChange = (page: any) => {
  __state.page = page;
  loadData();
};

onMounted(() => {
  loadData();
})
</script>
<style lang="css" scoped>
.runner-apps {
  padding: var(--space-lg);
}
.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space);
}
.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-1);
}
.page-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.panel {
  border-radius: var(--radius);
}
.tabs {
  margin-bottom: var(--space-sm);
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.muted {
  color: var(--text-3);
  font-size: 13px;
}
.empty {
  padding: 24px 0;
  color: var(--text-3);
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space);
}
</style>
