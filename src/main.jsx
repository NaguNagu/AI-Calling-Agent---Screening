import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { isSupabaseConfigured, supabase } from './lib/supabase'

const campaigns = [
  { name: 'Senior Sales Executive', location: 'Chennai · F2F', candidates: 84, completed: 56, review: 12, status: 'Active', minutes: '248m', tone: 'blue' },
  { name: 'Customer Support Associate', location: 'Bengaluru · Virtual', candidates: 42, completed: 42, review: 7, status: 'Completed', minutes: '171m', tone: 'violet' },
  { name: 'Warehouse Supervisor', location: 'Coimbatore · F2F', candidates: 27, completed: 11, review: 3, status: 'Active', minutes: '49m', tone: 'amber' },
]

const candidates = [
  { initials: 'AK', name: 'Arun Kumar', role: 'Senior Sales Executive', lang: 'Tamil', status: 'Needs review', date: 'Today, 10:42 AM', duration: '06:18', score: 82, color: 'teal' },
  { initials: 'PS', name: 'Priya Sharma', role: 'Customer Support Associate', lang: 'Hindi', status: 'Shortlisted', date: 'Today, 09:28 AM', duration: '05:44', score: 91, color: 'purple' },
  { initials: 'RM', name: 'Rahul Menon', role: 'Senior Sales Executive', lang: 'English', status: 'Completed', date: 'Yesterday, 04:15 PM', duration: '04:09', score: 76, color: 'orange' },
  { initials: 'SN', name: 'Sneha Nair', role: 'Warehouse Supervisor', lang: 'English', status: 'No answer', date: 'Yesterday, 03:02 PM', duration: '—', score: null, color: 'pink' },
]

function Icon({ children }) { return <span className="icon" aria-hidden="true">{children}</span> }

