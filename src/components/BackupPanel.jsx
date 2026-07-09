import { useEffect, useState, useCallback, useRef } from 'react'
import { listBackups, triggerBackup, triggerRestore } from '../lib/api'
import { format, parseISO } from 'date-fns'

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BackupPanel() {
  const [open, setOpen] = useState(false)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusMsg, setStatusMsg] = useState(null)
  const [backingUp, setBackingUp] = useState(false)

  const [confirmTag, setConfirmTag] = useState(null) // tag pending confirmation
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)

  const pollRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listBackups()
      setBackups(data)
    } catch (err) {
      setError('Could not load backups: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Light auto-refresh for ~2 minutes after triggering an action, so a new
  // backup shows up without the user having to manually refresh.
  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    let ticks = 0
    pollRef.current = setInterval(() => {
      ticks += 1
      load()
      if (ticks >= 8) clearInterval(pollRef.current) // ~2 min at 15s
    }, 15000)
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleBackupNow = async () => {
    setBackingUp(true)
    setStatusMsg(null)
    setError(null)
    try {
      await triggerBackup()
      setStatusMsg('Backup started — this usually takes a minute or two. The list below will refresh automatically.')
      startPolling()
    } catch (err) {
      setError('Could not start backup: ' + err.message)
    } finally {
      setBackingUp(false)
    }
  }

  const handleRestoreClick = (tag) => {
    setConfirmTag(tag)
    setConfirmText('')
    setStatusMsg(null)
    setError(null)
  }

  const handleConfirmRestore = async () => {
    if (confirmText !== 'RESTORE') return
    setRestoring(true)
    setError(null)
    try {
      await triggerRestore(confirmTag)
      setStatusMsg(`Restore started for ${confirmTag} — this usually takes a minute or two. Reload the app once it finishes.`)
      setConfirmTag(null)
      setConfirmText('')
      startPolling()
    } catch (err) {
      setError('Could not start restore: ' + err.message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      <button
        className="backup-gear-btn"
        onClick={() => setOpen(true)}
        aria-label="Backups"
        title="Backups"
      >
        ⚙
      </button>

      {open && (
        <div className="backup-overlay" onClick={() => setOpen(false)}>
          <div className="backup-panel" onClick={(e) => e.stopPropagation()}>
            <div className="backup-panel-header">
              <h3>Backups</h3>
              <button className="backup-close" onClick={() => setOpen(false)}>×</button>
            </div>

            <button className="backup-now-btn" onClick={handleBackupNow} disabled={backingUp}>
              {backingUp ? 'Starting…' : 'Back Up Now'}
            </button>

            {statusMsg && <p className="backup-status-msg">{statusMsg}</p>}
            {error && <p className="backup-error-msg">{error}</p>}

            <div className="backup-list-header">
              <span>Available backups</span>
              <button className="backup-refresh-btn" onClick={load} disabled={loading}>
                {loading ? '…' : '↻'}
              </button>
            </div>

            {loading && backups.length === 0 ? (
              <p className="loading-note">Loading…</p>
            ) : backups.length === 0 ? (
              <p className="empty-note">No backups yet — click "Back Up Now" to create one.</p>
            ) : (
              <ul className="backup-list">
                {backups.map((b) => (
                  <li key={b.tag} className="backup-list-item">
                    <div className="backup-item-info">
                      <span className="backup-item-date">
                        {(() => {
                          try {
                            return format(parseISO(b.created_at), 'MMM d, yyyy · h:mm a')
                          } catch {
                            return b.tag
                          }
                        })()}
                      </span>
                      <span className="backup-item-meta">
                        {formatSize(b.size)}
                      </span>
                    </div>
                    {confirmTag === b.tag ? (
                      <div className="backup-confirm-block">
                        <p className="backup-confirm-hint">
                          Type <strong>RESTORE</strong> to overwrite current data with this backup.
                        </p>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder="RESTORE"
                        />
                        <div className="backup-confirm-actions">
                          <button
                            className="backup-confirm-yes"
                            disabled={confirmText !== 'RESTORE' || restoring}
                            onClick={handleConfirmRestore}
                          >
                            {restoring ? 'Restoring…' : 'Confirm Restore'}
                          </button>
                          <button
                            className="backup-confirm-cancel"
                            onClick={() => setConfirmTag(null)}
                            disabled={restoring}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="backup-restore-btn"
                        onClick={() => handleRestoreClick(b.tag)}
                      >
                        Restore
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  )
}
