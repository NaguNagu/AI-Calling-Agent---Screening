import Icon from '../components/Icon'
import { Avatar, Badge, Button, EmptyState, Progress, StatusBadge } from '../components/ui'
import { SCREENED, campaignState, displayName, formatDateTime, formatDuration, formatMinutes, greeting, isThisMonth, latestCall, needsReview, todayLabel } from '../lib/format'

function Stat({ icon, tone, label, value, detail, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className={`stat ${onClick ? 'stat-link' : ''}`} onClick={onClick}>
      <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={18} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}{onClick && <Icon name="arrowRight" size={14} />}</div>
    </Tag>
  )
}

export function CampaignCard({ campaign, contacts, minutes, onOpen }) {
  const state = campaignState(campaign, contacts)
  const screened = contacts.filter(contact => SCREENED.includes(contact.status)).length
  const pct = contacts.length ? Math.round(screened / contacts.length * 100) : 0
  return (
    <button className="campaign-card" onClick={onOpen}>
      <div className="campaign-card-top">
        <Badge tone={state.tone}>{state.label}</Badge>
        <span className="lang-chip"><Icon name="globe" size={13} />{campaign.primary_language || 'English'}</span>
      </div>
      <h3>{campaign.name}</h3>
      <p className="muted small"><Icon name="pin" size={13} />{campaign.job_location || 'Location not set'}</p>
      <div className="campaign-card-stats">
        <div><b>{contacts.length}</b><span>Contacts</span></div>
        <div><b>{screened}</b><span>Screened</span></div>
        <div><b>{contacts.filter(needsReview).length}</b><span>To review</span></div>
      </div>
      <Progress value={pct} />
      <div className="campaign-card-foot"><span>{pct}% screened</span><span><Icon name="clock" size={13} />{formatMinutes(minutes)} min</span></div>
    </button>
  )
}

export default function Overview({ user, data, go, actions }) {
  const { campaigns, candidates, usage } = data
  const screened = candidates.filter(contact => SCREENED.includes(contact.status)).length
  const review = candidates.filter(needsReview).length
  const running = campaigns.filter(campaign => campaignState(campaign, candidates.filter(c => c.campaign_id === campaign.id)).key === 'running').length
  const monthMinutes = usage.filter(event => isThisMonth(event.created_at)).reduce((sum, event) => sum + Number(event.minutes || 0), 0)
  const outcomes = [
    { label: 'Screened', tone: 'success', count: screened },
    { label: 'Incomplete', tone: 'warning', count: candidates.filter(c => c.status === 'screening_incomplete').length },
    { label: 'No answer', tone: 'warning', count: candidates.filter(c => c.status === 'no_answer').length },
    { label: 'Call failed', tone: 'danger', count: candidates.filter(c => c.status === 'failed').length },
    { label: 'Not contacted yet', tone: 'neutral', count: candidates.filter(c => c.status === 'not_contacted').length },
  ]
  const maxOutcome = Math.max(1, ...outcomes.map(o => o.count))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="kicker">{todayLabel()}</div>
          <h1>{greeting()}, {displayName(user).split(' ')[0]}</h1>
          <p className="muted">Here’s how your candidate screening is going.</p>
        </div>
        <div className="page-actions">
          <Button icon="users" onClick={actions.addContact}>Add contact</Button>
          <Button variant="primary" icon="plus" onClick={() => actions.editCampaign()}>New campaign</Button>
        </div>
      </div>

      <section className="stats">
        <Stat icon="megaphone" tone="blue" label="Campaigns calling now" value={running} detail={`${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} in total`} />
        <Stat icon="users" tone="green" label="Candidates screened" value={screened} detail={`of ${candidates.length} contacts`} />
        <Stat icon="star" tone="amber" label="Waiting for your review" value={review} detail="Review answers" onClick={review ? () => go('Contacts', { filter: 'review' }) : undefined} />
        <Stat icon="clock" tone="violet" label="Call minutes this month" value={formatMinutes(monthMinutes)} detail="See usage" onClick={() => go('Usage')} />
      </section>

      <div className="section-head">
        <div><h2>Campaigns</h2><p className="muted">Your most recent screening campaigns.</p></div>
        {campaigns.length > 0 && <Button variant="ghost" onClick={() => go('Campaigns')}>View all <Icon name="arrowRight" size={15} /></Button>}
      </div>
      {campaigns.length ? (
        <section className="campaign-grid">
          {campaigns.slice(0, 6).map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign}
              contacts={candidates.filter(c => c.campaign_id === campaign.id)}
              minutes={usage.filter(e => e.campaign_id === campaign.id).reduce((s, e) => s + Number(e.minutes || 0), 0)}
              onOpen={() => actions.openReport(campaign)} />
          ))}
        </section>
      ) : (
        <div className="card"><EmptyState icon="megaphone" title="No campaigns yet" action={<Button variant="primary" icon="plus" onClick={() => actions.editCampaign()}>Create your first campaign</Button>}>Create a campaign with your job details and questions, add contacts, and Kural AI will call them for you.</EmptyState></div>
      )}

      <section className="split">
        <div className="card">
          <div className="card-head">
            <div><h2>Recent activity</h2><p className="muted">Latest contacts and their screening status.</p></div>
            <Button variant="ghost" size="sm" onClick={() => go('Contacts')}>All contacts <Icon name="arrowRight" size={14} /></Button>
          </div>
          {candidates.length ? (
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>Candidate</th><th>Language</th><th>Status</th><th>Last call</th></tr></thead>
                <tbody>
                  {candidates.slice(0, 6).map(contact => {
                    const call = latestCall(contact)
                    return (
                      <tr key={contact.id} className="row-link" onClick={() => actions.openContact(contact)}>
                        <td><div className="person"><Avatar name={contact.full_name} /><div><b>{contact.full_name}</b><small>{contact.campaigns?.name || 'Individual call'}</small></div></div></td>
                        <td>{contact.preferred_language || call?.language || contact.campaigns?.primary_language || 'English'}</td>
                        <td><StatusBadge status={contact.status} /></td>
                        <td className="nowrap">{call ? <>{formatDateTime(call.created_at)}<small className="block muted">{formatDuration(call.duration_seconds)}</small></> : <span className="muted">Not called yet</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No contacts yet">Contacts you add will show up here.</EmptyState>}
        </div>

        <div className="card">
          <div className="card-head"><div><h2>Call outcomes</h2><p className="muted">Across all your contacts.</p></div></div>
          <div className="outcomes">
            {outcomes.map(outcome => (
              <div className="outcome" key={outcome.label}>
                <div className="outcome-row"><span><i className={`dot tone-${outcome.tone}`} />{outcome.label}</span><b>{outcome.count}</b></div>
                <Progress value={outcome.count / maxOutcome * 100} tone={outcome.tone} />
              </div>
            ))}
          </div>
          {candidates.some(c => ['failed', 'no_answer', 'screening_incomplete'].includes(c.status)) && (
            <Button className="full" icon="refresh" onClick={() => go('Contacts', { filter: 'retry' })}>See contacts to call again</Button>
          )}
        </div>
      </section>
    </div>
  )
}
