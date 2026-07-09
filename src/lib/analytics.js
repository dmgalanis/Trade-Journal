// Pure computation helpers for the Analytics page.
// Everything here takes the raw rows from getAnalyticsRawData() and derives
// stats client-side — no extra network calls, no SQL functions to maintain.

import { parseISO, startOfWeek, format, getDay, subDays, isAfter, isEqual } from 'date-fns'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pct(numerator, denominator) {
  if (!denominator) return null
  return Math.round((numerator / denominator) * 100)
}

// ---------- Rule adherence trend (weekly %) ----------
export function computeAdherenceTrend(rows) {
  const weeks = new Map() // weekStartKey -> { total, followed, weekStart }
  for (const row of rows) {
    if (row.followed_rules === null || row.followed_rules === undefined) continue
    const weekStart = startOfWeek(parseISO(row.entry_date), { weekStartsOn: 1 })
    const key = format(weekStart, 'yyyy-MM-dd')
    if (!weeks.has(key)) weeks.set(key, { total: 0, followed: 0, weekStart })
    const w = weeks.get(key)
    w.total += 1
    if (row.followed_rules === true) w.followed += 1
  }
  return Array.from(weeks.values())
    .sort((a, b) => a.weekStart - b.weekStart)
    .map((w) => ({
      week: format(w.weekStart, 'MMM d'),
      pct: pct(w.followed, w.total),
      total: w.total,
    }))
}

// ---------- Streaks ----------
export function computeStreaks(rows) {
  const logged = rows
    .filter((r) => r.followed_rules !== null && r.followed_rules !== undefined)
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))

  let longest = 0
  let running = 0
  for (const row of logged) {
    if (row.followed_rules === true) {
      running += 1
      longest = Math.max(longest, running)
    } else {
      running = 0
    }
  }

  let current = 0
  for (let i = logged.length - 1; i >= 0; i--) {
    if (logged[i].followed_rules === true) current += 1
    else break
  }

  return { current, longest }
}

// ---------- Per-rule trend: last 30 days vs prior 30 days ----------
export function computeRuleTrend(rows) {
  const today = new Date()
  const cutoff30 = subDays(today, 30)
  const cutoff60 = subDays(today, 60)

  const recent = new Map() // rule name -> count
  const prior = new Map()

  for (const row of rows) {
    const d = parseISO(row.entry_date)
    const violations = row.day_violations || []
    for (const v of violations) {
      const name = v.rules_master?.name
      if (!name) continue
      if (isAfter(d, cutoff30) || isEqual(d, cutoff30)) {
        recent.set(name, (recent.get(name) || 0) + 1)
      } else if (isAfter(d, cutoff60) || isEqual(d, cutoff60)) {
        prior.set(name, (prior.get(name) || 0) + 1)
      }
    }
  }

  const allNames = new Set([...recent.keys(), ...prior.keys()])
  return Array.from(allNames)
    .map((name) => {
      const recentCount = recent.get(name) || 0
      const priorCount = prior.get(name) || 0
      return { name, recentCount, priorCount, delta: recentCount - priorCount }
    })
    .sort((a, b) => b.recentCount - a.recentCount)
}

// ---------- Emotion -> violation rate correlation ----------
export function computeEmotionViolationCorrelation(rows) {
  const logged = rows.filter((r) => r.followed_rules !== null && r.followed_rules !== undefined)
  const baselineViolations = logged.filter((r) => r.followed_rules === false).length
  const baselinePct = pct(baselineViolations, logged.length) ?? 0

  const withEmotion = new Map() // emotion name -> { total, violated }
  for (const row of logged) {
    const emotionNames = new Set((row.day_emotions || []).map((e) => e.emotions_master?.name).filter(Boolean))
    for (const name of emotionNames) {
      if (!withEmotion.has(name)) withEmotion.set(name, { total: 0, violated: 0 })
      const e = withEmotion.get(name)
      e.total += 1
      if (row.followed_rules === false) e.violated += 1
    }
  }

  return Array.from(withEmotion.entries())
    .map(([name, { total, violated }]) => ({
      name,
      violationRate: pct(violated, total) ?? 0,
      baseline: baselinePct,
      days: total,
    }))
    .filter((e) => e.days >= 2) // avoid noisy single-day spikes
    .sort((a, b) => b.violationRate - a.violationRate)
}

// ---------- Emotion x Rule co-occurrence heatmap ----------
export function computeEmotionRuleHeatmap(rows) {
  const matrix = new Map() // emotion -> Map(rule -> count)
  const emotionTotals = new Map()
  const ruleTotals = new Map()
  let max = 0

  for (const row of rows) {
    if (row.followed_rules !== false) continue
    const emotionNames = (row.day_emotions || []).map((e) => e.emotions_master?.name).filter(Boolean)
    const ruleNames = (row.day_violations || []).map((v) => v.rules_master?.name).filter(Boolean)
    for (const emotion of emotionNames) {
      if (!matrix.has(emotion)) matrix.set(emotion, new Map())
      const ruleMap = matrix.get(emotion)
      for (const rule of ruleNames) {
        const count = (ruleMap.get(rule) || 0) + 1
        ruleMap.set(rule, count)
        max = Math.max(max, count)
        emotionTotals.set(emotion, (emotionTotals.get(emotion) || 0) + 1)
        ruleTotals.set(rule, (ruleTotals.get(rule) || 0) + 1)
      }
    }
  }

  const emotions = Array.from(emotionTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name)
  const rules = Array.from(ruleTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name)

  return { emotions, rules, matrix, max }
}

