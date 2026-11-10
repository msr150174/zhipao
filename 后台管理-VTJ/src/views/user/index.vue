<template>
<div class="users-page">
  <ElCard class="filter-card" shadow="never">
    <ElForm class="filter-form" :model="__state.query" :inline="true">
      <ElFormItem label="关键词">
        <ElInput
          v-model="__state.query.keyword"
          :style="{ width: '220px' }" clearable
          placeholder="姓名 / 手机号"
          class="ElInput_6hiptnyhs1"
          @keyup.enter="handleSearch"></ElInput
      ></ElFormItem>
      <ElFormItem label="状态">
        <ElSelect
          v-model="__state.query.status"
          :style="{ width: '140px' }" clearable
          placeholder="全部"
          class="ElSelect_6hkptnyhs1">
          <ElOption label="正常" value="正常"></ElOption>
          <ElOption label="禁用" value="禁用"></ElOption></ElSelect
      ></ElFormItem>
      <ElFormItem>
        <ElButton type="primary" @click="handleSearch"> 查询</ElButton>
        <ElButton @click="handleReset"> 重置</ElButton></ElFormItem
      ></ElForm
    ></ElCard
  >
  <ElCard class="table-card" shadow="never">
    <div class="table-header">
      <span class="table-title"> 用户列表</span>
      <span class="table-count">
        <span>
          <span> 共</span>
          <span> {{ __state.total }}</span>
          <span> 条</span></span
        ></span
      >
    </div>
    <ElTable
      :data="__state.list"
      :style="{ width: '100%' }" stripe
      class="ElTable_6huptnyhs4">
      <ElTableColumn
        prop="id"
        label="用户ID"
        min-width="200" show-overflow-tooltip></ElTableColumn>
      <ElTableColumn prop="name" label="姓名" min-width="100"></ElTableColumn>
      <ElTableColumn
        prop="phone"
        label="手机号"
        min-width="130"></ElTableColumn>
      <ElTableColumn prop="credit" label="信用分" min-width="100">
        <template #default="scope">
          <span :class="creditClass(scope.row.credit)">
            {{ scope.row.credit }}</span
          >
        </template></ElTableColumn
      >
      <ElTableColumn prop="status" label="状态" min-width="100">
        <template #default="scope">
          <ElTag
            :type="scope.row.status === '正常' ? 'success' : 'danger'"
            effect="light">
            {{ scope.row.status }}</ElTag
          >
        </template></ElTableColumn
      >
      <ElTableColumn
        prop="create_time"
        label="注册时间"
        min-width="180"></ElTableColumn>
      <ElTableColumn fixed="right" label="操作" width="240">
        <template #default="scope">
          <ElButton link
            type="primary"
            @click="openCreditDialog(scope.row)">
            调整信用分</ElButton
          >
          <ElSwitch
            v-model="scope.row.status"
            :style="{ 'margin-left': '12px' }"
            active-value="正常"
            inactive-value="禁用"
            class="ElSwitch_6i9ptnyhs4"
            @change="
              handleStatusChange(scope.row)
            "></ElSwitch> </template></ElTableColumn
    ></ElTable>
    <div class="pagination-wrap">
      <ElPagination
        :total="__state.total"
        layout="total, prev, pager, next"
        :page-size="__state.pageSize" background
        :current-page="__state.page"
        @current-change="handlePageChange"></ElPagination></div
  ></ElCard>
  <ElDialog v-model="__state.dialogVisible" title="调整信用分" width="440px">
    <ElForm :model="__state.creditForm" label-width="90px">
      <ElFormItem label="用户">
        <span class="dialog-user">
          {{ __state.currentUser && __state.currentUser.name }}</span
        ></ElFormItem
      >
      <ElFormItem label="信用分">
        <ElInputNumber
          v-model="__state.creditForm.credit"
          :max="100"
          :min="0"></ElInputNumber
      ></ElFormItem>
      <ElFormItem label="调整原因">
        <ElInput
          v-model="__state.creditForm.reason"
          :rows="3"
          type="textarea"
          placeholder="请输入调整原因"></ElInput></ElFormItem
    ></ElForm>
    <template #footer>
      <ElButton @click="() => (__state.dialogVisible = false)">
        取消</ElButton
      >
      <ElButton type="primary" @click="submitCredit"> 确定</ElButton>
    </template></ElDialog
  >
</div>
</template>
<script lang="ts" setup>
import {useProvider } from '@/vtj-compat';
import { reactive, onMounted } from 'vue';
import {
  ElCard,
  ElForm,
  ElFormItem,
  ElInput,
  ElSelect,
  ElOption,
  ElButton,
  ElTable,
  ElTableColumn,
  ElTag,
  ElSwitch,
  ElPagination,
  ElDialog,
  ElInputNumber,
  ElMessage,
  ElMessageBox
} from 'element-plus';

const __provider = useProvider({ id: '1fptnxvak', version: '1791907295125' });

const __state: any = reactive({
  list: [],
  page: 1,
  query: { keyword: '', status: '' },
  total: 0,
  loading: false,
  pageSize: 10,
  creditForm: { credit: 80, reason: '' },
  currentUser: null,
  dialogVisible: false
});
const loadData = async () => {
  __state.loading = true;
  try {
    const res: any = await loadUsers();
    const body: any = res && res.data ? res.data : res;
    const data: any = body && body.data ? body.data : body;
    __state.list = (data && data.list) || [];
    __state.total = (data && data.total) || 0;
  } catch (e) {
    __state.list = [];
    __state.total = 0;
  } finally {
    __state.loading = false;
  }
};
const creditClass = (credit: any) => {
  if (credit >= 90) return 'credit credit-high';
  if (credit >= 75) return 'credit credit-mid';
  return 'credit credit-low';
};
const handleReset = () => {
  __state.query.keyword = '';
  __state.query.status = '';
  __state.page = 1;
  loadData();
};
const handleSearch = () => {
  __state.page = 1;
  loadData();
};
const submitCredit = () => {
  if (!__state.currentUser) return;
  if (!__state.creditForm.reason) {
    ElMessage.warning('请输入调整原因');
    return;
  }
  __state.currentUser.credit = __state.creditForm.credit;
  __state.dialogVisible = false;
  ElMessage.success('信用分已更新');
};
const handlePageChange = (page: any) => {
  __state.page = page;
  loadData();
};
const openCreditDialog = (row: any) => {
  __state.currentUser = row;
  __state.creditForm.credit = row.credit;
  __state.creditForm.reason = '';
  __state.dialogVisible = true;
};
const handleStatusChange = (row: any) => {
  if (row.status === '禁用') {
    ElMessageBox.confirm('确定要禁用该用户吗？', '提示', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
      .then(() => {
        ElMessage.success('已禁用该用户');
      })
      .catch(() => {
        row.status = '正常';
      });
  } else {
    ElMessage.success('已启用该用户');
  }
};

const loadUsers = async (...args: any[]) => {
  return await (__provider.apis['getUserList'] as any).apply(null, args);
};

onMounted(() => {
  loadData();
})
</script>
<style lang="css" scoped>
.users-page {
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space);
}
.filter-card,
.table-card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
}
.filter-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}
.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space);
}
.table-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-1);
}
.table-count {
  font-size: 13px;
  color: var(--text-3);
}
.credit {
  font-weight: 600;
}
.credit-high {
  color: #16a34a;
}
.credit-mid {
  color: #d97706;
}
.credit-low {
  color: #dc2626;
}
.dialog-user {
  color: var(--text-2);
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space);
}
:deep(.el-button--primary) {
  background-color: var(--brand);
  border-color: var(--brand);
}
</style>
