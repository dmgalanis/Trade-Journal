import { supabase } from './supabaseClient'

// ---------- MASTER LISTS ----------

const masterTables = {
  rules: 'rules_master',
  emotions: 'emotions_master',
  marketConditions: 'market_conditions_master',
  volatility: 'volatility_master',
}

export async function getMasterList(listKey) {
  const table = masterTables[listKey]
  const { data, error } = await supabase.from(table).select('*').order('name')
  if (error) throw error
  return data
}

export async function addMasterItem(listKey, name, userId) {
  const table = masterTables[listKey]
  const { data, error } = await supabase
    .from(table)
    .insert({ name, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMasterItem(listKey, id) {
  const table = masterTables[listKey]
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

// ---------- TRADING DAYS ----------

export async function getTradingDay(userId, entryDate) {
  const { data, error } = await supabase
    .from('trading_days')
    .select(
      `*, day_violations(rule_id), day_emotions(emotion_id), screenshots(id, storage_path)`
    )
    .eq('user_id', userId)
    .eq('entry_date', entryDate)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getMonthTradingDays(userId, year, month) {
  // month: 1-12
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const end = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  const { data, error } = await supabase
    .from('trading_days')
    .select('id, entry_date, followed_rules')
    .eq('user_id', userId)
    .gte('entry_date', start)
    .lt('entry_date', end)
  if (error) throw error
  return data
}

export async function upsertTradingDay(userId, entryDate, fields) {
  const { data, error } = await supabase
    .from('trading_days')
    .upsert(
      { user_id: userId, entry_date: entryDate, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,entry_date' }
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function setDayViolations(tradingDayId, ruleIds) {
  await supabase.from('day_violations').delete().eq('trading_day_id', tradingDayId)
  if (ruleIds.length === 0) return
  const rows = ruleIds.map((rule_id) => ({ trading_day_id: tradingDayId, rule_id }))
  const { error } = await supabase.from('day_violations').insert(rows)
  if (error) throw error
}

export async function setDayEmotions(tradingDayId, emotionIds) {
  await supabase.from('day_emotions').delete().eq('trading_day_id', tradingDayId)
  if (emotionIds.length === 0) return
  const rows = emotionIds.map((emotion_id) => ({ trading_day_id: tradingDayId, emotion_id }))
  const { error } = await supabase.from('day_emotions').insert(rows)
  if (error) throw error
}

// ---------- SCREENSHOTS ----------

export async function uploadScreenshot(userId, tradingDayId, file) {
  const path = `${userId}/${tradingDayId}/${Date.now()}_${file.name}`
  const { error: uploadError } = await supabase.storage.from('screenshots').upload(path, file)
  if (uploadError) throw uploadError
  const { data, error } = await supabase
    .from('screenshots')
    .insert({ trading_day_id: tradingDayId, storage_path: path })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getScreenshotUrl(storagePath) {
  const { data, error } = await supabase.storage
    .from('screenshots')
    .createSignedUrl(storagePath, 60 * 60) // 1 hour
  if (error) throw error
  return data.signedUrl
}

export async function deleteScreenshot(id, storagePath) {
  await supabase.storage.from('screenshots').remove([storagePath])
  const { error } = await supabase.from('screenshots').delete().eq('id', id)
  if (error) throw error
}

// ---------- ANALYTICS ----------
// One wide fetch that pulls everything the Analytics page needs (adherence,
// emotions, violations, plan-vs-reality, market conditions/volatility) so we
// only hit the network once and compute all derived stats client-side.
export async function getAnalyticsRawData(userId) {
  const { data, error } = await supabase
    .from('trading_days')
    .select(
      `entry_date,
       followed_rules,
       plan_followed,
       market_conditions_master(name),
       volatility_master(name),
       day_violations(rule_id, rules_master(name)),
       day_emotions(emotion_id, emotions_master(name))`
    )
    .eq('user_id', userId)
    .order('entry_date', { ascending: true })
  if (error) throw error
  return data
}

// ---------- AI SUMMARY ----------

export async function generateAiSummary(payload) {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const res = await fetch(`${supabaseUrl}/functions/v1/ai-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`AI summary failed: ${text}`)
  }
  const data = await res.json()
  return data.summary
}
