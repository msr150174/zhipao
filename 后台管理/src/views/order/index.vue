<template>
  <div class="page-card">
    <!-- 筛选区 -->
    <div class="filter-bar">
      <el-select v-model="query.status" placeholder="状态" clearable style="width: 150px">
        <el-option v-for="o in ORDER_STATUS_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="query.deliveryType" placeholder="类型" clearable style="width: 120px">
        <el-option v-for="o in DELIVERY_TYPE_OPTIONS" :key="o.label" :label="o.label" :value="o.value" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px"
      />
      <el-input
        v-model="query.keyword"
        placeholder="🔍 订单号 / 驿站"
        clearable
        style="width: 200px"
        @keyup.enter="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <!-- 订单表格 -->
    <el-table v-loading="loading" :data="list" stripe>
      <el-table-column label="订单号" min-width="170">
        <template #default="{ row }">
          <span class="num">{{ row.orderNo }}</span>
          <el-tag v-if="row.urgent" type="danger" size="small" effect="plain" class="urgent-tag">加急</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusColor(row.status)">{{ row.statusText }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="110">
        <template #default="{ row }">{{ row.deliveryTypeText }} · {{ row.packageSizeText }}</template>
      </el-table-column>
      <el-table-column prop="stationName" label="取件点" min-width="160" show-overflow-tooltip />
      <el-table-column label="送达" width="120">
        <template #default="{ row }">{{ row.buildingName }} {{ row.roomNo }}</template>
      </el-table-column>
      <el-table-column label="报酬" width="100">
        <template #default="{ row }"><span class="num money">{{ formatMoney(row.reward) }}</span></template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="165" />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row.id)">详情</el-button>
          <el-button
            v-if="canCancel(row.status)"
            link
            type="danger"
            @click="handleCancel(row.id)"
          >取消</el-button>
          <el-button
            v-if="row.status === 'DELIVERED'"
            link
            type="success"
            @click="handleComplete(row.id)"
          >完成</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无订单" />
      </template>
    </el-table>

    <!-- 分页 -->
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

    <!-- 订单详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="订单详情" size="440px">
      <div v-loading="detailLoading" class="detail-body">
        <template v-if="detail">
          <div class="detail-head">
            <span class="order-no num">{{ detail.orderNo }}</span>
            <el-tag :type="statusColor(detail.status)">{{ detail.statusText }}</el-tag>
          </div>

          <div class="section">
            <div class="section-title">配送路线</div>
            <div class="route-row">
              <span class="route-dot pickup">取</span>
              <div>
                <div class="route-name">{{ detail.stationName }}</div>
                <div class="pickup-code">
                  取件码: <b>{{ detail.pickupCode }}</b>
                </div>
              </div>
            </div>
            <div class="route-row">
              <span class="route-dot drop">送</span>
              <div class="route-name">{{ detail.buildingName }} {{ detail.roomNo }}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">订单信息</div>
            <div class="kv"><span class="k">类型</span><span>{{ detail.deliveryTypeText }} · {{ detail.packageSizeText }} · {{ detail.itemCount }}件</span></div>
            <div class="kv"><span class="k">报酬</span><span class="money">{{ formatMoney(detail.reward) }}</span></div>
            <div class="kv">
              <span class="k">截止</span>
              <span :class="{ 'expired-text': detail.expired }">
                {{ detail.deadline }}
                <template v-if="detail.expired">（已超时）</template>
              </span>
            </div>
            <div v-if="detail.remark" class="kv"><span class="k">备注</span><span>{{ detail.remark }}</span></div>
            <div v-if="detail.cancelReason" class="kv"><span class="k">取消原因</span><span>{{ detail.cancelReason }}</span></div>
          </div>

          <div class="section">
            <div class="section-title">参与方</div>
            <div class="kv"><span class="k">发布方</span><span>{{ detail.publisherName }}（{{ detail.publisherPhone }}）</span></div>
            <div class="kv">
              <span class="k">跑腿员</span>
              <span>{{ detail.runnerName || '—' }}<template v-if="detail.runnerCredit !== null">（信用分 {{ detail.runnerCredit }}）</template></span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">时间线</div>
            <div class="kv"><span class="k">创建</span><span class="num">{{ detail.createTime }}</span></div>
            <div class="kv"><span class="k">接单</span><span class="num">{{ orDash(detail.acceptTime) }}</span></div>
            <div class="kv"><span class="k">完成</span><span class="num">{{ orDash(detail.completeTime) }}</span></div>
          </div>

          <div class="drawer-actions">
            <el-button
              v-if="canCancel(detail.status)"
              type="danger"
              :loading="acting"
              @click="handleCancel(detail.id)"
            >强制取消</el-button>
            <el-button
              v-if="detail.status === 'DELIVERED'"
              type="success"
              :loading="acting"
              @click="handleComplete(detail.id)"
            >强制完成</el-button>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelOrder, completeOrder, getOrderDetail, getOrders } from '@/api/order'
