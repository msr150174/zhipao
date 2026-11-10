<template>
  <div class="page-card">
    <!-- 状态 Tab -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane v-for="t in RUNNER_STATUS_TABS" :key="t.value" :name="t.value">
        <template #label>
          {{ t.label }}
          <el-badge v-if="counts[t.value]" :value="counts[t.value]" :type="t.value === 0 ? 'warning' : 'info'" class="tab-badge" />
        </template>
      </el-tab-pane>
    </el-tabs>

    <!-- 卡片式申请列表 -->
    <div v-loading="loading" class="app-list">
      <template v-if="list.length">
        <div v-for="app in list" :key="app.id" class="app-card">
          <div class="app-head">
            <span class="name">{{ app.realName }}</span>
            <el-tag :type="RUNNER_STATUS_COLOR[app.status]">{{ app.statusText }}</el-tag>
          </div>
          <div class="app-grid">
            <div class="info">
              <div class="kv"><span class="k">学号</span><span class="num">{{ app.studentNo }}</span></div>
              <div class="kv"><span class="k">校区</span><span>{{ app.campus }}</span></div>
              <div class="kv"><span class="k">手机</span><span class="num">{{ app.phone }}</span></div>
              <div class="kv"><span class="k">申请时间</span><span class="num">{{ app.createTime }}</span></div>
              <div v-if="app.reviewedAt" class="kv"><span class="k">审核时间</span><span class="num">{{ app.reviewedAt }}</span></div>
              <div v-if="app.rejectReason" class="kv reject"><span class="k">驳回原因</span><span>{{ app.rejectReason }}</span></div>
            </div>
            <div class="idcard">
              <div class="k">证件照</div>
              <el-image
                :src="app.idCardImg"
                :preview-src-list="[app.idCardImg]"
                fit="cover"
                preview-teleported
                class="idcard-img"
              />
            </div>
          </div>
          <div class="intro">
            <span class="k">自我介绍</span>
            <p>{{ app.intro || '—' }}</p>
          </div>
          <div v-if="app.status === 0" class="app-actions">
            <el-button type="danger" plain :loading="actingId === app.id" @click="handleReject(app)">驳回</el-button>
            <el-button type="primary" :loading="actingId === app.id" @click="handleApprove(app)">通过</el-button>
          </div>
        </div>
      </template>
      <el-empty v-else-if="!loading" description="暂无申请" />
    </div>

    <div class="pager-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { approveRunner, getRunnerApplications, rejectRunner } from '@/api/runner'
import { RUNNER_STATUS_COLOR, RUNNER_STATUS_TABS } from '@/utils/constants'
import type { RunnerApplication } from '@/types'

const activeTab = ref(0)
const loading = ref(false)
const list = ref<RunnerApplication[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const actingId = ref<number | null>(null)
const counts = ref<Record<number, number>>({})

async function load() {
  loading.value = true
  try {
    const res = await getRunnerApplications({
      status: activeTab.value,
      page: page.value,
      pageSize: pageSize.value
    })
    list.value = res.list
    total.value = res.total
  } catch {
    // request.ts 已统一提示错误
  } finally {
    loading.value = false
  }
}

/** 拉取各状态数量用于 Tab 角标 */
async function loadCounts() {
  try {
    const results = await Promise.all(
      RUNNER_STATUS_TABS.map((t) => getRunnerApplications({ status: t.value, page: 1, pageSize: 1 }))
    )
    const map: Record<number, number> = {}
    results.forEach((r, i) => {
      map[RUNNER_STATUS_TABS[i]!.value] = r.total
    })
    counts.value = map
  } catch {
    // 角标失败不影响主流程
  }
}

function handleTabChange() {
  page.value = 1
  load()
}

/** 危险操作：通过（二次确认） */
async function handleApprove(app: RunnerApplication) {
  try {
    await ElMessageBox.confirm(`确认通过「${app.realName}」的跑腿员申请？通过后该用户可接单。`, '审核通过', {
      confirmButtonText: '确认通过',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  actingId.value = app.id
  try {
    const res = await approveRunner(app.id)
    ElMessage.success(res.message || '已通过')
    load()
    loadCounts()
  } catch {
    // request.ts 已统一提示错误
  } finally {
    actingId.value = null
  }
}

/** 危险操作：驳回（原因必填，≤200 字） */
async function handleReject(app: RunnerApplication) {
  let reason: string
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回申请', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      type: 'warning',
      inputPlaceholder: '如：学号与姓名不匹配',
      inputValidator: (v: string) => {
        if (!v || !v.trim()) return '原因必填'
        if (v.trim().length > 200) return '原因最长 200 字'
        return true
      }
    })
    reason = value.trim()
  } catch {
    return
  }
  actingId.value = app.id
  try {
    const res = await rejectRunner(app.id, reason)
    ElMessage.success(res.message || '已驳回')
    load()
    loadCounts()
  } catch {
    // request.ts 已统一提示错误
  } finally {
    actingId.value = null
  }
}

onMounted(() => {
  load()
  loadCounts()
})
</script>

<style scoped lang="scss">
.tab-badge {
  margin-left: 6px;
  vertical-align: 2px;
}

.app-list {
  min-height: 200px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.app-card {
  border: 1px solid #e8eeea;
  border-radius: 8px;
  padding: 16px;
  transition:
    transform 0.2s ease-out,
    box-shadow 0.2s ease-out;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(14, 42, 29, 0.08);
  }

  .app-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    .name {
      font-size: 16px;
      font-weight: 600;
    }
  }

  .app-grid {
    display: flex;
    gap: 16px;

    .info {
      flex: 1;
      min-width: 0;
    }

    .kv {
      display: flex;
      margin-bottom: 6px;
      font-size: 13px;

      .k {
        flex-shrink: 0;
        width: 60px;
        color: #8a9a90;
      }

      &.reject span:last-child {
        color: #f56c6c;
      }
    }

    .idcard {
      .k {
        font-size: 13px;
        color: #8a9a90;
        margin-bottom: 6px;
      }

      .idcard-img {
        width: 96px;
        height: 64px;
        border-radius: 4px;
        border: 1px solid #e8eeea;
        cursor: zoom-in;
      }
    }
  }

  .intro {
    margin-top: 10px;
    background: #f7faf8;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 13px;

    .k {
      color: #8a9a90;
      margin-right: 8px;
    }

    p {
      display: inline;
      margin: 0;
      color: #3a4a40;
    }
  }

  .app-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 14px;
  }
}
</style>
