import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getAnalyticsRawData } from '../lib/api'
import {
  computeAdherenceTrend,
  computeStreaks,
  computeRuleTrend,
  computeEmotionViolationCorrelation,
  computeEmotionRuleHeatmap,
  computeConditionViolationRate,
  computeDayOfWeekBreakdown,
  computeEmotionFrequencyTrend,
  computeRollup,
  computePlanAdherence,
} from '../lib/analytics'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const LINE_COLORS = ['#4C7A5C', '#A64B3B', '#B8901F', '#3E6B8A', '#7A4C8A']

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function EmptyNote({ children }) {
  return <p className="empty-note">{children}</p>
}

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getAnalyticsRawData(user.id)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="day-detail-header">
          <button className="back-btn" onClick={() => navigate('/')}>← Calendar</button>
          <h2>Analytics</h2>
          <span />
        </div>
        <p className="loading-note">Loading…</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="analytics-page">
        <div className="day-detail-header">
          <button className="back-btn" onClick={() => navigate('/')}>← Calendar</button>
          <h2>Analytics</h2>
          <span />
        </div>
        <EmptyNote>No journal entries yet — log a few days to see analytics here.</EmptyNote>
      </div>
    )
  }

  const adherenceTrend = computeAdherenceTrend(rows)
  const streaks = computeStreaks(rows)
  const ruleTrend = computeRuleTrend(rows)
  const emotionViolation = computeEmotionViolationCorrelation(rows)
  const heatmap = computeEmotionRuleHeatmap(rows)
  const marketConditionRate = computeConditionViolationRate(rows, 'market_conditions_master')
  const volatilityRate = computeConditionViolationRate(rows, 'volatility_master')
  const dayOfWeek = computeDayOfWeekBreakdown(rows)
  const emotionFreq = computeEmotionFrequencyTrend(rows)
  const rollup = computeRollup(rows)
  const planAdherence = computePlanAdherence(rows)

  return (
    <div className="analytics-page">
      <div className="day-detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Calendar</button>
        <h2>Analytics</h2>
        <span />
      </div>

      {/* ---------- Rollup ---------- */}
      <section className="day-section">
        <h3>This Week / This Month</h3>
        <div className="stat-grid">
          <StatCard
            label="This week adherence"
            value={rollup.week.adherencePct === null ? '—' : `${rollup.week.adherencePct}%`}
            sub={`${rollup.week.loggedDays} day(s) logged`}
          />
          <StatCard
            label="This month adherence"
            value={rollup.month.adherencePct === null ? '—' : `${rollup.month.adherencePct}%`}
            sub={`${rollup.month.loggedDays} day(s) logged`}
          />
          <StatCard label="Top violation (month)" value={rollup.month.topRule || '—'} />
          <StatCard label="Top emotion (month)" value={rollup.month.topEmotion || '—'} />
        </div>
      </section>

      {/* ---------- Streaks ---------- */}
      <section className="day-section">
        <h3>Streaks</h3>
        <div className="stat-grid">
          <StatCard label="Current streak" value={`${streaks.current} day${streaks.current === 1 ? '' : 's'}`} />
          <StatCard label="Longest streak" value={`${streaks.longest} day${streaks.longest === 1 ? '' : 's'}`} />
        </div>
      </section>

      {/* ---------- Plan vs Reality ---------- */}
      <section className="day-section">
        <h3>Plan Adherence — Short / Medium / Long Term</h3>
        <p className="section-hint">How often you rated your post-session review as "followed the plan"</p>
        {planAdherence.every((p) => p.rated === 0) ? (
          <EmptyNote>No plan ratings yet — fill in the Post-Session Review on a day's page.</EmptyNote>
        ) : (
          <div className="stat-grid">
            {planAdherence.map((p) => (
              <StatCard
                key={p.label}
                label={`Last ${p.label}`}
                value={p.pct === null ? '—' : `${p.pct}%`}
                sub={`${p.rated} day(s) rated`}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- Rule adherence trend ---------- */}
      <section className="day-section">
        <h3>Rule Adherence Trend</h3>
        {adherenceTrend.length < 2 ? (
          <EmptyNote>Log a few more weeks to see a trend.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={adherenceTrend} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis domain={[0, 100]} unit="%" fontSize={12} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="pct" name="Rules followed" stroke="#4C7A5C" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Per-rule trend ---------- */}
      <section className="day-section">
        <h3>Rule Violations: Last 30 Days vs Prior 30 Days</h3>
        {ruleTrend.length === 0 ? (
          <EmptyNote>No violations logged yet.</EmptyNote>
        ) : (
          <div className="rule-trend-list">
            {ruleTrend.map((r) => (
              <div key={r.name} className="rule-trend-row">
                <span className="rule-trend-name">{r.name}</span>
                <span className="rule-trend-counts">
                  {r.priorCount} → {r.recentCount}
                </span>
                <span
                  className={
                    'rule-trend-delta ' +
                    (r.delta > 0 ? 'delta-up' : r.delta < 0 ? 'delta-down' : 'delta-flat')
                  }
                >
                  {r.delta > 0 ? `▲ +${r.delta}` : r.delta < 0 ? `▼ ${r.delta}` : '— flat'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Emotion -> violation correlation ---------- */}
      <section className="day-section">
        <h3>Emotions Linked to Rule Violations</h3>
        <p className="section-hint">Violation rate on days you felt this emotion, vs. your overall baseline</p>
        {emotionViolation.length === 0 ? (
          <EmptyNote>Not enough data yet — need at least 2 logged days per emotion.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, emotionViolation.length * 42)}>
            <BarChart data={emotionViolation} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} />
              <YAxis type="category" dataKey="name" width={110} fontSize={12} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Legend />
              <Bar dataKey="violationRate" name="Violation rate" fill="#A64B3B" radius={[0, 4, 4, 0]} />
              <Bar dataKey="baseline" name="Your baseline" fill="#C9CDBB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Emotion x Rule heatmap ---------- */}
      <section className="day-section">
        <h3>Emotion × Rule Heatmap</h3>
        <p className="section-hint">How often each emotion co-occurred with each rule violation</p>
        {heatmap.emotions.length === 0 || heatmap.rules.length === 0 ? (
          <EmptyNote>No violation + emotion data yet.</EmptyNote>
        ) : (
          <div className="heatmap-wrap">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th></th>
                  {heatmap.rules.map((rule) => (
                    <th key={rule}>{rule}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.emotions.map((emotion) => (
                  <tr key={emotion}>
                    <th>{emotion}</th>
                    {heatmap.rules.map((rule) => {
                      const count = heatmap.matrix.get(emotion)?.get(rule) || 0
                      const intensity = heatmap.max ? count / heatmap.max : 0
                      return (
                        <td
                          key={rule}
                          style={{
                            backgroundColor: count
                              ? `rgba(166, 75, 59, ${0.15 + intensity * 0.65})`
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
        {marketConditionRate.length === 0 ? (
          <EmptyNote>No market condition data logged yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, marketConditionRate.length * 40)}>
            <BarChart data={marketConditionRate} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} />
              <YAxis type="category" dataKey="name" width={130} fontSize={12} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="violationRate" fill="#B8901F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="day-section">
        <h3>Violation Rate by Volatility Type</h3>
        {volatilityRate.length === 0 ? (
          <EmptyNote>No volatility data logged yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, volatilityRate.length * 40)}>
            <BarChart data={volatilityRate} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} unit="%" fontSize={12} />
              <YAxis type="category" dataKey="name" width={130} fontSize={12} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="violationRate" fill="#3E6B8A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Day of week ---------- */}
      <section className="day-section">
        <h3>Violation Rate by Day of Week</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dayOfWeek} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis domain={[0, 100]} unit="%" fontSize={12} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="violationRate" fill="#A64B3B" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ---------- Emotion frequency trend ---------- */}
      <section className="day-section">
        <h3>Emotion Frequency Over Time</h3>
        {emotionFreq.topEmotions.length === 0 || emotionFreq.data.length < 2 ? (
          <EmptyNote>Log a few more weeks to see emotion trends.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={emotionFreq.data} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Legend />
              {emotionFreq.topEmotions.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}