import { DELIVERY_TYPE_OPTIONS, FINAL_ORDER_STATUS, ORDER_STATUS_COLOR, ORDER_STATUS_OPTIONS, type TagType } from '@/utils/constants'
import { formatMoney, orDash } from '@/utils/format'
import type { OrderDetail, OrderItem, OrderStatus } from '@/types'

const loading = ref(false)
const list = ref<OrderItem[]>([])
const total = ref(0)
const dateRange = ref<[string, string] | null>(null)

const query = ref({
  status: '',
  deliveryType: undefined as number | undefined,
  keyword: '',
  page: 1,
  pageSize: 20
})

const drawerVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<OrderDetail | null>(null)
const acting = ref(false)

function statusColor(status: OrderStatus): TagType {
  return ORDER_STATUS_COLOR[status] || 'info'
}

function canCancel(status: OrderStatus): boolean {
  return !FINAL_ORDER_STATUS.includes(status)
}

async function load() {
  loading.value = true
  try {
    const res = await getOrders({
      status: query.value.status || undefined,
      deliveryType: query.value.deliveryType,
      keyword: query.value.keyword || undefined,
      startDate: dateRange.value ? dateRange.value[0] : undefined,
      endDate: dateRange.value ? dateRange.value[1] : undefined,
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
  query.value = { status: '', deliveryType: undefined, keyword: '', page: 1, pageSize: query.value.pageSize }
  dateRange.value = null
  load()
}

async function openDetail(id: string) {
  drawerVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getOrderDetail(id)
  } catch {
    // request.ts 已统一提示错误
  } finally {
    detailLoading.value = false
  }
}

/** 危险操作：强制取消（原因必填，二次确认） */
async function handleCancel(id: string) {
  let reason: string
  try {
    const { value } = await ElMessageBox.prompt('请输入强制取消原因', '强制取消订单', {
      confirmButtonText: '确认取消订单',
      cancelButtonText: '再想想',
      type: 'warning',
      inputPlaceholder: '如：用户申诉，订单异常',
      inputValidator: (v: string) => (v && v.trim() ? true : '原因必填')
    })
    reason = value.trim()
  } catch {
    return
  }
  acting.value = true
  try {
    const res = await cancelOrder(id, reason)
    ElMessage.success(res.message || '订单已强制取消')
    refreshAfterAction(id)
  } catch {
    // request.ts 已统一提示错误
  } finally {
    acting.value = false
  }
}

/** 危险操作：强制完成（仅 DELIVERED，原因必填） */
async function handleComplete(id: string) {
  let reason: string
  try {
    const { value } = await ElMessageBox.prompt('请输入强制完成原因', '强制完成订单', {
      confirmButtonText: '确认完成订单',
      cancelButtonText: '再想想',
      type: 'warning',
      inputPlaceholder: '如：发布方长期未确认',
      inputValidator: (v: string) => (v && v.trim() ? true : '原因必填')
    })
    reason = value.trim()
  } catch {
    return
  }
  acting.value = true
  try {
    const res = await completeOrder(id, reason)
    ElMessage.success(res.message || '订单已强制完成')
    refreshAfterAction(id)
  } catch {
    // request.ts 已统一提示错误
  } finally {
    acting.value = false
  }
}

function refreshAfterAction(id: string) {
  load()
  if (drawerVisible.value && detail.value && detail.value.id === id) {
    openDetail(id)
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.urgent-tag {
  margin-left: 6px;
}

.detail-body {
  .detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .order-no {
      font-size: 17px;
      font-weight: 600;
    }
  }

  .section {
    padding: 14px 0;
    border-bottom: 1px solid #f0f4f1;

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: #8a9a90;
      margin-bottom: 10px;
    }

    .route-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;

      .route-dot {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 12px;

        &.pickup {
          background: var(--el-color-primary);
        }

        &.drop {
          background: #409eff;
        }
      }

      .route-name {
        color: #1f2d3d;
        line-height: 24px;
      }

      .pickup-code {
        margin-top: 2px;
        display: inline-block;
        background: #fff7ed;
        border: 1px dashed #fdba74;
        color: #c2410c;
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 13px;
      }
    }

    .kv {
      display: flex;
      margin-bottom: 8px;
      line-height: 1.6;

      .k {
        flex-shrink: 0;
        width: 64px;
        color: #8a9a90;
      }

      .expired-text {
        color: #f56c6c;
      }
    }
  }

  .drawer-actions {
    display: flex;
    gap: 12px;
    padding-top: 18px;
  }
}
</style>
