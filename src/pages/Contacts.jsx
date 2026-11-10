import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { Avatar, Button, DecisionBadge, EmptyState, StatusBadge } from '../components/ui'
import { SCREENED, formatDateTime, formatDuration, latestCall, needsReview } from '../lib/format'

const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'review', label: 'To review', test: needsReview },
  { key: 'screened', label: 'Screened', test: c => SCREENED.includes(c.status) },
  { key: 'new', label: 'Not called', test: c => c.status === 'not_contacted' },
  { key: 'retry', label: 'Call again', test: c => ['failed', 'no_answer', 'screening_incomplete'].includes(c.status) },
  { key: 'shortlisted', label: 'Shortlisted', test: c => c.recruiter_decision === 'shortlisted' },
]

export default function Contacts({ data, actions, initialFilter }) {
  const { campaigns, candidates } = data
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState(initialFilter || 'all')
  const [campaignId, setCampaignId] = useState('')
  useEffect(() => { if (initialFilter) setFilter(initialFilter) }, [initialFilter])

  const activeFilter = FILTERS.find(f => f.key === filter) || FILTERS[0]
  const q = query.trim().toLowerCase()
  const rows = candidates.filter(contact =>
    activeFilter.test(contact)
    && (!campaignId || (campaignId === 'none' ? !contact.campaign_id : contact.campaign_id === campaignId))
    && (!q || contact.full_name.toLowerCase().includes(q) || String(contact.mobile_number).includes(q)))

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Contacts</h1><p className="muted">Everyone you’ve added. Click a person to see their answers and decide next steps.</p></div>
        <div className="page-actions"><Button variant="primary" icon="plus" onClick={actions.addContact}>Add contact</Button></div>
      </div>

      <div className="card">
        <div className="toolbar toolbar-wrap">
          <div className="chips" role="tablist">
            {FILTERS.map(f => {
              const count = candidates.filter(f.test).length
              return <button key={f.key} role="tab" aria-selected={filter === f.key} className={`chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}<span>{count}</span></button>
            })}
          </div>
          <div className="toolbar-right">
            <select className="select-sm" value={campaignId} onChange={event => setCampaignId(event.target.value)} aria-label="Filter by campaign">
              <option value="">All campaigns</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="none">Individual calls</option>
            </select>
            <div className="search"><Icon name="search" size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name or number" /></div>
          </div>
        </div>

        {rows.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Name</th><th>Campaign</th><th>Language</th><th>Status</th><th>Last call</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {rows.map(contact => {
                  const call = latestCall(contact)
                  return (
                    <tr key={contact.id} className="row-link" onClick={() => actions.openContact(contact)}>
                      <td><div className="person"><Avatar name={contact.full_name} /><div><b>{contact.full_name}</b><small>{contact.mobile_number}</small></div></div></td>
                      <td>{contact.campaigns?.name || <span className="muted">Individual call</span>}</td>
                      <td>{contact.preferred_language || call?.language || contact.campaigns?.primary_language || 'English'}</td>
                      <td><div className="badge-stack"><StatusBadge status={contact.status} /><DecisionBadge decision={contact.recruiter_decision} /></div></td>
                      <td className="nowrap">{call ? <>{formatDateTime(call.created_at)}<small className="block muted">{formatDuration(call.duration_seconds)}</small></> : <span className="muted">—</span>}</td>
                      <td className="right" onClick={event => event.stopPropagation()}>
                        <div className="row-actions">
                          <Button size="sm" icon="phone" disabled={contact.status === 'calling'} onClick={() => actions.callContact(contact)}>{contact.status === 'calling' ? 'Calling…' : 'Call'}</Button>
                          <Button size="sm" variant="ghost" onClick={() => actions.openContact(contact)}>View <Icon name="chevronRight" size={14} /></Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : candidates.length ? (
          <EmptyState icon="search" title="Nobody matches these filters">Try another filter or clear the search.</EmptyState>
        ) : (
          <EmptyState title="No contacts yet" action={<Button variant="primary" icon="plus" onClick={actions.addContact}>Add a contact</Button>}>Add a single person here, or add many at once from a CSV file when you create a campaign.</EmptyState>
        )}
      </div>
    </div>
  )
}
