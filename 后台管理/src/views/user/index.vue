<template>
  <div class="page-card">
    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-input
        v-model="query.keyword"
        placeholder="🔍 昵称 / 手机号 / 学号"
        clearable
        style="width: 220px"
        @keyup.enter="search"
      />
      <span class="credit-label">信用分</span>
      <el-input-number v-model="query.minCredit" :min="0" :max="100" placeholder="最低" controls-position="right" style="width: 90px" />
      <span>-</span>
      <el-input-number v-model="query.maxCredit" :min="0" :max="100" placeholder="最高" controls-position="right" style="width: 90px" />
      <el-select v-model="query.isRunner" placeholder="是否跑腿员" clearable style="width: 130px">
        <el-option v-for="o in USER_RUNNER_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 110px">
        <el-option v-for="o in USER_STATUS_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
      </el-select>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <!-- 用户表格 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column prop="nickname" label="昵称" min-width="120">
        <template #default="{ row }">
          {{ row.nickname }}
          <el-tag v-if="row.status === 0" type="info" size="small" class="frozen-tag">已冻结</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130">
        <template #default="{ row }"><span class="num">{{ row.phone }}</span></template>
      </el-table-column>
      <el-table-column label="信用分" width="90">
        <template #default="{ row }">
          <span class="num credit-score" :style="{ color: creditColor(row.creditScore) }">{{ row.creditScore }}</span>
        </template>
      </el-table-column>
      <el-table-column label="余额" width="100">
        <template #default="{ row }"><span class="num money">{{ formatMoney(row.balance) }}</span></template>
      </el-table-column>
      <el-table-column label="标签" min-width="160">
        <template #default="{ row }">
          <el-tag v-if="row.isAdmin" type="warning" size="small" effect="plain">管理员</el-tag>
          <el-tag v-if="row.isRunner" type="success" size="small" effect="plain">跑腿员</el-tag>
          <el-tag v-if="row.creditScore < 60" type="danger" size="small" effect="plain">信用低</el-tag>
          <span v-if="!row.isAdmin && !row.isRunner && row.creditScore >= 60" class="no-tag">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="注册时间" width="165" />
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无用户" />
      </template>
    </el-table>

    <div class="pager-bar">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="load"
        @size-change="search"
      />
    </div>

    <!-- 用户详情 + 操作 -->
    <el-dialog v-model="detailVisible" title="用户详情" width="560px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="昵称">{{ detail.nickname }}</el-descriptions-item>
            <el-descriptions-item label="手机号">{{ detail.phone }}</el-descriptions-item>
            <el-descriptions-item label="学号">{{ orDash(detail.studentNo) }}</el-descriptions-item>
            <el-descriptions-item label="信用分">
              <span class="num credit-score" :style="{ color: creditColor(detail.creditScore) }">{{ detail.creditScore }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="余额"><span class="money">{{ formatMoney(detail.balance) }}</span></el-descriptions-item>
            <el-descriptions-item label="累计收入"><span class="money">{{ formatMoney(detail.income) }}</span></el-descriptions-item>
            <el-descriptions-item label="身份">
              <el-tag v-if="detail.isAdmin" type="warning" size="small" effect="plain">管理员</el-tag>
              <el-tag v-if="detail.isRunner" type="success" size="small" effect="plain">跑腿员</el-tag>
              <span v-if="!detail.isAdmin && !detail.isRunner">普通用户</span>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="detail.status === 1 ? 'success' : 'info'" size="small">{{ detail.statusText }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="实名认证">{{ detail.realNameVerified ? '已认证' : '未认证' }}</el-descriptions-item>
            <el-descriptions-item label="注册时间">{{ detail.createTime }}</el-descriptions-item>
          </el-descriptions>

          <div class="stats-row">
            <div class="stat-item"><div class="num">{{ detail.stats.total }}</div><div class="label">参与订单</div></div>
            <div class="stat-item"><div class="num">{{ detail.stats.published }}</div><div class="label">发布</div></div>
            <div class="stat-item"><div class="num">{{ detail.stats.taken }}</div><div class="label">接单</div></div>
            <div class="stat-item"><div class="num">{{ detail.stats.completed }}</div><div class="label">完成</div></div>
            <div class="stat-item"><div class="num money">{{ formatMoney(detail.stats.earned) }}</div><div class="label">赚取</div></div>
          </div>
        </template>
      </div>
      <template #footer>
        <div class="dialog-actions">
          <el-button type="primary" plain @click="openCreditDialog">调整信用分</el-button>
          <el-button v-if="detail && detail.status === 1" type="warning" plain @click="handleFreeze">冻结账号</el-button>
          <el-button v-else type="success" plain @click="handleUnfreeze">解冻账号</el-button>
          <el-button v-if="detail && !detail.isAdmin" type="danger" plain @click="handleSetAdmin(true)">设为管理员</el-button>
          <el-button v-else type="info" plain @click="handleSetAdmin(false)">取消管理员</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 调整信用分弹窗 -->
    <el-dialog v-model="creditVisible" title="调整信用分" width="420px">
      <div class="credit-dialog">
        <div class="current">当前信用分: <b class="num">{{ detail && detail.creditScore }}</b></div>
        <div class="row">
          <span class="label">变动值</span>
          <el-input-number v-model="creditDelta" :min="-100" :max="100" :step="5" />
          <span class="after">调整后: <b class="num">{{ afterScore }}</b></span>
        </div>
        <div class="row">
          <span class="label">原因</span>
          <el-input v-model="creditReason" placeholder="必填，如：虚假发单" maxlength="50" />
        </div>
        <div class="quick">
          <span class="label">常用</span>
          <div class="quick-btns">
            <el-button
              v-for="q in QUICK_REASONS"
              :key="q.reason"
              size="small"
              text
              type="danger"
              @click="applyQuick(q)"
            >{{ q.reason }}{{ q.delta }}</el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="creditVisible = false">取消</el-button>
        <el-button type="primary" :loading="creditSubmitting" @click="submitCredit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adjustCredit, freezeUser, getUserDetail, getUsers, setAdmin, unfreezeUser } from '@/api/user'
import { USER_RUNNER_OPTIONS, USER_STATUS_OPTIONS, creditColor } from '@/utils/constants'
import { formatMoney, orDash } from '@/utils/format'
import type { AdminUserDetail, AdminUserItem } from '@/types'

const QUICK_REASONS = [
  { reason: '虚假发单', delta: -20 },
  { reason: '超时', delta: -5 },
  { reason: '态度恶劣', delta: -10 },
  { reason: '作弊', delta: -50 }
]

const loading = ref(false)
const list = ref<AdminUserItem[]>([])
const total = ref(0)

const query = ref({
  keyword: '',
  minCredit: undefined as number | undefined,
  maxCredit: undefined as number | undefined,
  isRunner: undefined as boolean | undefined,
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminUserDetail | null>(null)

const creditVisible = ref(false)
const creditSubmitting = ref(false)
const creditDelta = ref(-10)
const creditReason = ref('')

const afterScore = computed(() => {
  const current = detail.value ? detail.value.creditScore : 0
  return Math.min(100, Math.max(0, current + (creditDelta.value || 0)))
})

async function load() {
  loading.value = true
  try {
    const res = await getUsers({
      keyword: query.value.keyword || undefined,
      minCredit: query.value.minCredit,
      maxCredit: query.value.maxCredit,
      isRunner: query.value.isRunner,
      status: query.value.status,
      page: query.value.page,
      pageSize: query.value.pageSize
    })
    list.value = res.list
    total.value = res.total
  } catch {
    // request.ts 已统一提示错误
  } finally {
    loading.value = false
  }
}

function search() {
  query.value.page = 1
  load()
}

function reset() {
  query.value = {
    keyword: '',
    minCredit: undefined,
    maxCredit: undefined,
    isRunner: undefined,
    status: undefined,
    page: 1,
    pageSize: query.value.pageSize
  }
  load()
}

async function openDetail(id: string) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getUserDetail(id)
  } catch {
    // request.ts 已统一提示错误
  } finally {
    detailLoading.value = false
  }
}

function openCreditDialog() {
  creditDelta.value = -10
  creditReason.value = ''
  creditVisible.value = true
}

function applyQuick(q: { reason: string; delta: number }) {
  creditReason.value = q.reason
  creditDelta.value = q.delta
}

async function submitCredit() {
  if (!detail.value) return
  if (!creditDelta.value) {
    ElMessage.warning('变动值不能为 0')
    return
  }
  if (!creditReason.value.trim()) {
    ElMessage.warning('请填写调整原因')
    return
  }
  creditSubmitting.value = true
  try {
    const res = await adjustCredit(detail.value.id, creditDelta.value, creditReason.value.trim())
    ElMessage.success(`${res.message}（${res.before} → ${res.after}）`)
    creditVisible.value = false
    refreshDetailAndList()
  } catch {
    // request.ts 已统一提示错误
  } finally {
    creditSubmitting.value = false
  }
}

/** 危险操作：冻结（原因必填） */
async function handleFreeze() {
  if (!detail.value) return
  let reason: string
  try {
    const { value } = await ElMessageBox.prompt('请输入冻结原因', '冻结账号', {
      confirmButtonText: '确认冻结',
      cancelButtonText: '取消',
      type: 'warning',
      inputPlaceholder: '如：多次违规',
      inputValidator: (v: string) => (v && v.trim() ? true : '原因必填')
    })
    reason = value.trim()
  } catch {
    return
  }
  try {
    const res = await freezeUser(detail.value.id, reason)
    ElMessage.success(res.message || '账号已冻结')
    refreshDetailAndList()
  } catch {
    // request.ts 已统一提示错误
  }
}

async function handleUnfreeze() {
  if (!detail.value) return
  try {
    await ElMessageBox.confirm(`确认解冻「${detail.value.nickname}」？`, '解冻账号', {
      confirmButtonText: '确认解冻',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    const res = await unfreezeUser(detail.value.id)
    ElMessage.success(res.message || '账号已解冻')
    refreshDetailAndList()
  } catch {
    // request.ts 已统一提示错误
  }
}

/** 危险操作：设置 / 取消管理员（二次确认） */
async function handleSetAdmin(isAdmin: boolean) {
  if (!detail.value) return
  const action = isAdmin ? '设为管理员' : '取消管理员'
  try {
    await ElMessageBox.confirm(`确认将「${detail.value.nickname}」${action}？`, action, {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  try {
    const res = await setAdmin(detail.value.id, isAdmin)
    ElMessage.success(res.message || '操作成功')
    refreshDetailAndList()
  } catch {
    // request.ts 已统一提示错误
  }
}

function refreshDetailAndList() {
  load()
  if (detail.value) {
    openDetail(detail.value.id)
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.credit-label {
  color: #5a6b62;
  font-size: 13px;
}

.credit-score {
  font-weight: 600;
}

.frozen-tag {
  margin-left: 6px;
}

.no-tag {
  color: #c0c8c3;
}

.stats-row {
  display: flex;
  margin-top: 16px;
  background: #f7faf8;
  border-radius: 8px;
  padding: 14px 0;

  .stat-item {
    flex: 1;
    text-align: center;

    .num {
      font-size: 18px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #1f2d3d;
    }

    .label {
      margin-top: 4px;
      font-size: 12px;
      color: #8a9a90;
    }
  }
}

.dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;

  .el-button {
    margin-left: 0;
  }
}

.credit-dialog {
  .current {
    margin-bottom: 16px;
    color: #5a6b62;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    .label {
      flex-shrink: 0;
      width: 48px;
      color: #5a6b62;
    }

    .after {
      color: #8a9a90;
      font-size: 13px;
    }
  }

  .quick {
    display: flex;
    gap: 12px;

    .label {
      flex-shrink: 0;
      width: 48px;
      color: #5a6b62;
      line-height: 24px;
    }

    .quick-btns {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  }
}
</style>
