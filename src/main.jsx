import { StrictMode, useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import Icon from './components/Icon'
import { Avatar, Button, Field, Modal, Toast, useConfirm } from './components/ui'
import CampaignForm from './components/CampaignForm'
import CampaignReport from './components/CampaignReport'
import ContactDrawer from './components/ContactDrawer'
import Overview from './pages/Overview'
import Campaigns from './pages/Campaigns'
import Contacts from './pages/Contacts'
import Usage from './pages/Usage'
import Settings from './pages/Settings'
import Login from './pages/Login'
import { CALLABLE, displayName, needsReview } from './lib/format'

const NAV = [
  ['Overview', 'dashboard'],
  ['Campaigns', 'megaphone'],
  ['Contacts', 'users'],
  ['Usage', 'chart'],
]

const emptyData = { campaigns: [], candidates: [], usage: [] }

function useWorkspaceData(session) {
  const [data, setData] = useState(emptyData)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    if (!session) return
    const [campaigns, candidates, usage] = await Promise.all([
      supabase.from('campaigns').select('id, name, status, primary_language, job_location, company_name, caller_name, created_at').order('created_at', { ascending: false }),
      supabase.from('candidates').select('id, campaign_id, full_name, mobile_number, status, preferred_language, recruiter_decision, created_at, campaigns(name, primary_language), calls(id, status, language, duration_seconds, created_at)').order('created_at', { ascending: false }),
      supabase.from('usage_events').select('id, campaign_id, call_id, provider, minutes, estimated_cost, created_at').order('created_at', { ascending: false }),
    ])
    const failed = [campaigns, candidates, usage].find(result => result.error)
    if (failed) { setError(failed.error.message); setStatus('error'); return }
    setData({ campaigns: campaigns.data || [], candidates: candidates.data || [], usage: usage.data || [] })
    setStatus('ready')
  }, [session])

  useEffect(() => { reload() }, [reload])

  // While a call is live, refresh every 10 seconds so statuses update on their own.
  const anyCalling = data.candidates.some(c => c.status === 'calling')
  useEffect(() => {
    if (!anyCalling) return
    const timer = setInterval(reload, 10000)
    return () => clearInterval(timer)
  }, [anyCalling, reload])

  return { data, status, error, reload }
}

