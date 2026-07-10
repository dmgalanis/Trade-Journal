// Pure functions that compute derived behavioral/psychological stats from the
// raw trading_days rows returned by getAnalyticsRawData(). No network calls here —
// everything is plain JS so it's easy to test and cheap to re-run on every render.

import { parseISO, subDays, differenceInCalendarDays, startOfWeek, format } from 'date-fns'

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

function hasPrePlan(row) {
  return !!(
    (row.pre_max_loss !== null && row.pre_max_loss !== undefined) ||
    (row.pre_setups && row.pre_setups.trim()) ||
    (row.pre_mental_state && row.pre_mental_state.trim()) ||
    (row.pre_notes && row.pre_notes.trim())
  )
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

// Mirror of getStreaks, tracking runs of VIOLATION days instead of good days.
// Surfaces how bad the worst stretch got, not just how good the best stretch was.
export function getViolationStreaks(rows) {
  const sorted = [...rows]
    .filter((r) => r.followed_rules !== null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  let longest = 0
  let run = 0
  for (const r of sorted) {
    if (r.followed_rules === false) {
      run += 1
      longest = Math.max(longest, run)
    } else {
      run = 0
    }
  }

  let current = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].followed_rules === false) current += 1
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

// Which emotion shows up most often on each day of the week (logged days,
// regardless of whether rules were followed that day).
export function getDayOfWeekEmotions(rows) {
  const buckets = Array.from({ length: 7 }, () => ({}))
  for (const r of rows) {
    const dow = parseISO(r.entry_date).getDay()
    for (const name of emotionNames(r)) {
      buckets[dow][name] = (buckets[dow][name] || 0) + 1
    }
  }
  return buckets.map((counts, i) => {
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return {
      day: DOW_LABELS[i],
      topEmotion: entries[0]?.[0] ?? null,
      topEmotionCount: entries[0]?.[1] ?? 0,
    }
  })
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

// How many rules tend to break at once on a bad day. Distinguishes "one slip"
// days from "total collapse" days, which the plain adherence rate can't do.
export function getViolationIntensity(rows) {
  const violationDays = rows.filter((r) => r.followed_rules === false)
  if (!violationDays.length) {
    return { avgViolationsPerBadDay: null, maxViolationsInADay: 0, badDayCount: 0 }
  }
  const counts = violationDays.map((r) => ruleNames(r).length)
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length
  return {
    avgViolationsPerBadDay: avg,
    maxViolationsInADay: Math.max(...counts),
    badDayCount: violationDays.length,
  }
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

// Does emotional "load" (how many distinct emotions logged) predict violations,
// independent of which specific emotions they are?
export function getEmotionLoadCorrelation(rows) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  const violationDays = answered.filter((r) => r.followed_rules === false)
  const cleanDays = answered.filter((r) => r.followed_rules === true)
  const avgCount = (list) => {
    if (!list.length) return null
    const counts = list.map((r) => emotionNames(r).length)
    return counts.reduce((a, b) => a + b, 0) / counts.length
  }
  return {
    avgEmotionsOnViolationDays: avgCount(violationDays),
    avgEmotionsOnCleanDays: avgCount(cleanDays),
    violationSample: violationDays.length,
    cleanSample: cleanDays.length,
  }
}

// Emotional analog of the "day after" effect: does feeling a given emotion today
// predict a rule violation TOMORROW (consecutive calendar days only)?
export function getEmotionNextDayEffect(rows, minOccurrences = 2) {
  const sorted = [...rows]
    .filter((r) => r.followed_rules !== null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  const stats = {}
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i]
    const next = sorted[i + 1]
    const gap = differenceInCalendarDays(parseISO(next.entry_date), parseISO(curr.entry_date))
    if (gap !== 1) continue
    for (const em of emotionNames(curr)) {
      if (!stats[em]) stats[em] = { total: 0, nextViolations: 0 }
      stats[em].total += 1
      if (next.followed_rules === false) stats[em].nextViolations += 1
    }
  }

  const baseline = getAdherenceRate(sorted)
  const baselineViolationRate = baseline === null ? null : 1 - baseline

  return Object.entries(stats)
    .filter(([, s]) => s.total >= minOccurrences)
    .map(([name, s]) => ({
      name,
      occurrences: s.total,
      nextDayViolationRate: s.nextViolations / s.total,
      baselineViolationRate,
      delta: baselineViolationRate === null ? null : s.nextViolations / s.total - baselineViolationRate,
    }))
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
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

// From any given violation day, how many logged days pass before the next clean
// (followed_rules === true) day shows up. Averaged across every violation instance,
// so it reads as "how long it typically takes you to get back on track."
export function getRecoveryTime(rows) {
  const sorted = [...rows]
    .filter((r) => r.followed_rules !== null)
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  const recoveries = []
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].followed_rules !== false) continue
    let k = i + 1
    while (k < sorted.length && sorted[k].followed_rules === false) k++
    if (k < sorted.length) recoveries.push(k - i)
  }

  if (!recoveries.length) return { avgDaysToRecover: null, sample: 0 }
  const avg = recoveries.reduce((a, b) => a + b, 0) / recoveries.length
  return { avgDaysToRecover: avg, sample: recoveries.length }
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

