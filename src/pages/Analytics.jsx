import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getAnalyticsRawData, getMarketCalendarDays } from '../lib/api'
import { computeAllAnalytics } from '../lib/analytics'
import { format, subDays } from 'date-fns'
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

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [calendarDays, setCalendarDays] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const calendarStart = format(subDays(new Date(), 400), 'yyyy-MM-dd')
    const calendarEnd = format(new Date(), 'yyyy-MM-dd')

    Promise.all([
      getAnalyticsRawData(user.id),
      // If market_calendar_days hasn't been synced yet (or the sync hasn't
      // run for the first time), this may come back empty — analytics.js
      // falls back to flat calendar-day math in that case, so it's safe to
      // not block on it succeeding.
      getMarketCalendarDays(calendarStart, calendarEnd).catch(() => []),
    ])
      .then(([rowsData, calendarData]) => {
        setRows(rowsData)
        setCalendarDays(calendarData)
      })
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <p className="loading-note">Loading…</p>

  const a = computeAllAnalytics(rows, calendarDays)

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

      {/* ---------- Weekly rollup ---------- */}
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
        <p className="section-hint">
          Violation rate on the next trading day following a rule-break vs. a clean day.
          {a.dayAfterEffect.tradingDaysOnly
            ? ' Weekends and market holidays are skipped, so a Friday break is compared against the following Monday.'
            : ' Market calendar not synced yet — currently only counting literal next-calendar-day pairs.'}
        </p>
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
        <p className="section-hint">
          {a.journalingConsistency.tradingDaysOnly
            ? 'Days logged out of actual trading days in the window (weekends/holidays excluded).'
            : 'Market calendar not synced yet — currently out of flat calendar days.'}
        </p>
        <div className="stat-grid">
          <StatCard
            label={
              a.journalingConsistency.tradingDaysOnly
                ? 'Trading days logged (last 30)'
                : 'Days logged (last 30)'
            }
            value={`${a.journalingConsistency.loggedDays} / ${a.journalingConsistency.windowDays}`}
          />
        </div>
      </section>
    </div>
  )
}
