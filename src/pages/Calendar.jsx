import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getMonthTradingDays, getMarketCalendarDays } from '../lib/api'
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
  const [dayData, setDayData] = useState({}) // { 'yyyy-MM-dd': { followed_rules, on_vacation } }
  const [calendarMap, setCalendarMap] = useState({}) // { 'yyyy-MM-dd': is_open }
  const [loading, setLoading] = useState(true)
  const [showBackupPanel, setShowBackupPanel] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth() + 1
    const monthStartStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
    const monthEndStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

    Promise.all([
      getMonthTradingDays(user.id, year, month),
      // If market_calendar_days hasn't been synced yet, this may come back
      // empty — holidays just won't auto-mark until it has, which is a safe
      // fallback (manual vacation marking still works either way).
      getMarketCalendarDays(monthStartStr, monthEndStr).catch(() => []),
    ])
      .then(([rows, calendarRows]) => {
        const map = {}
        for (const row of rows) map[row.entry_date] = row
        setDayData(map)

        const calMap = {}
        for (const c of calendarRows) calMap[c.date] = c.is_open
        setCalendarMap(calMap)
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

          const dow = day.getDay()
          const isWeekendDay = dow === 0 || dow === 6
          const isMarketHoliday = calendarMap[key] === false && !isWeekendDay

          let statusClass = ''
          if (entry?.on_vacation || isMarketHoliday) {
            statusClass = 'day-vacation'
          } else if (entry) {
            if (entry.followed_rules === true) statusClass = 'day-good'
            else if (entry.followed_rules === false) statusClass = 'day-bad'
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

      <div className="calendar-legend-row">
        <div className="calendar-legend">
          <span><i className="dot dot-good" /> Followed rules</span>
          <span><i className="dot dot-bad" /> Violated rules</span>
          <span><span className="legend-emoji">🌴</span> Vacation / Holiday</span>
        </div>
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

      {loading && <p className="loading-note">Loading…</p>}

      {showBackupPanel && <BackupPanel onClose={() => setShowBackupPanel(false)} />}
    </div>
  )
}
