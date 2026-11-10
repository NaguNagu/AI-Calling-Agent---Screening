import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Avatar, Button, Field } from '../components/ui'
import { supabase } from '../lib/supabase'
import { displayName } from '../lib/format'

const PROVIDERS = [
  { value: 'plivo_sarvam', title: 'Plivo + Sarvam', text: 'Plivo places the phone calls in India; Sarvam listens and speaks in English, Tamil and Hindi.' },
  { value: 'sarvam_voice_agents', title: 'Sarvam Voice Agents', text: 'Sarvam handles both the phone calls and the voice agent.' },
]

export default function Settings({ user, notify, onSignOut }) {
  const [provider, setProvider] = useState('plivo_sarvam')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [plivoReady, setPlivoReady] = useState(false)
  const [sarvamReady, setSarvamReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(displayName(user))

  const saveName = async (event) => {
    event.preventDefault()
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    notify(error ? { tone: 'danger', text: `Name wasn’t saved: ${error.message}` } : { text: 'Name saved.' })
  }

  useEffect(() => {
    if (!user?.id) return
    supabase.from('workspace_settings').select('telephony_provider, phone_number, plivo_ready, sarvam_ready').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setProvider(data.telephony_provider || 'plivo_sarvam')
      setPhoneNumber(data.phone_number || '')
      setPlivoReady(Boolean(data.plivo_ready))
      setSarvamReady(Boolean(data.sarvam_ready))
    })
  }, [user])

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('workspace_settings').upsert({ user_id: user.id, telephony_provider: provider, phone_number: phoneNumber.trim() || null, plivo_ready: plivoReady, sarvam_ready: sarvamReady }, { onConflict: 'user_id' })
    setSaving(false)
    notify(error ? { tone: 'danger', text: `Settings weren’t saved: ${error.message}` } : { text: 'Settings saved.' })
  }

  return (
    <div className="page page-narrow">
      <div className="page-head"><div><h1>Settings</h1><p className="muted">Your account and how this workspace places calls.</p></div></div>

      <div className="card settings-section">
        <div className="settings-label"><h2>Your account</h2><p className="muted">You’re signed in with this email.</p></div>
        <div className="account-row">
          <Avatar name={displayName(user)} size="lg" />
          <div><b>{displayName(user)}</b><small className="block muted">{user?.email}</small></div>
          <Button icon="logout" onClick={onSignOut}>Sign out</Button>
        </div>
        <form className="name-row" onSubmit={saveName}>
          <Field label="Your name" hint="Used in the greeting"><input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Nagesh" /></Field>
          <Button type="submit" disabled={!name.trim() || name.trim() === displayName(user)}>Save name</Button>
        </form>
      </div>

      <form className="card settings-section" onSubmit={save}>
        <div className="settings-label"><h2>Calling provider</h2><p className="muted">Choose the service that makes your calls.</p></div>
        <div className="provider-grid">
          {PROVIDERS.map(p => (
            <label key={p.value} className={`provider ${provider === p.value ? 'selected' : ''}`}>
              <input type="radio" name="provider" checked={provider === p.value} onChange={() => setProvider(p.value)} />
              <span className="provider-check"><Icon name="check" size={13} /></span>
              <b>{p.title}</b>
              <span className="muted small">{p.text}</span>
            </label>
          ))}
        </div>

        <Field label="Calling number" hint="The number candidates see when you call">
          <input value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="+91 80 3170 7356" />
        </Field>

        <div className="checks">
          <label className="check"><input type="checkbox" checked={plivoReady} onChange={event => setPlivoReady(event.target.checked)} /> Plivo account is connected</label>
          <label className="check"><input type="checkbox" checked={sarvamReady} onChange={event => setSarvamReady(event.target.checked)} /> Sarvam account is connected</label>
        </div>

        <div className="note"><Icon name="lock" size={15} />Secret API keys are kept on the server and are never shown or stored in this browser.</div>
        <div className="form-actions"><Button variant="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</Button></div>
      </form>
    </div>
  )
}
