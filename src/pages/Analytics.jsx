import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { getViolationFrequency, getEmotionFrequency } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function Analytics() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [violations, setViolations] = useState([])
  const [emotions, setEmotions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    Promise.all([getViolationFrequency(user.id), getEmotionFrequency(user.id)])
      .then(([v, e]) => {
        setViolations(v)
        setEmotions(e)
      })
      .finally(() => setLoading(false))
  }, [user])

  return (
    <div className="analytics-page">
      <div className="day-detail-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Calendar
        </button>
        <h2>Analytics</h2>
        <span />
      </div>

      {loading ? (
        <p className="loading-note">Loading…</p>
      ) : (
        <>
          <section className="day-section">
            <h3>Most Frequently Violated Rules</h3>
            {violations.length === 0 ? (
              <p className="empty-note">No violations logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, violations.length * 40)}>
                <BarChart data={violations} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#e74c3c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>

          <section className="day-section">
            <h3>Most Common Emotions</h3>
            {emotions.length === 0 ? (
              <p className="empty-note">No emotions logged yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, emotions.length * 40)}>
                <BarChart data={emotions} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3498db" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>
        </>
      )}
    </div>
  )
}