function App() {
  const [active, setActive] = useState('Overview')
  const [showCampaign, setShowCampaign] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [jdText, setJdText] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyDisclosure, setCompanyDisclosure] = useState('if_asked')
  const [questionText, setQuestionText] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [candidatePhone, setCandidatePhone] = useState('')
  const [candidateCsv, setCandidateCsv] = useState([])
  const [notice, setNotice] = useState('')
  const [connectionState, setConnectionState] = useState(isSupabaseConfigured ? 'checking' : 'missing')
  const [campaignList, setCampaignList] = useState(campaigns)
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(supabase))
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const signIn = async (event) => {
    event.preventDefault()
    setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })
    if (error) setLoginError(error.message)
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    supabase.from('campaigns').select('id, name, status, created_at').order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setConnectionState('error')
          return
        }
        setConnectionState('connected')
        if (data?.length) setCampaignList(data.map(item => ({ name: item.name, location: 'New campaign', candidates: 0, completed: 0, review: 0, status: item.status === 'active' ? 'Active' : 'Draft', minutes: '0m', tone: 'blue' })))
      })
  }, [session])

  const createCampaign = async (event) => {
    event.preventDefault()
    if (!campaignName.trim()) return
    if (supabase) {
      const { data, error } = await supabase.from('campaigns').insert({ name: campaignName.trim(), jd_text: jdText.trim(), company_name: companyName.trim() || null, company_disclosure: companyDisclosure, status: 'draft' }).select('id, name, status').single()
      if (error) {
        setNotice(`Could not save campaign: ${error.message}`)
        return
      }
      const manualCandidate = candidateName.trim() && candidatePhone.trim() ? [{ campaign_id: data.id, full_name: candidateName.trim(), mobile_number: candidatePhone.trim() }] : []
      const importedCandidates = [...manualCandidate, ...candidateCsv.map(candidate => ({ ...candidate, campaign_id: data.id }))]
      if (importedCandidates.length) await supabase.from('candidates').insert(importedCandidates)
      const questions = questionText.split('\n').map((question, index) => question.trim() ? ({ campaign_id: data.id, question_text: question.trim(), sort_order: index, required: false }) : null).filter(Boolean)
      if (questions.length) await supabase.from('screening_questions').insert(questions)
      setCampaignList(current => [{ name: data.name, location: 'New campaign', candidates: 0, completed: 0, review: 0, status: 'Draft', minutes: '0m', tone: 'blue' }, ...current])
    }
    setShowCampaign(false)
    setNotice(`Campaign “${campaignName}” is ready for candidates.`)
    setCampaignName('')
    setJdText('')
    setCompanyName('')
    setQuestionText('')
    setCandidateName('')
    setCandidatePhone('')
    setCandidateCsv([])
    setTimeout(() => setNotice(''), 3500)
  }

  const readCandidateCsv = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
      if (lines.length < 2) return
      const headers = lines[0].split(',').map(header => header.trim().toLowerCase().replaceAll(' ', '_'))
      const nameIndex = headers.indexOf('full_name') >= 0 ? headers.indexOf('full_name') : headers.indexOf('name')
      const phoneIndex = headers.indexOf('mobile_number') >= 0 ? headers.indexOf('mobile_number') : headers.indexOf('mobile')
      if (nameIndex < 0 || phoneIndex < 0) return
      setCandidateCsv(lines.slice(1).map(line => line.split(',')).map(values => ({ full_name: values[nameIndex]?.trim(), mobile_number: values[phoneIndex]?.trim() })).filter(candidate => candidate.full_name && candidate.mobile_number))
    }
    reader.readAsText(file)
  }

  if (supabase && authLoading) return <div className="auth-loading">Opening your secure workspace…</div>
  if (supabase && !session) return <LoginScreen email={loginEmail} setEmail={setLoginEmail} password={loginPassword} setPassword={setLoginPassword} error={loginError} onSubmit={signIn} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">V</div><div><div className="brand-name">vaani</div><div className="brand-sub">AI screening studio</div></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch"><span className="workspace-dot">A</span><span className="workspace-copy"><b>Arcline Recruitment</b><small>Internal workspace</small></span><span className="chevron">⌄</span></button>
        <nav className="nav-list" aria-label="Main navigation">
          {[["Overview", '◈'], ["Campaigns", '▣'], ["Candidates", '♙'], ["Usage", '◒']].map(([item, icon]) => <button key={item} className={`nav-item ${active === item ? 'selected' : ''}`} onClick={() => setActive(item)}><Icon>{icon}</Icon>{item}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item"><Icon>⚙</Icon>Settings</button><div className="help-card"><div className="help-icon">?</div><div><b>Need a hand?</b><small>Read the quick guide</small></div><span>↗</span></div><div className="user-row"><div className="avatar avatar-small">NS</div><div><b>Nagesh S.</b><small>Admin</small></div><span className="more">•••</span></div></div>
      </aside>

      <main className="main-content">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {active}</div><div className="top-actions"><span className={`connection-badge ${connectionState}`}><i />{connectionState === 'connected' ? 'Supabase connected' : connectionState === 'checking' ? 'Connecting…' : 'Demo mode'}</span><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><div className="avatar">NS</div></div></header>
        <div className="content-wrap">
          {notice && <div className="toast"><span>✓</span>{notice}</div>}
          <div className="page-heading"><div><p className="eyebrow">SUNDAY, AUGUST 30, 2026</p><h1>Good afternoon, Nagesh <span className="wave">✦</span></h1><p className="muted">Here’s what’s happening with your candidate screening today.</p></div><button className="primary-button" onClick={() => setShowCampaign(true)}><span>＋</span> New campaign</button></div>

          {active === 'Overview' ? <>
          <section className="metric-grid" aria-label="Screening overview">
            <Metric label="Active campaigns" value="2" detail="+1 this month" icon="▣" accent="blue" />
            <Metric label="Candidates screened" value="109" detail="↗ 18.4% vs last month" icon="♙" accent="purple" />
            <Metric label="Minutes used" value="468" detail="of 1,000 included" icon="◷" accent="orange" progress={47} />
            <Metric label="Need your review" value="22" detail="Across all campaigns" icon="⌁" accent="red" />
          </section>

          <div className="section-heading"><div><h2>Campaigns</h2><p className="muted">Monitor your active screening campaigns.</p></div><button className="text-button" onClick={() => setActive('Campaigns')}>View all <span>→</span></button></div>
          <section className="campaign-grid">{campaignList.map(campaign => <CampaignCard key={campaign.name} campaign={campaign} />)}<button className="new-card" onClick={() => setShowCampaign(true)}><div className="new-card-icon">＋</div><b>Create a campaign</b><span>Upload a JD and start screening</span></button></section>

          <section className="lower-grid"><div className="panel"><div className="panel-heading"><div><h2>Recent candidate activity</h2><p className="muted">The latest screening results from your team.</p></div><button className="filter-button">All campaigns　⌄</button></div><div className="table-wrap"><table><thead><tr><th>CANDIDATE</th><th>CAMPAIGN</th><th>LANGUAGE</th><th>STATUS</th><th>SCREENED</th><th>SCORE</th></tr></thead><tbody>{candidates.map(candidate => <tr key={candidate.name}><td><div className="candidate-cell"><div className={`avatar ${candidate.color}`}>{candidate.initials}</div><div><b>{candidate.name}</b><small>{candidate.role}</small></div></div></td><td className="role-cell">{candidate.role}</td><td><span className="language"><span className="language-dot" />{candidate.lang}</span></td><td><Status label={candidate.status} /></td><td className="date-cell">{candidate.date}<small>{candidate.duration}</small></td><td>{candidate.score ? <div className="score"><b>{candidate.score}</b><span>/100</span></div> : <span className="dash">—</span>}</td></tr>)}</tbody></table></div></div><div className="panel usage-panel"><div className="panel-heading"><div><h2>Usage this month</h2><p className="muted">Your current plan allowance.</p></div><button className="more-button">•••</button></div><div className="usage-total"><strong>468</strong><span>minutes used</span></div><div className="usage-progress"><div style={{ width: '47%' }} /></div><div className="usage-labels"><span>0 min</span><span>1,000 min</span></div><div className="usage-breakdown"><div><span className="legend-dot teal-dot" /><span>Completed calls</span><b>382 min</b></div><div><span className="legend-dot light-dot" /><span>Other / failed</span><b>86 min</b></div></div><button className="outline-button" onClick={() => setActive('Usage')}>Open usage report <span>→</span></button></div></section>
          </> : <DataPage active={active} campaignList={campaignList} onNewCampaign={() => setShowCampaign(true)} />}
        </div>
      </main>

      {showCampaign && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowCampaign(false)}><div className="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setShowCampaign(false)}>×</button><div className="modal-kicker">CAMPAIGN SETUP</div><h2 id="modal-title">Create a campaign</h2><p className="muted">Set up the job, questions, and candidates before making calls.</p><form onSubmit={createCampaign}><div className="form-grid"><label>Campaign name <span>Required · becomes the job name</span><input autoFocus value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Senior Sales Executive" /></label><label>Company name<input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your company or consultancy" /></label></div><label>Job description / requirement<textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the requirement here." rows="3" /></label><label>Company name disclosure<select value={companyDisclosure} onChange={e => setCompanyDisclosure(e.target.value)}><option value="if_asked">Reveal only if candidate asks</option><option value="always">Always reveal</option><option value="never">Do not reveal</option></select></label><label>Screening questions <span>One question per line</span><textarea value={questionText} onChange={e => setQuestionText(e.target.value)} placeholder="What is your relevant experience?\nWhy are you considering a job change?" rows="3" /></label><div className="candidate-entry"><div><b>Add candidates</b><small>Use a CSV or add one candidate manually.</small></div><div className="form-grid"><label>Full name<input value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Candidate name" /></label><label>Mobile number<input value={candidatePhone} onChange={e => setCandidatePhone(e.target.value)} placeholder="+91 98765 43210" /></label></div><label className="file-label">Upload CSV<input type="file" accept=".csv,text/csv" onChange={readCandidateCsv} /><small>{candidateCsv.length ? `${candidateCsv.length} candidate(s) ready to import` : 'Required columns: full_name, mobile_number'}</small></label></div><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowCampaign(false)}>Cancel</button><button className="primary-button" type="submit">Save campaign <span>→</span></button></div></form></div></div>}
    </div>
  )
}

