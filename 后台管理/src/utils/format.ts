/** 金额格式化：¥XX.XX 两位小数 */
export function formatMoney(v: number | null | undefined): string {
  const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0
  return `¥${n.toFixed(2)}`
}

/** 带符号金额：收入 +¥ / 支出 -¥ */
export function formatSignedMoney(v: number | null | undefined, positive: boolean): string {
  const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0
  return `${positive ? '+' : '-'}¥${Math.abs(n).toFixed(2)}`
}

/** 空值兜底展示 */
export function orDash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}
