<template>
  <div ref="chartRef" class="trend-chart"></div>
</template>

<script lang="ts" setup>
/**
 * 趋势折线图（ECharts）
 *
 * 双 Y 轴：左轴订单数，右轴金额。金额和订单数量级差很多，
 * 共用一根轴会把订单数压成一条直线。
 *
 * 组件卸载时销毁实例，避免 resize 监听泄漏。
 */
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(
  defineProps<{
    dates?: string[]
    orders?: number[]
    revenue?: number[]
    height?: string
  }>(),
  {
    dates: () => [],
    orders: () => [],
    revenue: () => [],
    height: '320px'
  }
)

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function buildOption() {
  return {
    grid: { left: 48, right: 56, top: 40, bottom: 32 },
    tooltip: { trigger: 'axis' },
    legend: { right: 0, top: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10 },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: props.dates,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280' },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '订单',
        minInterval: 1,
        nameTextStyle: { color: '#9CA3AF' },
        axisLabel: { color: '#6B7280' },
        splitLine: { lineStyle: { color: '#F0F1F3' } }
      },
      {
        type: 'value',
        name: '金额',
        nameTextStyle: { color: '#9CA3AF' },
        axisLabel: { color: '#6B7280' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '订单数',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: props.orders,
        yAxisIndex: 0,
        itemStyle: { color: '#22C55E' },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(34,197,94,0.22)' },
            { offset: 1, color: 'rgba(34,197,94,0)' }
          ])
        }
      },
      {
        name: '金额',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: props.revenue,
        yAxisIndex: 1,
        itemStyle: { color: '#3B82F6' },
        lineStyle: { width: 2.5 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59,130,246,0.18)' },
            { offset: 1, color: 'rgba(59,130,246,0)' }
          ])
        }
      }
    ]
  }
}

function render() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  chart.setOption(buildOption(), true)
}

function onResize() {
  chart?.resize()
}

onMounted(async () => {
  await nextTick()
  render()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})

watch(() => [props.dates, props.orders, props.revenue], render, { deep: true })
</script>

<style lang="scss" scoped>
.trend-chart {
  width: 100%;
  height: v-bind(height);
}
</style>
