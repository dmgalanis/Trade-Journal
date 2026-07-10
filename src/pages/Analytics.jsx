import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getAnalyticsRawData } from '../lib/api'
import { computeAllAnalytics } from '../lib/analytics'
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

function num1(x) {
  return x === null || x === undefined ? '—' : x.toFixed(1)
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
    <ResponsiveContainer width="100%" height={height ?? Math.max(200, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={170} />
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getAnalyticsRawData(user.id)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [user])

  if (loading) return <p className="loading-note">Loading…</p>

  const a = computeAllAnalytics(rows)

  const dowChartData = a.dayOfWeek
    .filter((d) => d.total > 0)
    .map((d) => ({ name: d.day, count: Math.round((d.violationRate ?? 0) * 100) }))

  const emotionCorrData = a.emotionCorrelation.map((e) => ({
    name: e.name,
    count: Math.round(e.violationRate * 100),
  }))

  const emotionNextDayData = a.emotionNextDayEffect.map((e) => ({
    name: e.name,
    count: Math.round(e.nextDayViolationRate * 100),
  }))

  const conditionData = (list) => list.map((c) => ({ name: c.name, count: Math.round(c.violationRate * 100) }))

  const weeklyVolatilityData = a.adherenceVolatility.weeklyRates.map((w) => ({
    name: w.week.slice(5), // MM-dd
    rate: Math.round(w.rate * 100),
  }))

  const monthlyTrendData = a.monthlyAdherenceTrend.map((m) => ({
    name: m.month,
    rate: Math.round(m.adherence * 100),
  }))

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

      {/* ---------- Adherence volatility ---------- */}
      <section className="day-section">
        <h3>Adherence Consistency</h3>
        <p className="section-hint">
          Week-to-week swing in adherence rate. A low number means steady discipline; a high
          number means good weeks and bad weeks alternate sharply, even if the average looks fine.
        </p>
        <div className="stat-grid">
          <StatCard
            label="Weekly volatility"
            value={a.adherenceVolatility.stdDev === null ? '—' : `±${Math.round(a.adherenceVolatility.stdDev * 100)}%`}
            sublabel={
              a.adherenceVolatility.mean !== null ? `avg week: ${pct(a.adherenceVolatility.mean)}` : null
            }
          />
          <StatCard label="Weeks logged" value={a.adherenceVolatility.weeklyRates.length} />
        </div>
        {weeklyVolatilityData.length >= 2 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weeklyVolatilityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#4C7A5C" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* ---------- Monthly / seasonal trend ---------- */}
      <section className="day-section">
        <h3>Adherence by Month</h3>
        <p className="section-hint">Slower-moving trends that 30/90-day windows tend to smooth over.</p>
        {monthlyTrendData.length === 0 ? (
          <p className="empty-note">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} unit="%" allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" stroke="#B8901F" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
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

      {/* ---------- Planned vs unplanned days ---------- */}
      <section className="day-section">
        <h3>Planning vs. Rule Adherence</h3>
        <p className="section-hint">
          Rule adherence on days you wrote a Pre-Session Plan vs. days you didn't — tests whether
          the act of planning itself predicts discipline.
        </p>
        <div className="stat-grid">
          <StatCard
            label="Planned days"
            value={pct(a.plannedVsUnplanned.plannedAdherence)}
            sublabel={`n=${a.plannedVsUnplanned.plannedSample}`}
          />
          <StatCard
            label="Unplanned days"
            value={pct(a.plannedVsUnplanned.unplannedAdherence)}
            sublabel={`n=${a.plannedVsUnplanned.unplannedSample}`}
          />
        </div>
      </section>

      {/* ---------- Plan-rule divergence ---------- */}
      <section className="day-section">
        <h3>Plan vs. Rules — Where They Diverge</h3>
        <p className="section-hint">
          The interesting cells are the mismatches: sticking to the plan but still breaking a rule
          points to a gap in the plan itself; deviating from the plan but staying disciplined
          suggests the plan may be too rigid.
        </p>
        <div className="stat-grid">
          <StatCard label="Fully disciplined" value={a.planRuleDivergence.bothGood} sublabel="plan + rules both followed" />
          <StatCard label="Followed plan, broke rules" value={a.planRuleDivergence.plannedButViolated} />
          <StatCard label="Deviated, stayed disciplined" value={a.planRuleDivergence.deviatedButDisciplined} />
          <StatCard label="Total breakdown" value={a.planRuleDivergence.bothBad} sublabel="plan + rules both broken" />
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

      {/* ---------- Violation severity ---------- */}
      <section className="day-section">
        <h3>Violation Severity</h3>
        <p className="section-hint">Are bad days one slip, or total collapse?</p>
        <div className="stat-grid">
          <StatCard label="Avg violations per bad day" value={num1(a.violationIntensity.avgViolationsPerBadDay)} />
          <StatCard label="Worst single day" value={a.violationIntensity.maxViolationsInADay} sublabel="rules broken" />
          <StatCard label="Longest violation streak" value={`${a.violationStreaks.longest}d`} />
          <StatCard label="Current violation streak" value={`${a.violationStreaks.current}d`} />
        </div>
      </section>

      {/* ---------- Recovery time ---------- */}
      <section className="day-section">
        <h3>Recovery Time</h3>
        <p className="section-hint">Average logged days from a violation until the next clean day.</p>
        <div className="stat-grid">
          <StatCard
            label="Avg days to recover"
            value={num1(a.recoveryTime.avgDaysToRecover)}
            sublabel={`n=${a.recoveryTime.sample}`}
          />
        </div>
      </section>

      {/* ---------- Emotions ---------- */}
      <section className="day-section">
        <h3>Most Common Emotions</h3>
        <HorizontalBarChart data={a.emotionFrequency} dataKey="count" color="#3498db" />
      </section>

      {/* ---------- Emotional load ---------- */}
      <section className="day-section">
        <h3>Emotional Load</h3>
        <p className="section-hint">
          Does the number of emotions logged in a day matter, separate from which ones they are?
        </p>
        <div className="stat-grid">
          <StatCard
            label="Avg emotions — violation days"
            value={num1(a.emotionLoadCorrelation.avgEmotionsOnViolationDays)}
            sublabel={`n=${a.emotionLoadCorrelation.violationSample}`}
          />
          <StatCard
            label="Avg emotions — clean days"
            value={num1(a.emotionLoadCorrelation.avgEmotionsOnCleanDays)}
            sublabel={`n=${a.emotionLoadCorrelation.cleanSample}`}
          />
        </div>
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

      {/* ---------- Emotion -> next-day violation effect ---------- */}
      <section className="day-section">
        <h3>Emotions and the Next Day</h3>
        <p className="section-hint">
          Violation rate on the day AFTER you felt this emotion (baseline:{' '}
          {pct(a.emotionNextDayEffect[0]?.baselineViolationRate)}). Consecutive calendar days only.
        </p>
        <HorizontalBarChart data={emotionNextDayData} dataKey="count" color="#A64B3B" />
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

      {/* ---------- Day of week emotions ---------- */}
      <section className="day-section">
        <h3>Day-of-Week Emotional Patterns</h3>
        <p className="section-hint">Most common emotion logged on each day of the week.</p>
        <div className="rule-trend-list">
          {a.dayOfWeekEmotions
            .filter((d) => d.topEmotion)
            .map((d) => (
              <div key={d.day} className="rule-trend-row">
                <span className="rule-trend-name">{d.day}</span>
                <span className="rule-trend-name" style={{ flex: 1.5, color: 'var(--ink-soft)' }}>
                  {d.topEmotion}
                </span>
                <span className="rule-trend-count">{d.topEmotionCount}×</span>
              </div>
            ))}
          {a.dayOfWeekEmotions.every((d) => !d.topEmotion) && (
            <p className="empty-note">Not enough data yet.</p>
          )}
        </div>
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
          <ResponsiveContainer width="100%" height={Math.max(200, a.emotionTrend.length * 32)}>
            <BarChart data={a.emotionTrend} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={170} />
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
