import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

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
  const [notice, setNotice] = useState('')

  const createCampaign = (event) => {
    event.preventDefault()
    if (!campaignName.trim()) return
    setShowCampaign(false)
    setNotice(`Campaign “${campaignName}” is ready for candidates.`)
    setCampaignName('')
    setTimeout(() => setNotice(''), 3500)
  }

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
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {active}</div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><div className="avatar">NS</div></div></header>
        <div className="content-wrap">
          {notice && <div className="toast"><span>✓</span>{notice}</div>}
          <div className="page-heading"><div><p className="eyebrow">SUNDAY, AUGUST 30, 2026</p><h1>Good afternoon, Nagesh <span className="wave">✦</span></h1><p className="muted">Here’s what’s happening with your candidate screening today.</p></div><button className="primary-button" onClick={() => setShowCampaign(true)}><span>＋</span> New campaign</button></div>

          <section className="metric-grid" aria-label="Screening overview">
            <Metric label="Active campaigns" value="2" detail="+1 this month" icon="▣" accent="blue" />
            <Metric label="Candidates screened" value="109" detail="↗ 18.4% vs last month" icon="♙" accent="purple" />
            <Metric label="Minutes used" value="468" detail="of 1,000 included" icon="◷" accent="orange" progress={47} />
            <Metric label="Need your review" value="22" detail="Across all campaigns" icon="⌁" accent="red" />
          </section>

          <div className="section-heading"><div><h2>Campaigns</h2><p className="muted">Monitor your active screening campaigns.</p></div><button className="text-button" onClick={() => setActive('Campaigns')}>View all <span>→</span></button></div>
          <section className="campaign-grid">{campaigns.map(campaign => <CampaignCard key={campaign.name} campaign={campaign} />)}<button className="new-card" onClick={() => setShowCampaign(true)}><div className="new-card-icon">＋</div><b>Create a campaign</b><span>Upload a JD and start screening</span></button></section>

          <section className="lower-grid"><div className="panel"><div className="panel-heading"><div><h2>Recent candidate activity</h2><p className="muted">The latest screening results from your team.</p></div><button className="filter-button">All campaigns　⌄</button></div><div className="table-wrap"><table><thead><tr><th>CANDIDATE</th><th>CAMPAIGN</th><th>LANGUAGE</th><th>STATUS</th><th>SCREENED</th><th>SCORE</th></tr></thead><tbody>{candidates.map(candidate => <tr key={candidate.name}><td><div className="candidate-cell"><div className={`avatar ${candidate.color}`}>{candidate.initials}</div><div><b>{candidate.name}</b><small>{candidate.role}</small></div></div></td><td className="role-cell">{candidate.role}</td><td><span className="language"><span className="language-dot" />{candidate.lang}</span></td><td><Status label={candidate.status} /></td><td className="date-cell">{candidate.date}<small>{candidate.duration}</small></td><td>{candidate.score ? <div className="score"><b>{candidate.score}</b><span>/100</span></div> : <span className="dash">—</span>}</td></tr>)}</tbody></table></div></div><div className="panel usage-panel"><div className="panel-heading"><div><h2>Usage this month</h2><p className="muted">Your current plan allowance.</p></div><button className="more-button">•••</button></div><div className="usage-total"><strong>468</strong><span>minutes used</span></div><div className="usage-progress"><div style={{ width: '47%' }} /></div><div className="usage-labels"><span>0 min</span><span>1,000 min</span></div><div className="usage-breakdown"><div><span className="legend-dot teal-dot" /><span>Completed calls</span><b>382 min</b></div><div><span className="legend-dot light-dot" /><span>Other / failed</span><b>86 min</b></div></div><button className="outline-button" onClick={() => setActive('Usage')}>Open usage report <span>→</span></button></div></section>
        </div>
      </main>

      {showCampaign && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowCampaign(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setShowCampaign(false)}>×</button><div className="modal-kicker">STEP 1 OF 4</div><h2 id="modal-title">Create a campaign</h2><p className="muted">Start with the job requirement. You can add candidates and screening questions next.</p><form onSubmit={createCampaign}><label>Campaign name <span>Required</span><input autoFocus value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Senior Sales Executive" /></label><label>Job description / requirement<textarea placeholder="Paste the requirement here or upload a document later." rows="4" /></label><div className="modal-actions"><button type="button" className="outline-button" onClick={() => setShowCampaign(false)}>Cancel</button><button className="primary-button" type="submit">Continue <span>→</span></button></div></form></div></div>}
    </div>
  )
}

function Metric({ label, value, detail, icon, accent, progress }) { return <div className="metric-card"><div className={`metric-icon ${accent}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={accent === 'red' ? 'red-text' : ''}>{detail}</small></div>{progress && <div className="mini-progress"><div style={{ width: `${progress}%` }} /></div>}</div> }
function CampaignCard({ campaign }) { const pct = Math.round(campaign.completed / campaign.candidates * 100); return <div className="campaign-card"><div className="campaign-top"><div className={`campaign-icon ${campaign.tone}`}>⌁</div><span className={`status-pill ${campaign.status === 'Active' ? 'active' : 'completed'}`}><i />{campaign.status}</span></div><h3>{campaign.name}</h3><p className="muted">{campaign.location}</p><div className="campaign-stats"><div><b>{campaign.candidates}</b><span>Candidates</span></div><div><b>{campaign.completed}</b><span>Screened</span></div><div><b>{campaign.review}</b><span>Review</span></div></div><div className="card-progress"><div className="progress-track"><div style={{ width: `${pct}%` }} /></div><span>{pct}% complete</span><span className="campaign-minutes">◷ {campaign.minutes}</span></div></div> }
function Status({ label }) { const cls = label.toLowerCase().replaceAll(' ', '-'); return <span className={`result-status ${cls}`}><i />{label}</span> }

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
