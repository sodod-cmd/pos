// Mongolia is UTC+8 all year, so day boundaries can be computed with a fixed offset.
export const TIME_ZONE = 'Asia/Ulaanbaatar'
const OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** Midnight in Ulaanbaatar, `daysAgo` days before the day of `from`. */
export function startOfDay(daysAgo = 0, from = new Date()) {
  const local = from.getTime() + OFFSET_MS
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS - daysAgo * DAY_MS)
}

/** First day of the month in Ulaanbaatar, `monthsAgo` months back. */
export function startOfMonth(monthsAgo = 0, from = new Date()) {
  const local = new Date(from.getTime() + OFFSET_MS)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - monthsAgo, 1) - OFFSET_MS)
}

/** "2026-11-09" in Ulaanbaatar time, matching Mongo's $dateToString with the same zone. */
export function dayKey(date: Date) {
  return new Date(date.getTime() + OFFSET_MS).toISOString().slice(0, 10)
}

export { DAY_MS }
