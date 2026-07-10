import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import {
  getAnalyticsRawData,
  getRollupSummary,
  saveRollupSummary,
  generateRollupSummary,
} from '../lib/api'
import { computeAllAnalytics, getPeriodStats } from '../lib/analytics'
import FormattedSummary from '../components/FormattedSummary'
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  startOfMonth,
  addMonths,
  subMonths,
  getDaysInMonth,
  format,
} from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

function pct(x) {
  return x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`
}

function StatCard({ label, value, sublabel }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sublabel && <div className="stat-sublabel">{sublabel}</div>}
    </div>
  )
}

function HorizontalBarChart({ data, dataKey, color, height }) {
  if (!data.length) return <p className="empty-note">Not enough data yet.</p>
  return (
    <ResponsiveContainer width="100%" height={height ?? Math.max(220, data.length * 48)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
        <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// Shared UI for the Weekly/Monthly rollup sections: period nav, generate button,
// and the rendered summary (or an empty state before one's been generated).
function RollupSection({
  title,
  loading,
  generating,
  summary,
  onPrev,
  onNext,
  onGenerate,
  emptyNote,
}) {
  return (
    <section className="day-section rollup-section">
      <div className="rollup-nav">
        <button onClick={onPrev} aria-label="Previous period">‹</button>
        <h3>{title}</h3>
        <button onClick={onNext} aria-label="Next period">›</button>
      </div>
      {loading ? (
        <p className="loading-note">Loading…</p>
      ) : (
        <>
          <button className="rollup-generate-btn" onClick={onGenerate} disabled={generating}>
            {generating ? 'Generating…' : summary ? 'Regenerate Summary' : 'Generate Summary'}
          </button>
          {summary ? (
            <div className="ai-summary-box">
              <FormattedSummary text={summary} />
            </div>
          ) : (
            <p className="empty-note">{emptyNote}</p>
          )}
        </>
      )}
    </section>
  )
}

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  // ---- Weekly rollup summary ----
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [weekSummary, setWeekSummary] = useState('')
  const [weekSummaryLoading, setWeekSummaryLoading] = useState(true)
  const [generatingWeekSummary, setGeneratingWeekSummary] = useState(false)

  // ---- Monthly rollup summary ----
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()))
  const [monthSummary, setMonthSummary] = useState('')
  const [monthSummaryLoading, setMonthSummaryLoading] = useState(true)
  const [generatingMonthSummary, setGeneratingMonthSummary] = useState(false)

  useEffect(() => {
    if (!user) return
    getAnalyticsRawData(user.id)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    setWeekSummaryLoading(true)
    getRollupSummary(user.id, 'week', format(weekStart, 'yyyy-MM-dd'))
      .then((row) => setWeekSummary(row?.summary || ''))
      .finally(() => setWeekSummaryLoading(false))
  }, [user, weekStart])

  useEffect(() => {
    if (!user) return
    setMonthSummaryLoading(true)
    getRollupSummary(user.id, 'month', format(monthStart, 'yyyy-MM-dd'))
      .then((row) => setMonthSummary(row?.summary || ''))
      .finally(() => setMonthSummaryLoading(false))
  }, [user, monthStart])

  const handleGenerateWeekSummary = async () => {
    setGeneratingWeekSummary(true)
    try {
      const endExclusive = addWeeks(weekStart, 1)
      const stats = getPeriodStats(rows, weekStart, endExclusive)
      const summary = await generateRollupSummary({
        period_type: 'week',
        period_label: `Week of ${format(weekStart, 'MMMM d, yyyy')}`,
        days_logged: stats.daysLogged,
        total_days_in_period: 7,
        adherence: stats.adherence,
        plan_adherence: stats.planAdherence,
        top_violations: stats.topViolations,
        top_emotions: stats.topEmotions,
        daily_summaries: stats.dailySummaries,
      })
      setWeekSummary(summary)
      await saveRollupSummary(user.id, 'week', format(weekStart, 'yyyy-MM-dd'), summary)
    } catch (err) {
      alert('Could not generate weekly summary: ' + err.message)
    } finally {
      setGeneratingWeekSummary(false)
    }
  }

  const handleGenerateMonthSummary = async () => {
    setGeneratingMonthSummary(true)
    try {
      const endExclusive = addMonths(monthStart, 1)
      const stats = getPeriodStats(rows, monthStart, endExclusive)
      const summary = await generateRollupSummary({
        period_type: 'month',
        period_label: format(monthStart, 'MMMM yyyy'),
        days_logged: stats.daysLogged,
        total_days_in_period: getDaysInMonth(monthStart),
        adherence: stats.adherence,
        plan_adherence: stats.planAdherence,
        top_violations: stats.topViolations,
        top_emotions: stats.topEmotions,
        daily_summaries: stats.dailySummaries,
      })
      setMonthSummary(summary)
      await saveRollupSummary(user.id, 'month', format(monthStart, 'yyyy-MM-dd'), summary)
    } catch (err) {
      alert('Could not generate monthly summary: ' + err.message)
    } finally {
      setGeneratingMonthSummary(false)
    }
  }

  if (loading) return <p className="loading-note">Loading…</p>

  const a = computeAllAnalytics(rows)

  const dowChartData = a.dayOfWeek
    .filter((d) => d.total > 0)
    .map((d) => ({ name: d.day, count: Math.round((d.violationRate ?? 0) * 100) }))

  const emotionCorrData = a.emotionCorrelation.map((e) => ({
    name: e.name,
    count: Math.round(e.violationRate * 100),
  }))

  const conditionData = (list) => list.map((c) => ({ name: c.name, count: Math.round(c.violationRate * 100) }))

  return (
    <div className="analytics-page">
      <div className="day-detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Calendar
        </button>
        <h2>Analytics</h2>
        <span />
      </div>

      {/* ---------- Weekly rollup summary ---------- */}
      <RollupSection
        title={`Week of ${format(weekStart, 'MMM d, yyyy')}`}
        loading={weekSummaryLoading}
        generating={generatingWeekSummary}
        summary={weekSummary}
        onPrev={() => setWeekStart(subWeeks(weekStart, 1))}
        onNext={() => setWeekStart(addWeeks(weekStart, 1))}
        onGenerate={handleGenerateWeekSummary}
        emptyNote="No summary generated yet for this week."
      />

      {/* ---------- Monthly rollup summary ---------- */}
      <RollupSection
        title={format(monthStart, 'MMMM yyyy')}
        loading={monthSummaryLoading}
        generating={generatingMonthSummary}
        summary={monthSummary}
        onPrev={() => setMonthStart(subMonths(monthStart, 1))}
        onNext={() => setMonthStart(addMonths(monthStart, 1))}
        onGenerate={handleGenerateMonthSummary}
        emptyNote="No summary generated yet for this month."
      />

      {/* ---------- Weekly rollup (numeric) ---------- */}
      <section className="day-section">
        <h3>This Week</h3>
        <div className="stat-grid">
          <StatCard
            label="Rule adherence"
            value={pct(a.weeklyRollup.adherence)}
            sublabel={
              a.weeklyRollup.prevAdherence !== null && a.weeklyRollup.adherence !== null
                ? `vs ${pct(a.weeklyRollup.prevAdherence)} last week`
                : null
            }
          />
          <StatCard label="Days logged" value={a.weeklyRollup.daysLogged} />
          <StatCard label="Top emotion" value={a.weeklyRollup.topEmotion || '—'} />
          <StatCard label="Top violation" value={a.weeklyRollup.topViolation || '—'} />
        </div>
      </section>

      {/* ---------- Rolling adherence + streaks ---------- */}
      <section className="day-section">
        <h3>Rule Adherence</h3>
        <div className="stat-grid">
          <StatCard label="Last 7 days" value={pct(a.rollingAdherence.d7)} />
          <StatCard label="Last 30 days" value={pct(a.rollingAdherence.d30)} />
          <StatCard label="Last 90 days" value={pct(a.rollingAdherence.d90)} />
          <StatCard label="Current streak" value={`${a.streaks.current}d`} />
          <StatCard label="Longest streak" value={`${a.streaks.longest}d`} />
        </div>
      </section>

      {/* ---------- Pre-Session Plan adherence ---------- */}
      <section className="day-section">
        <h3>Plan Adherence</h3>
        <p className="section-hint">How often you actually followed your Pre-Session Plan.</p>
        <div className="stat-grid">
          <StatCard label="Last 7 days" value={pct(a.planAdherence.d7)} />
          <StatCard label="Last 30 days" value={pct(a.planAdherence.d30)} />
          <StatCard label="Last 90 days" value={pct(a.planAdherence.d90)} />
        </div>
      </section>

      {/* ---------- Rule frequency ---------- */}
      <section className="day-section">
        <h3>Most Frequently Violated Rules</h3>
        <HorizontalBarChart data={a.ruleFrequency} dataKey="count" color="#A64B3B" />
      </section>

      {/* ---------- Rule trend ---------- */}
      <section className="day-section">
        <h3>Rule Trend (last 30 vs prior 30 days)</h3>
        {a.ruleTrend.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <div className="rule-trend-list">
            {a.ruleTrend.slice(0, 8).map((r) => (
              <div key={r.name} className="rule-trend-row">
                <span className="rule-trend-name">{r.name}</span>
                <span className="rule-trend-count">{r.current}</span>
                <span
                  className={
                    r.delta > 0 ? 'rule-trend-delta trend-up' : r.delta < 0 ? 'rule-trend-delta trend-down' : 'rule-trend-delta'
                  }
                >
                  {r.delta > 0 ? `+${r.delta}` : r.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Rule co-violation ---------- */}
      <section className="day-section">
        <h3>Rules That Break Together</h3>
        {a.ruleCoViolation.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <div className="rule-trend-list">
            {a.ruleCoViolation.map((p) => (
              <div key={p.pair} className="rule-trend-row">
                <span className="rule-trend-name">{p.pair}</span>
                <span className="rule-trend-count">{p.count}×</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Emotions ---------- */}
      <section className="day-section">
        <h3>Most Common Emotions</h3>
        <HorizontalBarChart data={a.emotionFrequency} dataKey="count" color="#3498db" />
      </section>

      {/* ---------- Emotion -> violation correlation ---------- */}
      <section className="day-section">
        <h3>Emotions Linked to Rule Violations</h3>
        <p className="section-hint">
          Violation rate on days you felt this emotion (baseline:{' '}
          {pct(a.emotionCorrelation[0]?.baselineViolationRate)})
        </p>
        <HorizontalBarChart data={emotionCorrData} dataKey="count" color="#B8901F" />
      </section>

      {/* ---------- Emotion x Rule heatmap ---------- */}
      <section className="day-section">
        <h3>Emotion × Rule Heatmap</h3>
        <p className="section-hint">Co-occurrence counts on days rules were violated.</p>
        {a.heatmap.emotions.length === 0 || a.heatmap.rules.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <div className="heatmap-scroll">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th></th>
                  {a.heatmap.rules.map((rule) => (
                    <th key={rule} title={rule}>
                      {rule.length > 18 ? rule.slice(0, 18) + '…' : rule}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.heatmap.emotions.map((emotion) => (
                  <tr key={emotion}>
                    <th>{emotion}</th>
                    {a.heatmap.rules.map((rule) => {
                      const count = a.heatmap.matrix[emotion]?.[rule] || 0
                      const intensity = Math.min(1, count / 5)
                      return (
                        <td
                          key={rule}
                          style={{
                            backgroundColor: count
                              ? `rgba(166, 75, 59, ${0.15 + intensity * 0.6})`
                              : 'transparent',
                          }}
                        >
                          {count || ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------- Market condition / volatility ---------- */}
      <section className="day-section">
        <h3>Violation Rate by Market Condition</h3>
        <HorizontalBarChart data={conditionData(a.marketConditionRates)} dataKey="count" color="#A64B3B" />
      </section>

      <section className="day-section">
        <h3>Violation Rate by Volatility Type</h3>
        <HorizontalBarChart data={conditionData(a.volatilityRates)} dataKey="count" color="#A64B3B" />
      </section>

      {/* ---------- Day of week ---------- */}
      <section className="day-section">
        <h3>Violation Rate by Day of Week</h3>
        {dowChartData.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} unit="%" />
              <Tooltip />
              <Bar dataKey="count" fill="#A64B3B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Day-after effect ---------- */}
      <section className="day-section">
        <h3>The "Day After" Effect</h3>
        <p className="section-hint">Violation rate the day immediately following a rule-break vs. a clean day.</p>
        <div className="stat-grid">
          <StatCard
            label="After a violation"
            value={pct(a.dayAfterEffect.afterViolationRate)}
            sublabel={`n=${a.dayAfterEffect.afterViolationSample}`}
          />
          <StatCard
            label="After a clean day"
            value={pct(a.dayAfterEffect.afterCleanRate)}
            sublabel={`n=${a.dayAfterEffect.afterCleanSample}`}
          />
        </div>
      </section>

      {/* ---------- Emotion frequency trend ---------- */}
      <section className="day-section">
        <h3>Emotion Trend (last 30 days)</h3>
        {a.emotionTrend.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(220, a.emotionTrend.length * 48)}>
            <BarChart data={a.emotionTrend} layout="vertical" margin={{ left: 20, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3498db" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Journaling consistency ---------- */}
      <section className="day-section">
        <h3>Journaling Consistency</h3>
        <div className="stat-grid">
          <StatCard
            label="Days logged (last 30)"
            value={`${a.journalingConsistency.loggedDays} / ${a.journalingConsistency.windowDays}`}
          />
        </div>
      </section>
    </div>
  )
}
