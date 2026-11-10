<template>
  <div class="page-card">
    <el-tabs v-model="activeTab">
      <!-- ==================== Tab1：提现审核 ==================== -->
      <el-tab-pane label="提现审核" name="withdrawals">
        <div class="filter-bar">
          <el-select v-model="wdStatus" style="width: 130px" @change="searchWithdrawals">
            <el-option v-for="o in WITHDRAW_STATUS_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
          </el-select>
        </div>

        <el-table v-loading="wdLoading" :data="wdList" stripe>
          <el-table-column label="申请号" min-width="150">
            <template #default="{ row }"><span class="num">{{ row.apply_no }}</span></template>
          </el-table-column>
          <el-table-column label="用户" width="120">
            <template #default="{ row }">{{ row.nickname }}</template>
          </el-table-column>
          <el-table-column label="金额" width="110">
            <template #default="{ row }"><span class="num money">{{ formatMoney(row.amount) }}</span></template>
          </el-table-column>
          <el-table-column label="当前余额" width="110">
            <template #default="{ row }"><span class="num money">{{ formatMoney(row.user_balance) }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="withdrawStatusColor(row.status)">{{ withdrawStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" width="165">
            <template #default="{ row }"><span class="num">{{ row.created_at }}</span></template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'PENDING'">
                <el-button link type="success" @click="handleReview(row, true)">通过</el-button>
                <el-button link type="danger" @click="handleReview(row, false)">驳回</el-button>
              </template>
              <span v-else class="done-text">已处理</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="暂无提现申请" />
          </template>
        </el-table>

        <div class="pager-bar">
          <el-pagination
            v-model:current-page="wdPage"
            v-model:page-size="wdPageSize"
            :total="wdTotal"
            layout="total, prev, pager, next"
            @current-change="loadWithdrawals"
          />
        </div>
      </el-tab-pane>

      <!-- ==================== Tab2：全部流水（★ 下划线字段） ==================== -->
      <el-tab-pane label="全部流水" name="transactions">
        <div class="filter-bar">
          <el-select v-model="txType" placeholder="类型" clearable style="width: 130px" @change="searchTransactions">
            <el-option v-for="o in TXN_TYPE_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
          </el-select>
          <el-input
            v-model="txKeyword"
            placeholder="🔍 订单号 / 申请号 / 用户"
            clearable
            style="width: 220px"
            @keyup.enter="searchTransactions"
          />
          <el-button type="primary" @click="searchTransactions">查询</el-button>
        </div>

        <el-table v-loading="txLoading" :data="txList" stripe>
          <el-table-column label="时间" width="165">
            <template #default="{ row }"><span class="num">{{ row.created_at }}</span></template>
          </el-table-column>
          <el-table-column label="用户" width="110">
            <template #default="{ row }">{{ row.nickname }}</template>
          </el-table-column>
          <el-table-column label="类型" width="110">
            <template #default="{ row }">
              <el-tag :type="txnTypeColor(row.type)" effect="plain">{{ txnTypeText(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="120">
            <template #default="{ row }">
              <span class="num money" :class="isPositive(row.type) ? 'income' : 'expense'">
                {{ formatSignedMoney(row.amount, isPositive(row.type)) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="关联单号" min-width="160">
            <template #default="{ row }"><span class="num">{{ row.order_no || row.apply_no || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="withdrawStatusColor(row.status)" size="small">{{ withdrawStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <template #empty>
            <el-empty description="暂无流水" />
          </template>
        </el-table>

        <div class="pager-bar">
          <el-pagination
            v-model:current-page="txPage"
            v-model:page-size="txPageSize"
            :total="txTotal"
            layout="total, prev, pager, next"
            @current-change="loadTransactions"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getTransactions, getWithdrawals, reviewWithdrawal } from '@/api/finance'
import {
  TXN_TYPE_COLOR,
  TXN_TYPE_OPTIONS,
  TXN_TYPE_TEXT,
  WITHDRAW_STATUS_COLOR,
  WITHDRAW_STATUS_OPTIONS,
  WITHDRAW_STATUS_TEXT,
  type TagType
} from '@/utils/constants'
import { formatMoney, formatSignedMoney } from '@/utils/format'
import type { TransactionItem, TransactionType, WithdrawalItem } from '@/types'

const activeTab = ref('withdrawals')

// ---------- 提现审核 ----------
const wdLoading = ref(false)
const wdList = ref<WithdrawalItem[]>([])
const wdTotal = ref(0)
const wdPage = ref(1)
const wdPageSize = ref(20)
const wdStatus = ref('PENDING')

async function loadWithdrawals() {
  wdLoading.value = true
  try {
    const res = await getWithdrawals({
      status: wdStatus.value || undefined,
      page: wdPage.value,
      pageSize: wdPageSize.value
    })
    wdList.value = res.list
    wdTotal.value = res.total
  } catch {
    // request.ts 已统一提示错误
  } finally {
    wdLoading.value = false
  }
}

function searchWithdrawals() {
  wdPage.value = 1
  loadWithdrawals()
}

/**
 * 审核提现：
 * - 通过：仅标记 SUCCESS（表示已线下转账）
 * - 驳回：系统自动把金额退回用户余额
 */
async function handleReview(row: WithdrawalItem, pass: boolean) {
  if (pass) {
    try {
      await ElMessageBox.confirm(
        `确认通过「${row.nickname}」的提现申请 ${row.apply_no}（${formatMoney(row.amount)}）？通过后仅标记为已转账。`,
        '通过提现',
        { confirmButtonText: '确认通过', cancelButtonText: '取消', type: 'warning' }
      )
    } catch {
      return
    }
    await doReview(row, true, '已转账')
  } else {
    let reason: string
    try {
      const { value } = await ElMessageBox.prompt(
        `驳回后 ${formatMoney(row.amount)} 将自动退回「${row.nickname}」余额，请输入驳回原因`,
        '驳回提现',
        {
          confirmButtonText: '确认驳回',
          cancelButtonText: '取消',
          type: 'warning',
          inputPlaceholder: '如：账户信息有误',
          inputValidator: (v: string) => (v && v.trim() ? true : '原因必填')
        }
      )
      reason = value.trim()
    } catch {
      return
    }
    await doReview(row, false, reason)
  }
}

async function doReview(row: WithdrawalItem, pass: boolean, reason: string) {
  try {
    const res = await reviewWithdrawal(row.id, pass, reason)
    ElMessage.success(res.message || (pass ? '已通过' : '已驳回并退款'))
    loadWithdrawals()
  } catch {
    // request.ts 已统一提示错误
  }
}

// ---------- 全部流水 ----------
const txLoading = ref(false)
const txList = ref<TransactionItem[]>([])
const txTotal = ref(0)
const txPage = ref(1)
const txPageSize = ref(20)
const txType = ref('')
const txKeyword = ref('')

function txnTypeText(type: TransactionType): string {
  return TXN_TYPE_TEXT[type] || type
}

function txnTypeColor(type: TransactionType): TagType {
  return TXN_TYPE_COLOR[type] || 'info'
}

function withdrawStatusText(status: string): string {
  return WITHDRAW_STATUS_TEXT[status] || status
}

function withdrawStatusColor(status: string): TagType {
  return WITHDRAW_STATUS_COLOR[status] || 'info'
}

/** 收入 / 退款为正，支出 / 提现为负 */
function isPositive(type: TransactionType): boolean {
  return type === 'INCOME' || type === 'REFUND'
}

async function loadTransactions() {
  txLoading.value = true
  try {
    const res = await getTransactions({
      type: txType.value || undefined,
      keyword: txKeyword.value || undefined,
      page: txPage.value,
      pageSize: txPageSize.value
    })
    txList.value = res.list
    txTotal.value = res.total
  } catch {
    // request.ts 已统一提示错误
  } finally {
    txLoading.value = false
  }
}

function searchTransactions() {
  txPage.value = 1
  loadTransactions()
}

onMounted(() => {
  loadWithdrawals()
  loadTransactions()
})
</script>

<style scoped lang="scss">
.money {
  &.income {
    color: #14a152;
    font-weight: 600;
  }

  &.expense {
    color: #f56c6c;
    font-weight: 600;
  }
}

.done-text {
  color: #c0c8c3;
  font-size: 13px;
}
</style>
