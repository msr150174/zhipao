<template>
  <div class="stat-card">
    <div class="stat-top">
      <span class="stat-icon" :style="{ background: accent + '1a', color: accent }">{{ icon }}</span>
      <span v-if="trend" class="stat-trend" :class="trendClass">{{ trend }}</span>
    </div>

    <div class="stat-value">
      <span v-if="prefix" class="stat-prefix">{{ prefix }}</span>
      <span class="stat-number">{{ displayValue }}</span>
    </div>

    <div class="stat-title">{{ title }}</div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 数据卡片
 *
 * 数值做了千分位格式化；金额由父组件传入已格式化的字符串时不再重复处理。
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    icon?: string
    title?: string
    value?: string | number
    prefix?: string
    accent?: string
    trend?: string
    trendType?: 'up' | 'down' | 'neutral'
  }>(),
  {
    icon: '📦',
    title: '',
    value: 0,
    prefix: '',
    accent: '#22C55E',
    trend: '',
    trendType: 'neutral'
  }
)

const displayValue = computed(() => {
  const v = props.value
  if (typeof v === 'string') return v
  const n = Number(v || 0)
  return n.toLocaleString('zh-CN')
})

const trendClass = computed(() => `is-${props.trendType}`)
</script>

<style lang="scss" scoped>
.stat-card {
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: transform var(--dur) var(--ease), box-shadow var(--dur) var(--ease);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow);
  }
}

.stat-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.stat-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.stat-trend {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;

  &.is-up {
    color: #16a34a;
    background: #dcfce7;
  }

  &.is-down {
    color: #dc2626;
    background: #fee2e2;
  }

  &.is-neutral {
    color: var(--text-2);
    background: #f3f4f6;
  }
}

.stat-value {
  display: flex;
  align-items: baseline;
  gap: 2px;
}

.stat-prefix {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
}

.stat-number {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.2;
}

.stat-title {
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-2);
}
</style>
