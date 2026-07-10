// Pure functions that compute derived behavioral/psychological stats from the
// raw trading_days rows returned by getAnalyticsRawData(). No network calls here —
// everything is plain JS so it's easy to test and cheap to re-run on every render.

import { parseISO, subDays, differenceInCalendarDays } from 'date-fns'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function inLastNDays(rows, days, from = new Date()) {
  const cutoff = subDays(from, days)
  return rows.filter((r) => parseISO(r.entry_date) >= cutoff)
}

function ruleNames(row) {
  return (row.day_violations || []).map((v) => v.rules_master?.name).filter(Boolean)
}

function emotionNames(row) {
  return (row.day_emotions || []).map((e) => e.emotions_master?.name).filter(Boolean)
}

// ---------- Adherence ----------

export function getAdherenceRate(rows) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  if (!answered.length) return null
  const followed = answered.filter((r) => r.followed_rules === true).length
  return followed / answered.length
}

export function getRollingAdherence(rows) {
  return {
    d7: getAdherenceRate(inLastNDays(rows, 7)),
    d30: getAdherenceRate(inLastNDays(rows, 30)),
    d90: getAdherenceRate(inLastNDays(rows, 90)),
  }
}

// ---------- Streaks ----------

export function getStreaks(rows) {
  const sorted = [...rows]
    .filter((r) => r.followed_rules !== null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  let longest = 0
  let run = 0
  for (const r of sorted) {
    if (r.followed_rules === true) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  let current = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].followed_rules === true) current += 1
    else break
  }

  return { current, longest }
}

// ---------- Day-of-week breakdown ----------

export function getDayOfWeekBreakdown(rows) {
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, followed: 0 }))
  for (const r of rows) {
    if (r.followed_rules === null) continue
    const dow = parseISO(r.entry_date).getDay()
    buckets[dow].total += 1
    if (r.followed_rules) buckets[dow].followed += 1
  }
  return buckets.map((b, i) => ({
    day: DOW_LABELS[i],
    total: b.total,
    violationRate: b.total ? 1 - b.followed / b.total : null,
  }))
}

// ---------- Rule frequency & trend ----------