// Does the act of writing a pre-session plan (any field filled in) predict
// better rule adherence that day, regardless of what the plan actually said?
export function getPlannedVsUnplannedAdherence(rows) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  const planned = answered.filter(hasPrePlan)
  const unplanned = answered.filter((r) => !hasPrePlan(r))
  return {
    plannedAdherence: getAdherenceRate(planned),
    plannedSample: planned.length,
    unplannedAdherence: getAdherenceRate(unplanned),
    unplannedSample: unplanned.length,
  }
}

// Cross-tabulates "did you follow your plan" against "did you follow your rules".
// The interesting cells are the mismatches: plan followed but rules still broken
// (gap in the plan itself) and plan abandoned but rules still held (plan may be
// overly rigid, or discipline holds independent of the specific plan).
export function getPlanRuleDivergence(rows) {
  const both = rows.filter(
    (r) => r.followed_rules !== null && (r.plan_followed === true || r.plan_followed === false)
  )
  let plannedButViolated = 0
  let deviatedButDisciplined = 0
  let bothGood = 0
  let bothBad = 0
  for (const r of both) {
    if (r.plan_followed === true && r.followed_rules === false) plannedButViolated++
    else if (r.plan_followed === false && r.followed_rules === true) deviatedButDisciplined++
    else if (r.plan_followed === true && r.followed_rules === true) bothGood++
    else if (r.plan_followed === false && r.followed_rules === false) bothBad++
  }
  return { sample: both.length, plannedButViolated, deviatedButDisciplined, bothGood, bothBad }
}

// ---------- Volatility of adherence itself ----------

// Buckets logged days into calendar weeks and computes the adherence rate per
// week, then takes the standard deviation across weeks. Two traders can share
// the same 70% lifetime average while one holds steady and the other swings
// between 100% and 20% — this distinguishes them.
export function getAdherenceVolatility(rows) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  if (!answered.length) return { stdDev: null, mean: null, weeklyRates: [] }

  const weekMap = {}
  for (const r of answered) {
    const weekKey = format(startOfWeek(parseISO(r.entry_date)), 'yyyy-MM-dd')
    if (!weekMap[weekKey]) weekMap[weekKey] = { total: 0, followed: 0 }
    weekMap[weekKey].total += 1
    if (r.followed_rules) weekMap[weekKey].followed += 1
  }

  const weeklyRates = Object.entries(weekMap)
    .map(([week, s]) => ({ week, rate: s.followed / s.total, sample: s.total }))
    .sort((a, b) => a.week.localeCompare(b.week))

  if (weeklyRates.length < 2) return { stdDev: null, mean: weeklyRates[0]?.rate ?? null, weeklyRates }

  const mean = weeklyRates.reduce((sum, w) => sum + w.rate, 0) / weeklyRates.length
  const variance = weeklyRates.reduce((sum, w) => sum + (w.rate - mean) ** 2, 0) / weeklyRates.length
  const stdDev = Math.sqrt(variance)

  return { stdDev, mean, weeklyRates }
}

// Adherence rate bucketed by calendar month, to catch slower-moving seasonal
// patterns that 7/30/90-day rolling windows would smooth over.
export function getMonthlyAdherenceTrend(rows) {
  const answered = rows.filter((r) => r.followed_rules !== null)
  const monthMap = {}
  for (const r of answered) {
    const monthKey = r.entry_date.slice(0, 7) // 'yyyy-MM'
    if (!monthMap[monthKey]) monthMap[monthKey] = { total: 0, followed: 0 }
    monthMap[monthKey].total += 1
    if (r.followed_rules) monthMap[monthKey].followed += 1
  }
  return Object.entries(monthMap)
    .map(([month, s]) => ({ month, adherence: s.followed / s.total, sample: s.total }))
    .sort((a, b) => a.month.localeCompare(b.month))
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

// ---------- Convenience: compute everything at once ----------

export function computeAllAnalytics(rows) {
  return {
    rollingAdherence: getRollingAdherence(rows),
    streaks: getStreaks(rows),
    violationStreaks: getViolationStreaks(rows),
    dayOfWeek: getDayOfWeekBreakdown(rows),
    dayOfWeekEmotions: getDayOfWeekEmotions(rows),
    ruleFrequency: getRuleFrequency(rows),
    ruleTrend: getRuleTrend30Day(rows),
    ruleCoViolation: getRuleCoViolation(rows),
    violationIntensity: getViolationIntensity(rows),
    emotionFrequency: getEmotionFrequency(rows),
    emotionTrend: getEmotionFrequencyTrend(rows),
    emotionCorrelation: getEmotionViolationCorrelation(rows),
    emotionLoadCorrelation: getEmotionLoadCorrelation(rows),
    emotionNextDayEffect: getEmotionNextDayEffect(rows),
    heatmap: getEmotionRuleHeatmap(rows),
    marketConditionRates: getConditionViolationRates(rows, 'market_conditions_master'),
    volatilityRates: getConditionViolationRates(rows, 'volatility_master'),
    journalingConsistency: getJournalingConsistency(rows),
    dayAfterEffect: getDayAfterEffect(rows),
    recoveryTime: getRecoveryTime(rows),
    planAdherence: getPlanAdherence(rows),
    plannedVsUnplanned: getPlannedVsUnplannedAdherence(rows),
    planRuleDivergence: getPlanRuleDivergence(rows),
    adherenceVolatility: getAdherenceVolatility(rows),
    monthlyAdherenceTrend: getMonthlyAdherenceTrend(rows),
    weeklyRollup: getWeeklyRollup(rows),
  }
}