// ---------- Market condition / volatility -> violation rate ----------
export function computeConditionViolationRate(rows, field) {
  // field: 'market_conditions_master' or 'volatility_master'
  const buckets = new Map() // name -> { total, violated }
  for (const row of rows) {
    if (row.followed_rules === null || row.followed_rules === undefined) continue
    const name = row[field]?.name
    if (!name) continue
    if (!buckets.has(name)) buckets.set(name, { total: 0, violated: 0 })
    const b = buckets.get(name)
    b.total += 1
    if (row.followed_rules === false) b.violated += 1
  }
  return Array.from(buckets.entries())
    .map(([name, { total, violated }]) => ({ name, violationRate: pct(violated, total) ?? 0, days: total }))
    .sort((a, b) => b.violationRate - a.violationRate)
}

// ---------- Day-of-week breakdown ----------
export function computeDayOfWeekBreakdown(rows) {
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, violated: 0 }))
  for (const row of rows) {
    if (row.followed_rules === null || row.followed_rules === undefined) continue
    const dow = getDay(parseISO(row.entry_date))
    buckets[dow].total += 1
    if (row.followed_rules === false) buckets[dow].violated += 1
  }
  // Mon-Fri only — weekends will almost always be empty for a trading journal
  return [1, 2, 3, 4, 5].map((dow) => ({
    day: DAY_NAMES[dow],
    violationRate: pct(buckets[dow].violated, buckets[dow].total) ?? 0,
    days: buckets[dow].total,
  }))
}

// ---------- Emotion frequency trend (top 5 emotions, weekly counts) ----------
export function computeEmotionFrequencyTrend(rows) {
  const totals = new Map()
  for (const row of rows) {
    for (const e of row.day_emotions || []) {
      const name = e.emotions_master?.name
      if (!name) continue
      totals.set(name, (totals.get(name) || 0) + 1)
    }
  }
  const topEmotions = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name)

  const weeks = new Map() // weekKey -> { weekStart, [emotion]: count }
  for (const row of rows) {
    const weekStart = startOfWeek(parseISO(row.entry_date), { weekStartsOn: 1 })
    const key = format(weekStart, 'yyyy-MM-dd')
    if (!weeks.has(key)) {
      const base = { weekStart }
      for (const name of topEmotions) base[name] = 0
      weeks.set(key, base)
    }
    const w = weeks.get(key)
    for (const e of row.day_emotions || []) {
      const name = e.emotions_master?.name
      if (topEmotions.includes(name)) w[name] += 1
    }
  }

  const data = Array.from(weeks.values())
    .sort((a, b) => a.weekStart - b.weekStart)
    .map((w) => ({ ...w, week: format(w.weekStart, 'MMM d') }))

  return { topEmotions, data }
}

// ---------- This week / this month rollup ----------
export function computeRollup(rows) {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const monthKey = format(now, 'yyyy-MM')

  const summarize = (filtered) => {
    const logged = filtered.filter((r) => r.followed_rules !== null && r.followed_rules !== undefined)
    const followedCount = logged.filter((r) => r.followed_rules === true).length
    const ruleCounts = new Map()
    const emotionCounts = new Map()
    for (const row of filtered) {
      for (const v of row.day_violations || []) {
        const name = v.rules_master?.name
        if (name) ruleCounts.set(name, (ruleCounts.get(name) || 0) + 1)
      }
      for (const e of row.day_emotions || []) {
        const name = e.emotions_master?.name
        if (name) emotionCounts.set(name, (emotionCounts.get(name) || 0) + 1)
      }
    }
    const topRule = Array.from(ruleCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    const topEmotion = Array.from(emotionCounts.entries()).sort((a, b) => b[1] - a[1])[0]
    return {
      loggedDays: filtered.length,
      adherencePct: pct(followedCount, logged.length),
      topRule: topRule ? topRule[0] : null,
      topEmotion: topEmotion ? topEmotion[0] : null,
    }
  }

  const weekRows = rows.filter((r) => parseISO(r.entry_date) >= weekStart)
  const monthRows = rows.filter((r) => r.entry_date.startsWith(monthKey))

  return { week: summarize(weekRows), month: summarize(monthRows) }
}

// ---------- Plan adherence: short/medium/long term ----------
export function computePlanAdherence(rows) {
  const now = new Date()
  const windows = [
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
  ]
  return windows.map(({ label, days }) => {
    const cutoff = subDays(now, days)
    const inWindow = rows.filter(
      (r) => parseISO(r.entry_date) >= cutoff && r.plan_followed !== null && r.plan_followed !== undefined
    )
    const followed = inWindow.filter((r) => r.plan_followed === true).length
    return { label, pct: pct(followed, inWindow.length), rated: inWindow.length }
  })
}
