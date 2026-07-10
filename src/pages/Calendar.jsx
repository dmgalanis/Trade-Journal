import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getMonthTradingDays } from '../lib/api'
import BackupPanel from '../components/BackupPanel'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from 'date-fns'

export default function Calendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dayData, setDayData] = useState({}) // { 'yyyy-MM-dd': { followed_rules } }
  const [loading, setLoading] = useState(true)
  const [showBackupPanel, setShowBackupPanel] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    getMonthTradingDays(user.id, currentMonth.getFullYear(), currentMonth.getMonth() + 1)
      .then((rows) => {
        const map = {}
        for (const row of rows) map[row.entry_date] = row
        setDayData(map)
      })
      .finally(() => setLoading(false))
  }, [user, currentMonth])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const today = new Date()

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>‹</button>
        <h2>{format(currentMonth, 'MMMM yyyy')}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>›</button>
      </div>

      <div className="calendar-weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="weekday-label">
            {d}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const entry = dayData[key]
          const inMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, today)
          let statusClass = ''
          if (entry) {
            if (entry.followed_rules === true) statusClass = 'day-good'
            else if (entry.followed_rules === false) statusClass = 'day-bad'
            else statusClass = 'day-logged'
          }
          return (
            <button
              key={key}
              className={`calendar-day ${inMonth ? '' : 'day-outside'} ${isToday ? 'day-today' : ''} ${statusClass}`}
              onClick={() => navigate(`/day/${key}`)}
            >
              <span className="day-number">{format(day, 'd')}</span>
            </button>
          )
        })}
      </div>

      <div className="calendar-legend">
        <span><i className="dot dot-good" /> Followed rules</span>
        <span><i className="dot dot-bad" /> Violated rules</span>
        <span><i className="dot dot-logged" /> Logged</span>
      </div>

      {loading && <p className="loading-note">Loading…</p>}

      <div className="calendar-footer-actions">
        <span className="app-version">v1.3</span>
        <button
          type="button"
          className="backup-gear-btn"
          title="Backups"
          aria-label="Open backups panel"
          onClick={() => setShowBackupPanel(true)}
        >
          ⚙
        </button>
      </div>

      {showBackupPanel && <BackupPanel onClose={() => setShowBackupPanel(false)} />}
    </div>
  )
}
