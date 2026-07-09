import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import EditableChecklist from '../components/EditableChecklist'
import EditableDropdown from '../components/EditableDropdown'
import {
  getMasterList,
  addMasterItem,
  deleteMasterItem,
  getTradingDay,
  upsertTradingDay,
  setDayViolations,
  setDayEmotions,
  uploadScreenshot,
  getScreenshotUrl,
  deleteScreenshot,
  generateAiSummary,
} from '../lib/api'
import { format, parseISO } from 'date-fns'

export default function DayDetail() {
  const { date } = useParams() // yyyy-MM-dd
  const { user } = useAuth()
  const navigate = useNavigate()

  const [rules, setRules] = useState([])
  const [emotions, setEmotions] = useState([])
  const [marketConditions, setMarketConditions] = useState([])
  const [volatilities, setVolatilities] = useState([])

  const [tradingDayId, setTradingDayId] = useState(null)
  const [followedRules, setFollowedRules] = useState(null) // true/false/null
  const [selectedViolations, setSelectedViolations] = useState([])
  const [selectedEmotions, setSelectedEmotions] = useState([])
  const [marketConditionId, setMarketConditionId] = useState(null)
  const [volatilityId, setVolatilityId] = useState(null)
  const [notes, setNotes] = useState('')
  const [improvements, setImprovements] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [screenshots, setScreenshots] = useState([]) // [{id, storage_path, url}]
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // Pre-Session Plan
  const [planMaxLoss, setPlanMaxLoss] = useState('')
  const [planSetups, setPlanSetups] = useState('')
  const [planMentalState, setPlanMentalState] = useState('')
  const [planNotes, setPlanNotes] = useState('')

  // Post-Session Review
  const [planFollowed, setPlanFollowed] = useState(null) // true/false/null
  const [planDeviationNotes, setPlanDeviationNotes] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingSummary, setGeneratingSummary] = useState(false)

  const loadAll = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const [rulesData, emotionsData, mcData, volData, dayEntry] = await Promise.all([
      getMasterList('rules'),
      getMasterList('emotions'),
      getMasterList('marketConditions'),
      getMasterList('volatility'),
      getTradingDay(user.id, date),
    ])
    setRules(rulesData)
    setEmotions(emotionsData)
    setMarketConditions(mcData)
    setVolatilities(volData)

    if (dayEntry) {
      setTradingDayId(dayEntry.id)
      setFollowedRules(dayEntry.followed_rules)
      setMarketConditionId(dayEntry.market_condition_id)
      setVolatilityId(dayEntry.volatility_id)
      setNotes(dayEntry.notes || '')
      setImprovements(dayEntry.improvements || '')
      setAiSummary(dayEntry.ai_summary || '')
      setSelectedViolations((dayEntry.day_violations || []).map((v) => v.rule_id))
      setSelectedEmotions((dayEntry.day_emotions || []).map((e) => e.emotion_id))

      setPlanMaxLoss(dayEntry.plan_max_loss ?? '')
      setPlanSetups(dayEntry.plan_setups || '')
      setPlanMentalState(dayEntry.plan_mental_state || '')
      setPlanNotes(dayEntry.plan_notes || '')
      setPlanFollowed(dayEntry.plan_followed)
      setPlanDeviationNotes(dayEntry.plan_deviation_notes || '')

      const shots = dayEntry.screenshots || []
      const withUrls = await Promise.all(
        shots.map(async (s) => ({ ...s, url: await getScreenshotUrl(s.storage_path) }))
      )
      setScreenshots(withUrls)
    } else {
      setTradingDayId(null)
      setFollowedRules(null)
      setMarketConditionId(null)
      setVolatilityId(null)
      setNotes('')
      setImprovements('')
      setAiSummary('')
      setSelectedViolations([])
      setSelectedEmotions([])
      setScreenshots([])
      setPlanMaxLoss('')
      setPlanSetups('')
      setPlanMentalState('')
      setPlanNotes('')
      setPlanFollowed(null)
      setPlanDeviationNotes('')
    }
    setLoading(false)
  }, [user, date])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Ensures a trading_days row exists, returns its id
  const ensureDayRow = async (fields = {}) => {
    const row = await upsertTradingDay(user.id, date, fields)
    setTradingDayId(row.id)
    return row.id
  }

  const handleFollowedRules = async (value) => {
    setFollowedRules(value)
    setSaving(true)
    try {
      const id = await ensureDayRow({ followed_rules: value })
      if (value === true) {
        setSelectedViolations([])
        await setDayViolations(id, [])
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleViolation = async (ruleId) => {
    const next = selectedViolations.includes(ruleId)
      ? selectedViolations.filter((id) => id !== ruleId)
      : [...selectedViolations, ruleId]
    setSelectedViolations(next)
    setSaving(true)
    try {
      const id = tradingDayId || (await ensureDayRow({ followed_rules: false }))
      await setDayViolations(id, next)
    } finally {
      setSaving(false)
    }
  }

  const toggleEmotion = async (emotionId) => {
    const next = selectedEmotions.includes(emotionId)
      ? selectedEmotions.filter((id) => id !== emotionId)
      : [...selectedEmotions, emotionId]
    setSelectedEmotions(next)
    setSaving(true)
    try {
      const id = tradingDayId || (await ensureDayRow())
      await setDayEmotions(id, next)
    } finally {
      setSaving(false)
    }
  }

  const handleMarketConditionChange = async (id) => {
    setMarketConditionId(id)
    setSaving(true)
    try {
      await ensureDayRow({ market_condition_id: id })
    } finally {
      setSaving(false)
    }
  }

  const handleVolatilityChange = async (id) => {
    setVolatilityId(id)
    setSaving(true)
    try {
      await ensureDayRow({ volatility_id: id })
    } finally {
      setSaving(false)
    }
  }

  const handleTextBlur = async (field, value) => {
    setSaving(true)
    try {
      await ensureDayRow({ [field]: value })
    } finally {
      setSaving(false)
    }
  }

  const handleNumberBlur = async (field, value) => {
    setSaving(true)
    try {
      const parsed = value === '' ? null : Number(value)
      await ensureDayRow({ [field]: parsed })
    } finally {
      setSaving(false)
    }
  }

  const handlePlanFollowed = async (value) => {
    setPlanFollowed(value)
    setSaving(true)
    try {
      await ensureDayRow({ plan_followed: value })
    } finally {
      setSaving(false)
    }
  }

  const handleAddMaster = async (listKey, setList, name) => {
    const item = await addMasterItem(listKey, name, user.id)
    setList((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)))
  }

  const handleDeleteMaster = async (listKey, setList, id) => {
    await deleteMasterItem(listKey, id)
    setList((prev) => prev.filter((i) => i.id !== id))
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setSaving(true)
    try {
      const id = tradingDayId || (await ensureDayRow())
      const record = await uploadScreenshot(user.id, id, file)
      const url = await getScreenshotUrl(record.storage_path)
      setScreenshots((prev) => [...prev, { ...record, url }])
    } finally {
      setSaving(false)
      e.target.value = ''
    }
  }

  const handleDeleteScreenshot = async (shot) => {
    await deleteScreenshot(shot.id, shot.storage_path)
    setScreenshots((prev) => prev.filter((s) => s.id !== shot.id))
  }

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true)
    try {
      const violationNames = rules
        .filter((r) => selectedViolations.includes(r.id))
        .map((r) => r.name)
      const emotionNames = emotions
        .filter((e) => selectedEmotions.includes(e.id))
        .map((e) => e.name)
      const marketConditionName = marketConditions.find((m) => m.id === marketConditionId)?.name
      const volatilityName = volatilities.find((v) => v.id === volatilityId)?.name

      const summary = await generateAiSummary({
        entry_date: date,
        followed_rules: followedRules,
        violations: violationNames,
        emotions: emotionNames,
        market_condition: marketConditionName,
        volatility: volatilityName,
        notes,
        improvements,
        plan_setups: planSetups,
        plan_mental_state: planMentalState,
        plan_followed: planFollowed,
        plan_deviation_notes: planDeviationNotes,
        screenshot_urls: screenshots.map((s) => s.url),
      })
      setAiSummary(summary)
      await ensureDayRow({ ai_summary: summary })
    } catch (err) {
      alert('Could not generate summary: ' + err.message)
    } finally {
      setGeneratingSummary(false)
    }
  }

  if (loading) return <p className="loading-note">Loading…</p>

  return (
    <div className="day-detail-page">
      <div className="day-detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Calendar
        </button>
        <h2>{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</h2>
        <span className="save-indicator">{saving ? 'Saving…' : ''}</span>
      </div>

      <section className="day-section plan-section">
        <h3>Pre-Session Plan</h3>
        <p className="section-hint">Fill this in before the session starts</p>

        <label className="field-label" htmlFor="plan-max-loss">Max loss for the day</label>
        <input
          id="plan-max-loss"
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="e.g. 500"
          value={planMaxLoss}
          onChange={(e) => setPlanMaxLoss(e.target.value)}
          onBlur={(e) => handleNumberBlur('plan_max_loss', e.target.value)}
        />

        <label className="field-label" htmlFor="plan-setups">Setups I'm watching for</label>
        <textarea
          id="plan-setups"
          rows={3}
          placeholder="What setups or conditions are you looking for today?"
          value={planSetups}
          onChange={(e) => setPlanSetups(e.target.value)}
          onBlur={(e) => handleTextBlur('plan_setups', e.target.value)}
        />

        <label className="field-label" htmlFor="plan-mental-state">Mental state going in</label>
        <input
          id="plan-mental-state"
          type="text"
          placeholder="e.g. calm and rested, distracted, anxious about yesterday"
          value={planMentalState}
          onChange={(e) => setPlanMentalState(e.target.value)}
          onBlur={(e) => handleTextBlur('plan_mental_state', e.target.value)}
        />

        <label className="field-label" htmlFor="plan-notes">Other plan notes</label>
        <textarea
          id="plan-notes"
          rows={3}
          placeholder="Anything else you're committing to before the bell"
          value={planNotes}
          onChange={(e) => setPlanNotes(e.target.value)}
          onBlur={(e) => handleTextBlur('plan_notes', e.target.value)}
        />
      </section>

      <section className="day-section">
        <h3>Did you follow your rules today?</h3>
        <div className="yes-no-toggle">
          <button
            className={followedRules === true ? 'active-yes' : ''}
            onClick={() => handleFollowedRules(true)}
          >
            Yes
          </button>
          <button
            className={followedRules === false ? 'active-no' : ''}
            onClick={() => handleFollowedRules(false)}
          >
            No
          </button>
        </div>

        {followedRules === false && (
          <div className="violations-block">
            <h4>Which rules were violated?</h4>
            <EditableChecklist
              items={rules}
              selectedIds={selectedViolations}
              onToggle={toggleViolation}
              onAdd={(name) => handleAddMaster('rules', setRules, name)}
              onDelete={(id) => handleDeleteMaster('rules', setRules, id)}
            />
          </div>
        )}
      </section>

      <section className="day-section">
        <h3>Emotions felt</h3>
        <EditableChecklist
          items={emotions}
          selectedIds={selectedEmotions}
          onToggle={toggleEmotion}
          onAdd={(name) => handleAddMaster('emotions', setEmotions, name)}
          onDelete={(id) => handleDeleteMaster('emotions', setEmotions, id)}
        />
      </section>

      <section className="day-section">
        <h3>Market Conditions</h3>
        <EditableDropdown
          label="Market Condition"
          items={marketConditions}
          value={marketConditionId}
          onChange={handleMarketConditionChange}
          onAdd={(name) => handleAddMaster('marketConditions', setMarketConditions, name)}
          onDelete={(id) => handleDeleteMaster('marketConditions', setMarketConditions, id)}
        />
      </section>

      <section className="day-section">
        <h3>Stock Volatility</h3>
        <p className="section-hint">Index movement vs. individual stock movement</p>
        <EditableDropdown
          label="Volatility Type"
          items={volatilities}
          value={volatilityId}
          onChange={handleVolatilityChange}
          onAdd={(name) => handleAddMaster('volatility', setVolatilities, name)}
          onDelete={(id) => handleDeleteMaster('volatility', setVolatilities, id)}
        />
      </section>

      <section className="day-section">
        <h3>Notes</h3>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={(e) => handleTextBlur('notes', e.target.value)}
          placeholder="What happened today?"
        />
      </section>

      <section className="day-section">
        <h3>Areas for Improvement</h3>
        <textarea
          rows={4}
          value={improvements}
          onChange={(e) => setImprovements(e.target.value)}
          onBlur={(e) => handleTextBlur('improvements', e.target.value)}
          placeholder="What could you do better?"
        />
      </section>

      <section className="day-section">
        <h3>Screenshots</h3>
        <input type="file" accept="image/*" onChange={handleFileUpload} />
        <div className="screenshot-grid">
          {screenshots.map((s) => (
            <div key={s.id} className="screenshot-thumb">
              <img src={s.url} alt="Trade screenshot" onClick={() => setLightboxUrl(s.url)} />
              <button className="delete-x" onClick={() => handleDeleteScreenshot(s)}>
                ×
              </button>
            </div>
          ))}
        </div>
      </section>

      {lightboxUrl && (
        <div className="lightbox-overlay" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Trade screenshot full size" className="lightbox-image" />
          <button className="lightbox-close" onClick={() => setLightboxUrl(null)}>×</button>
        </div>
      )}

      <section className="day-section plan-section">
        <h3>Post-Session Review — Plan Adherence</h3>
        <p className="section-hint">Did you actually follow the plan you set above?</p>
        <div className="yes-no-toggle">
          <button
            className={planFollowed === true ? 'active-yes' : ''}
            onClick={() => handlePlanFollowed(true)}
          >
            Followed the plan
          </button>
          <button
            className={planFollowed === false ? 'active-no' : ''}
            onClick={() => handlePlanFollowed(false)}
          >
            Deviated
          </button>
        </div>

        {planFollowed === false && (
          <>
            <label className="field-label" htmlFor="plan-deviation">Where did you deviate, and why?</label>
            <textarea
              id="plan-deviation"
              rows={3}
              value={planDeviationNotes}
              onChange={(e) => setPlanDeviationNotes(e.target.value)}
              onBlur={(e) => handleTextBlur('plan_deviation_notes', e.target.value)}
              placeholder="Be specific — this is what your analytics will learn from"
            />
          </>
        )}
      </section>

      <section className="day-section ai-summary-section">
        <h3>AI Summary</h3>
        <button onClick={handleGenerateSummary} disabled={generatingSummary}>
          {generatingSummary ? 'Generating…' : aiSummary ? 'Regenerate Summary' : 'Generate Summary'}
        </button>
        {aiSummary && <p className="ai-summary-text">{aiSummary}</p>}
      </section>
    </div>
  )
}