export function getRuleFrequency(rows) {
  const counts = {}
  for (const r of rows) {
    for (const name of ruleNames(r)) counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getRuleTrend30Day(rows, from = new Date()) {
  const last30 = inLastNDays(rows, 30, from)
  const prev30 = rows.filter((r) => {
    const d = parseISO(r.entry_date)
    return d >= subDays(from, 60) && d < subDays(from, 30)
  })
  const countBy = (list) => {
    const c = {}
    for (const r of list) for (const name of ruleNames(r)) c[name] = (c[name] || 0) + 1
    return c
  }
  const curr = countBy(last30)
  const prev = countBy(prev30)
  const names = new Set([...Object.keys(curr), ...Object.keys(prev)])
  return [...names]
    .map((name) => ({
      name,
      current: curr[name] || 0,
      previous: prev[name] || 0,
      delta: (curr[name] || 0) - (prev[name] || 0),
    }))
    .sort((a, b) => b.current - a.current)
}

export function getRuleCoViolation(rows, limit = 10) {
  const pairCounts = {}
  for (const r of rows) {
    const names = ruleNames(r)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join(' + ')
        pairCounts[key] = (pairCounts[key] || 0) + 1
      }
    }
  }
  return Object.entries(pairCounts)
    .map(([pair, count]) => ({ pair, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

// ---------- Emotions ----------

export function getEmotionFrequency(rows) {
  const counts = {}
  for (const r of rows) {
    for (const name of emotionNames(r)) counts[name] = (counts[name] || 0) + 1
  }
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getEmotionFrequencyTrend(rows, from = new Date()) {
  const last30 = getEmotionFrequency(inLastNDays(rows, 30, from))
  const prev30 = getEmotionFrequency(
    rows.filter((r) => {
      const d = parseISO(r.entry_date)
      return d >= subDays(from, 60) && d < subDays(from, 30)
    })
  )
  const prevMap = Object.fromEntries(prev30.map((e) => [e.name, e.count]))
  return last30.map((e) => ({ ...e, delta: e.count - (prevMap[e.name] || 0) }))
}

export function getEmotionViolationCorrelation(rows, minOccurrences = 2) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  const baseline = getAdherenceRate(answered)
  const baselineViolationRate = baseline === null ? null : 1 - baseline

  const stats = {}
  for (const r of answered) {
    for (const name of emotionNames(r)) {
      if (!stats[name]) stats[name] = { total: 0, violations: 0 }
      stats[name].total += 1
      if (r.followed_rules === false) stats[name].violations += 1
    }
  }

  return Object.entries(stats)
    .filter(([, s]) => s.total >= minOccurrences)
    .map(([name, s]) => ({
      name,
      occurrences: s.total,
      violationRate: s.violations / s.total,
      baselineViolationRate,
      delta: baselineViolationRate === null ? null : s.violations / s.total - baselineViolationRate,
    }))
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
}

// emotion x rule co-occurrence, counted on violation days only
export function getEmotionRuleHeatmap(rows) {
  const matrix = {}
  const ruleSet = new Set()
  const emotionSet = new Set()

  for (const r of rows) {
    if (r.followed_rules !== false) continue
    const emotionsToday = emotionNames(r)
    const rulesToday = ruleNames(r)
    for (const em of emotionsToday) {
      emotionSet.add(em)
      if (!matrix[em]) matrix[em] = {}
      for (const rule of rulesToday) {
        ruleSet.add(rule)
        matrix[em][rule] = (matrix[em][rule] || 0) + 1
      }
    }
  }

  return { emotions: [...emotionSet], rules: [...ruleSet], matrix }
}

// ---------- Market condition / volatility ----------

export function getConditionViolationRates(rows, field = 'market_conditions_master') {
  const stats = {}
  for (const r of rows) {
    if (r.followed_rules === null) continue
    const name = r[field]?.name
    if (!name) continue
    if (!stats[name]) stats[name] = { total: 0, violations: 0 }
    stats[name].total += 1
    if (r.followed_rules === false) stats[name].violations += 1
  }
  return Object.entries(stats)
    .map(([name, s]) => ({ name, total: s.total, violationRate: s.violations / s.total }))
    .sort((a, b) => b.violationRate - a.violationRate)
}

// ---------- Journaling consistency & "day after" effect ----------

export function getJournalingConsistency(rows, days = 30, from = new Date()) {
  return { loggedDays: inLastNDays(rows, days, from).length, windowDays: days }
}

export function getDayAfterEffect(rows) {
  const sorted = [...rows]
    .filter((r) => r.followed_rules !== null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  let afterViolationTotal = 0
  let afterViolationViolated = 0
  let afterCleanTotal = 0
  let afterCleanViolated = 0

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    const gap = differenceInCalendarDays(parseISO(curr.entry_date), parseISO(prev.entry_date))
    if (gap !== 1) continue // only count consecutive calendar days
    if (prev.followed_rules === false) {
      afterViolationTotal += 1
      if (curr.followed_rules === false) afterViolationViolated += 1
    } else {
      afterCleanTotal += 1
      if (curr.followed_rules === false) afterCleanViolated += 1
    }
  }

  return {
    afterViolationRate: afterViolationTotal ? afterViolationViolated / afterViolationTotal : null,
    afterCleanRate: afterCleanTotal ? afterCleanViolated / afterCleanTotal : null,
    afterViolationSample: afterViolationTotal,
    afterCleanSample: afterCleanTotal,
  }
}

// ---------- Pre-Session Plan adherence ----------

export function getPlanAdherence(rows) {
  const rated = rows.filter((r) => r.plan_followed === true || r.plan_followed === false)
  const rate = (list) => {
    if (!list.length) return null
    return list.filter((r) => r.plan_followed === true).length / list.length
  }
  return {
    d7: rate(inLastNDays(rated, 7)),
    d30: rate(inLastNDays(rated, 30)),
    d90: rate(inLastNDays(rated, 90)),
  }
}

// ---------- Weekly rollup ----------

export function getWeeklyRollup(rows, from = new Date()) {
  const last7 = inLastNDays(rows, 7, from)
  const prev7 = rows.filter((r) => {
    const d = parseISO(r.entry_date)
    return d >= subDays(from, 14) && d < subDays(from, 7)
  })
  return {
    adherence: getAdherenceRate(last7),
    prevAdherence: getAdherenceRate(prev7),
    topEmotion: getEmotionFrequency(last7)[0]?.name ?? null,
    topViolation: getRuleFrequency(last7)[0]?.name ?? null,
    daysLogged: last7.length,
  }
}

// ---------- Arbitrary-period stats (for AI rollup summaries) ----------

// Scopes the same building blocks used elsewhere to an arbitrary [startDate, endDateExclusive)
// range, and also pulls along each day's already-generated ai_summary text (if any) so the
// rollup-summary Edge Function can synthesize across the individual daily write-ups, not just
// the numbers. startDate/endDateExclusive are JS Date objects.
export function getPeriodStats(rows, startDate, endDateExclusive) {
  const period = rows.filter((r) => {
    const d = parseISO(r.entry_date)
    return d >= startDate && d < endDateExclusive
  })

  const rated = period.filter((r) => r.plan_followed === true || r.plan_followed === false)

  return {
    daysLogged: period.length,
    adherence: getAdherenceRate(period),
    planAdherence: rated.length ? rated.filter((r) => r.plan_followed === true).length / rated.length : null,
    topViolations: getRuleFrequency(period).slice(0, 5),
    topEmotions: getEmotionFrequency(period).slice(0, 5),
    dailySummaries: period
      .filter((r) => r.ai_summary)
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
      .map((r) => ({ date: r.entry_date, summary: r.ai_summary })),
  }
}

// ---------- Convenience: compute everything at once ----------

export function computeAllAnalytics(rows) {
  return {
    rollingAdherence: getRollingAdherence(rows),
    streaks: getStreaks(rows),
    dayOfWeek: getDayOfWeekBreakdown(rows),
    ruleFrequency: getRuleFrequency(rows),
    ruleTrend: getRuleTrend30Day(rows),
    ruleCoViolation: getRuleCoViolation(rows),
    emotionFrequency: getEmotionFrequency(rows),
    emotionTrend: getEmotionFrequencyTrend(rows),
    emotionCorrelation: getEmotionViolationCorrelation(rows),
    heatmap: getEmotionRuleHeatmap(rows),
    marketConditionRates: getConditionViolationRates(rows, 'market_conditions_master'),
    volatilityRates: getConditionViolationRates(rows, 'volatility_master'),
    journalingConsistency: getJournalingConsistency(rows),
    dayAfterEffect: getDayAfterEffect(rows),
    planAdherence: getPlanAdherence(rows),
    weeklyRollup: getWeeklyRollup(rows),
  }
}
