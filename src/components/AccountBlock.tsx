import { useState } from 'react'
import { accessToken, clearDevice, engineUrl, signOutAndClear } from '../lib/auth'
import { exportAccount } from '../lib/sync'
import { supabase } from '../lib/supabase'

/** Who is signed in, and the three things a person is owed: their data, a way out, and erasure. */
export default function AccountBlock({ userId, email }: { userId: string; email?: string }) {
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [typed, setTyped] = useState('')
  const [message, setMessage] = useState('')

  async function download() {
    setBusy('export'); setMessage('')
    try {
      const data = await exportAccount(userId, email)
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url; a.download = `diabite-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setMessage('Your data was downloaded.')
    } catch { setMessage("Couldn't export your data. Try again in a moment.") }
    finally { setBusy(null) }
  }

  async function signOut() {
    if (!window.confirm('Signing out removes your profile and diary from this device. They stay in your account.')) return
    await signOutAndClear()
  }

  async function deleteAccount() {
    setBusy('delete'); setMessage('')
    try {
      const token = await accessToken()
      const r = await fetch(engineUrl('/account'), { method: 'DELETE', headers: token ? { authorization: `Bearer ${token}` } : {} })
      if (!r.ok) throw new Error(String(r.status))
      clearDevice()
      await supabase?.auth.signOut()
    } catch { setMessage("Couldn't delete your account. Nothing was changed. Try again in a moment."); setBusy(null) }
  }

  return (
    <section className="card">
      <h2>Your account</h2>
      <p className="muted">Signed in as <b>{email ?? 'your account'}</b>.</p>
      <div className="row">
        <button className="ghost" onClick={download} disabled={busy !== null}>{busy === 'export' ? 'Preparing…' : 'Export my data'}</button>
        <button className="ghost" onClick={signOut} disabled={busy !== null}>Sign out</button>
        <button className="link" onClick={() => { setDeleting((d) => !d); setTyped('') }}>Delete my account</button>
      </div>
      {deleting && (
        <div className="account-delete">
          <p>This deletes your account, your profile and your whole diary. It can't be undone. Type <b>delete</b> to confirm.</p>
          <label className="field">
            <span className="sr-only">Type delete to confirm</span>
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} />
          </label>
          <button className="danger" onClick={deleteAccount} disabled={typed.trim().toLowerCase() !== 'delete' || busy !== null}>
            {busy === 'delete' ? 'Deleting…' : 'Delete everything'}
          </button>
        </div>
      )}
      <p className="muted" role="status" aria-live="polite">{message}</p>
    </section>
  )
}