function AddContactModal({ campaigns, onClose, onSaved, notify }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('candidates').insert({ full_name: name.trim(), mobile_number: phone.trim(), campaign_id: campaignId || null })
    setSaving(false)
    if (error) { notify({ tone: 'danger', text: `Contact wasn’t saved: ${error.message}` }); return }
    onSaved({ text: `${name.trim()} was added.` })
  }
  return (
    <Modal title="Add a contact" kicker="New contact" description="Add one person to call. You can put them in a campaign or call them on their own." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="contact-form" disabled={saving || !name.trim() || !phone.trim()}>{saving ? 'Saving…' : 'Add contact'}</Button></>}>
      <form id="contact-form" className="form" onSubmit={save}>
        <Field label="Full name"><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Candidate name" required /></Field>
        <Field label="Mobile number" hint="Indian mobile number"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="98765 43210" required /></Field>
        <Field label="Campaign" hint="Optional">
          <select value={campaignId} onChange={e => setCampaignId(e.target.value)}>
            <option value="">No campaign (individual call)</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function Workspace({ session }) {
  const user = session.user
  const { data, status, error, reload } = useWorkspaceData(session)
  const [page, setPage] = useState('Overview')
  const [pageOptions, setPageOptions] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [formCampaign, setFormCampaign] = useState(null)
  const [reportCampaign, setReportCampaign] = useState(null)
  const [drawerContact, setDrawerContact] = useState(null)
  const [addingContact, setAddingContact] = useState(false)
  const [confirmDialog, confirm] = useConfirm()
  const notify = useCallback((next) => setToast(next), [])
  const closeToast = useCallback(() => setToast(null), [])
  const closeForm = useCallback(() => setFormCampaign(null), [])

  const go = (next, options = {}) => { setPage(next); setPageOptions(options); setMenuOpen(false); window.scrollTo(0, 0) }
  const reviewCount = data.candidates.filter(needsReview).length

  const actions = {
    editCampaign: (campaign) => setFormCampaign(campaign || {}),
    openReport: (campaign) => setReportCampaign(campaign),
    openContact: (contact) => setDrawerContact(contact),
    addContact: () => setAddingContact(true),

    callContact: async (contact) => {
      const ok = await confirm({ title: `Call ${contact.full_name}?`, message: `Kural AI will phone ${contact.mobile_number} now and run the screening questions. This is a real call.`, confirmLabel: 'Call now', icon: 'phone' })
      if (ok !== 'confirm') return
      notify({ text: `Calling ${contact.full_name}…` })
      const { error: callError } = await supabase.functions.invoke('start-call', { body: { to_number: contact.mobile_number, candidate_id: contact.id } })
      notify(callError ? { tone: 'danger', text: `The call didn’t start: ${callError.message}` } : { text: `Call started to ${contact.full_name}. Status updates automatically.` })
      if (!callError) await supabase.from('candidates').update({ status: 'calling' }).eq('id', contact.id)
      reload()
    },

    startCampaign: async (campaign) => {
      const contacts = data.candidates.filter(c => c.campaign_id === campaign.id)
      const ready = contacts.filter(c => CALLABLE.includes(c.status)).length
      const ok = await confirm({ title: `Start calling for “${campaign.name}”?`, message: `Kural AI will call ${ready} contact${ready === 1 ? '' : 's'} who haven’t been screened yet. People who are already screened are skipped.`, confirmLabel: `Call ${ready} contact${ready === 1 ? '' : 's'}`, icon: 'play' })
      if (ok !== 'confirm') return
      // A campaign can be left marked "in progress" when nobody is actually being called. Clear that first.
      if (campaign.status === 'in_progress' && !contacts.some(c => c.status === 'calling')) {
        await supabase.from('campaigns').update({ status: 'created' }).eq('id', campaign.id)
      }
      notify({ text: `Starting “${campaign.name}”…` })
      const { data: result, error: startError } = await supabase.functions.invoke('start-campaign', { body: { campaign_id: campaign.id } })
      notify(startError ? { tone: 'danger', text: `The campaign didn’t start: ${startError.message}` } : { tone: result?.ok === false && !result?.skipped ? 'danger' : 'success', text: result?.message || 'Campaign started.' })
      reload()
    },

    duplicateCampaign: async (campaign) => {
      const choice = await confirm({ title: `Duplicate “${campaign.name}”?`, message: 'The copy gets the same job details and questions. Do you also want to copy its contacts? Copied contacts start as “Not contacted”.', confirmLabel: 'Copy with contacts', secondaryLabel: 'Settings only', icon: 'copy' })
      if (!choice) return
      const { data: source, error: e1 } = await supabase.from('campaigns').select('name, primary_language, jd_text, job_location, company_name, company_disclosure, caller_name').eq('id', campaign.id).single()
      if (e1) { notify({ tone: 'danger', text: `Couldn’t duplicate: ${e1.message}` }); return }
      const { data: copy, error: e2 } = await supabase.from('campaigns').insert({ ...source, name: `${source.name} (copy)`, status: 'created' }).select('id, name').single()
      if (e2) { notify({ tone: 'danger', text: `Couldn’t duplicate: ${e2.message}` }); return }
      const { data: questions } = await supabase.from('screening_questions').select('question_text, required, sort_order, is_active').eq('campaign_id', campaign.id)
      if (questions?.length) await supabase.from('screening_questions').insert(questions.map(q => ({ ...q, campaign_id: copy.id })))
      if (choice === 'confirm') {
        const { data: people } = await supabase.from('candidates').select('full_name, mobile_number').eq('campaign_id', campaign.id)
        if (people?.length) await supabase.from('candidates').insert(people.map(p => ({ ...p, campaign_id: copy.id, status: 'not_contacted' })))
      }
      notify({ text: `“${copy.name}” was created.` })
      reload()
    },
  }

  const signOut = () => supabase.auth.signOut()

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark">K</span><span><b>Kural AI</b><small>AI screening studio</small></span></div>
          <button className="icon-btn sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="x" size={16} /></button>
        </div>
        <Button variant="primary" icon="plus" className="full sidebar-cta" onClick={() => { setMenuOpen(false); actions.editCampaign() }}>New campaign</Button>
        <nav className="nav" aria-label="Main">
          {NAV.map(([name, icon]) => (
            <button key={name} className={`nav-item ${page === name ? 'active' : ''}`} onClick={() => go(name)} aria-current={page === name ? 'page' : undefined}>
              <Icon name={icon} size={18} />{name}
              {name === 'Contacts' && reviewCount > 0 && <span className="nav-count" title="Waiting for your review">{reviewCount}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => go('Settings')}><Icon name="settings" size={18} />Settings</button>
          <div className="user">
            <Avatar name={displayName(user)} size="sm" />
            <div className="user-text"><b>{displayName(user)}</b><small>{user.email}</small></div>
            <button className="icon-btn" onClick={signOut} aria-label="Sign out" title="Sign out"><Icon name="logout" size={16} /></button>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="scrim" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <header className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Icon name="menu" size={18} /></button>
          <div className="brand brand-sm"><span className="brand-mark">K</span><b>Kural AI</b></div>
          <Avatar name={displayName(user)} size="sm" />
        </header>

        {status === 'error' ? (
          <div className="page"><div className="card error-card"><Icon name="alert" size={22} /><div><b>We couldn’t load your workspace</b><p className="muted">{error}</p></div><Button icon="refresh" onClick={reload}>Try again</Button></div></div>
        ) : status === 'loading' ? (
          <div className="page"><div className="skeleton-head" /><div className="stats">{[1, 2, 3, 4].map(i => <div key={i} className="stat skeleton" />)}</div><div className="card skeleton skeleton-block" /></div>
        ) : page === 'Overview' ? <Overview user={user} data={data} go={go} actions={actions} />
          : page === 'Campaigns' ? <Campaigns data={data} actions={actions} />
          : page === 'Contacts' ? <Contacts data={data} actions={actions} initialFilter={pageOptions.filter} />
          : page === 'Usage' ? <Usage data={data} />
          : <Settings user={user} notify={notify} onSignOut={signOut} />}
      </main>

      {formCampaign && <CampaignForm campaign={formCampaign} notify={notify} onClose={closeForm} onSaved={(message) => { setFormCampaign(null); notify(message); reload() }} />}
      {reportCampaign && <CampaignReport campaign={reportCampaign} data={data} actions={actions} onClose={() => setReportCampaign(null)} />}
      {drawerContact && <ContactDrawer key={drawerContact.id} contact={drawerContact} notify={notify} onClose={() => setDrawerContact(null)} onCall={actions.callContact} onChanged={reload} />}
      {addingContact && <AddContactModal campaigns={data.campaigns} notify={notify} onClose={() => setAddingContact(false)} onSaved={(message) => { setAddingContact(false); notify(message); reload() }} />}
      {confirmDialog}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <div className="center-screen"><div className="card error-card"><Icon name="alert" size={22} /><div><b>Supabase isn’t set up</b><p className="muted">Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the .env.local file, then restart the app.</p></div></div></div>
  }
  if (loading) return <div className="center-screen"><div className="spinner" /><p className="muted">Opening your workspace…</p></div>
  if (!session) return <Login />
  return <Workspace session={session} />
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
