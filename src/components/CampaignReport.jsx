import { Avatar, Badge, Button, EmptyState, Modal, StatusBadge, DecisionBadge } from './ui'
import Icon from './Icon'
import { CALLABLE, SCREENED, campaignState, formatDateTime, formatDuration, latestCall } from '../lib/format'

export default function CampaignReport({ campaign, data, actions, onClose }) {
  const contacts = data.candidates.filter(c => c.campaign_id === campaign.id)
  const state = campaignState(campaign, contacts)
  const count = (test) => contacts.filter(test).length
  const ready = count(c => CALLABLE.includes(c.status))
  const summary = [
    ['Contacts', contacts.length],
    ['Screened', count(c => SCREENED.includes(c.status))],
    ['No answer / incomplete', count(c => ['no_answer', 'screening_incomplete'].includes(c.status))],
    ['Failed', count(c => c.status === 'failed')],
  ]

  return (
    <Modal size="lg" kicker="Campaign" title={campaign.name} onClose={onClose}
      description={<>{campaign.primary_language || 'English'} · {campaign.job_location || 'Location not set'} · <Badge tone={state.tone}>{state.label}</Badge></>}
      footer={<>
        <Button icon="edit" onClick={() => { onClose(); actions.editCampaign(campaign) }}>Edit campaign</Button>
        <Button variant="primary" icon="play" disabled={state.key === 'running' || !ready} onClick={() => actions.startCampaign(campaign)}>{state.key === 'running' ? 'Calling…' : ready ? `Call ${ready} contact${ready === 1 ? '' : 's'}` : 'Nobody left to call'}</Button>
      </>}>
      <div className="mini-stats">{summary.map(([label, value]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
      {contacts.length ? (
        <div className="report-list">
          {contacts.map(contact => {
            const call = latestCall(contact)
            const canRetry = ['failed', 'no_answer', 'screening_incomplete'].includes(contact.status)
            return (
              <div className="report-row" key={contact.id}>
                <button className="report-person" onClick={() => { onClose(); actions.openContact(contact) }}>
                  <Avatar name={contact.full_name} />
                  <span><b>{contact.full_name}</b><small>{contact.mobile_number}</small></span>
                </button>
                <div className="badge-stack"><StatusBadge status={contact.status} /><DecisionBadge decision={contact.recruiter_decision} /></div>
                <small className="muted report-call">{call ? `${formatDateTime(call.created_at)} · ${formatDuration(call.duration_seconds)}` : 'Not called yet'}</small>
                <div className="row-actions">
                  {canRetry && <Button size="sm" icon="refresh" onClick={() => actions.callContact(contact)}>Call again</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { onClose(); actions.openContact(contact) }}>Answers <Icon name="chevronRight" size={14} /></Button>
                </div>
              </div>
            )
          })}
        </div>
      ) : <EmptyState title="No contacts in this campaign" action={<Button icon="plus" onClick={() => { onClose(); actions.editCampaign(campaign) }}>Add contacts</Button>}>Edit the campaign to add people to call.</EmptyState>}
    </Modal>
  )
}