function Metric({ label, value, detail, icon, accent, progress }) { return <div className="metric-card"><div className={`metric-icon ${accent}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={accent === 'red' ? 'red-text' : ''}>{detail}</small></div>{progress && <div className="mini-progress"><div style={{ width: `${progress}%` }} /></div>}</div> }
function CampaignCard({ campaign }) { const pct = Math.round(campaign.completed / campaign.candidates * 100); return <div className="campaign-card"><div className="campaign-top"><div className={`campaign-icon ${campaign.tone}`}>⌁</div><span className={`status-pill ${campaign.status === 'Active' ? 'active' : 'completed'}`}><i />{campaign.status}</span></div><h3>{campaign.name}</h3><p className="muted">{campaign.location}</p><div className="campaign-stats"><div><b>{campaign.candidates}</b><span>Candidates</span></div><div><b>{campaign.completed}</b><span>Screened</span></div><div><b>{campaign.review}</b><span>Review</span></div></div><div className="card-progress"><div className="progress-track"><div style={{ width: `${pct}%` }} /></div><span>{pct}% complete</span><span className="campaign-minutes">◷ {campaign.minutes}</span></div></div> }
function Status({ label }) { const cls = label.toLowerCase().replaceAll(' ', '-'); return <span className={`result-status ${cls}`}><i />{label}</span> }
function DataPage({ active, campaignList, onNewCampaign }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [callMessage, setCallMessage] = useState('')
  const [showContact, setShowContact] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactCampaign, setContactCampaign] = useState('')
  const [campaignOptions, setCampaignOptions] = useState([])
  useEffect(() => {
    if (!supabase) return
    const table = active === 'Candidates' ? 'candidates' : active === 'Campaigns' ? 'campaigns' : 'usage_events'
    const query = active === 'Candidates'
      ? supabase.from(table).select('id, full_name, mobile_number, status, preferred_language, created_at, campaigns(name)').order('created_at', { ascending: false })
      : supabase.from(table).select('*').order('created_at', { ascending: false })
    query.then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [active])
  useEffect(() => {
    if (!supabase || active !== 'Candidates') return
    supabase.from('campaigns').select('id, name').order('name').then(({ data }) => setCampaignOptions(data || []))
  }, [active])
  const startTestCall = async (candidate) => {
    if (!window.confirm(`This will place a real test call to ${candidate.full_name} at ${candidate.mobile_number}. Continue?`)) return
    setCallMessage(`Starting call to ${candidate.full_name}…`)
    const { error } = await supabase.functions.invoke('start-call', { body: { to_number: candidate.mobile_number, candidate_id: candidate.id } })
    setCallMessage(error ? `Call could not be started: ${error.message}` : `Call started to ${candidate.full_name}.`)
  }
  const addContact = async (event) => {
    event.preventDefault()
    const { data, error } = await supabase.from('candidates').insert({ full_name: contactName.trim(), mobile_number: contactPhone.trim(), campaign_id: contactCampaign || null }).select('id, full_name, mobile_number, status, preferred_language, created_at, campaigns(name)').single()
    if (error) {
      setCallMessage(`Contact could not be saved: ${error.message}`)
      return
    }
    setRows(current => [data, ...current])
    setShowContact(false)
    setContactName('')
    setContactPhone('')
    setContactCampaign('')
    setCallMessage(`Contact added for ${data.full_name}.`)
  }
  const title = active === 'Candidates' ? 'Candidates' : active === 'Campaigns' ? 'Campaigns' : 'Usage report'
  const description = active === 'Candidates' ? 'Review every candidate imported into your campaigns.' : active === 'Campaigns' ? 'Create and manage your screening campaigns.' : 'Track calling minutes and estimated costs as the agent goes live.'
  return <div className="data-page"><div className="data-page-heading"><div><p className="eyebrow">WORKSPACE DATA</p><h2>{title}</h2><p className="muted">{description}</p></div>{active === 'Campaigns' && <button className="primary-button" onClick={onNewCampaign}>＋ New campaign</button>}{active === 'Candidates' && <button className="primary-button" onClick={() => setShowContact(true)}>＋ New contact</button>}</div>{callMessage && active === 'Candidates' && <div className="call-message">{callMessage}</div>}<div className="panel data-panel">{loading ? <div className="empty-state">Loading your {title.toLowerCase()}…</div> : active === 'Candidates' ? <table className="data-table"><thead><tr><th>NAME</th><th>MOBILE</th><th>CAMPAIGN</th><th>STATUS</th><th>LANGUAGE</th><th>ACTION</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><b>{row.full_name}</b></td><td>{row.mobile_number}</td><td>{row.campaigns?.name || 'Individual call'}</td><td><Status label={row.status.replaceAll('_', ' ')} /></td><td>{row.preferred_language || 'Not selected'}</td><td><button className="small-call-button" onClick={() => startTestCall(row)}>Test call</button></td></tr>) : <tr><td colSpan="6"><div className="empty-state">No candidates yet. Add a contact to place an individual call.</div></td></tr>}</tbody></table> : active === 'Campaigns' ? <table className="data-table"><thead><tr><th>CAMPAIGN</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr key={row.id}><td><b>{row.name}</b></td><td><Status label={row.status} /></td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>) : <tr><td colSpan="3"><div className="empty-state">No campaigns yet.</div></td></tr>}</tbody></table> : <div className="usage-report-grid"><div className="report-number"><span>Total minutes</span><strong>0</strong><small>Call usage will appear here after telephony is connected.</small></div><div className="report-number"><span>Estimated cost</span><strong>₹0</strong><small>Provider charges will be recorded automatically.</small></div><div className="report-number"><span>Events recorded</span><strong>{rows.length}</strong><small>Usage events from your connected providers.</small></div></div>}</div>{showContact && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowContact(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title"><button className="modal-close" onClick={() => setShowContact(false)}>×</button><div className="modal-kicker">INDIVIDUAL CONTACT</div><h2 id="contact-title">Add a new contact</h2><p className="muted">Add a person for an individual outbound call. Campaign assignment is optional.</p><form onSubmit={addContact}><label>Full name<input autoFocus value={contactName} onChange={event => setContactName(event.target.value)} placeholder="Candidate name" required /></label><label>Mobile number<input value={contactPhone} onChange={event => setContactPhone(event.target.value)} placeholder="+91 98765 43210" required /></label><label>Assign to campaign <span>Optional</span><select value={contactCampaign} onChange={event => setContactCampaign(event.target.value)}><option value="">Individual call — no campaign</option>{campaignOptions.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowContact(false)}>Cancel</button><button className="primary-button" type="submit">Add contact <span>→</span></button></div></form></div></div>}</div>
}
function LoginScreen({ email, setEmail, password, setPassword, error, onSubmit }) { return <main className="login-page"><div className="login-card"><div className="brand login-brand"><div className="brand-mark">V</div><div><div className="brand-name">vaani</div><div className="brand-sub">AI screening studio</div></div></div><div className="login-kicker">PRIVATE WORKSPACE</div><h1>Welcome back</h1><p className="muted">Sign in to manage your candidate screening campaigns.</p><form onSubmit={onSubmit} className="login-form"><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button" type="submit">Sign in <span>→</span></button></form><p className="login-note">Your account is managed through Supabase Auth.</p></div></main> }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
