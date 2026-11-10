import { useState } from 'react'
import Icon from '../components/Icon'
import { Badge, Button, EmptyState, IconButton, Progress } from '../components/ui'
import { CALLABLE, SCREENED, campaignState, formatDate, formatMinutes } from '../lib/format'

export default function Campaigns({ data, actions }) {
  const { campaigns, candidates, usage } = data
  const [query, setQuery] = useState('')
  const rows = campaigns.filter(campaign => campaign.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Campaigns</h1><p className="muted">Each campaign is one job opening: its questions, its contacts and its calls.</p></div>
        <div className="page-actions"><Button variant="primary" icon="plus" onClick={() => actions.editCampaign()}>New campaign</Button></div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="search"><Icon name="search" size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search campaigns" /></div>
          <span className="muted small">{rows.length} campaign{rows.length === 1 ? '' : 's'}</span>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table className="table">
              <thead><tr><th>Campaign</th><th>Status</th><th>Progress</th><th>Minutes</th><th>Created</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {rows.map(campaign => {
                  const contacts = candidates.filter(c => c.campaign_id === campaign.id)
                  const state = campaignState(campaign, contacts)
                  const screened = contacts.filter(c => SCREENED.includes(c.status)).length
                  const ready = contacts.filter(c => CALLABLE.includes(c.status)).length
                  const minutes = usage.filter(e => e.campaign_id === campaign.id).reduce((s, e) => s + Number(e.minutes || 0), 0)
                  return (
                    <tr key={campaign.id}>
                      <td>
                        <button className="link-cell" onClick={() => actions.openReport(campaign)}>
                          <b>{campaign.name}</b>
                          <small>{campaign.primary_language || 'English'} · {campaign.job_location || 'Location not set'}</small>
                        </button>
                      </td>
                      <td><Badge tone={state.tone}>{state.label}</Badge></td>
                      <td className="progress-cell">
                        <div className="progress-label"><span>{screened} of {contacts.length} screened</span></div>
                        <Progress value={contacts.length ? screened / contacts.length * 100 : 0} />
                      </td>
                      <td className="nowrap">{formatMinutes(minutes)} min</td>
                      <td className="nowrap">{formatDate(campaign.created_at)}</td>
                      <td className="right">
                        <div className="row-actions">
                          <Button size="sm" variant="primary" icon="play" disabled={state.key === 'running' || !ready}
                            title={state.key === 'running' ? 'Calls are in progress' : !ready ? 'No contacts are waiting to be called' : `Call ${ready} contact(s)`}
                            onClick={() => actions.startCampaign(campaign)}>
                            {state.key === 'running' ? 'Calling…' : `Start${ready ? ` (${ready})` : ''}`}
                          </Button>
                          <IconButton icon="report" label="View report" onClick={() => actions.openReport(campaign)} />
                          <IconButton icon="edit" label="Edit campaign" onClick={() => actions.editCampaign(campaign)} />
                          <IconButton icon="copy" label="Duplicate campaign" onClick={() => actions.duplicateCampaign(campaign)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : campaigns.length ? (
          <EmptyState icon="search" title="No matching campaigns">Try a different search.</EmptyState>
        ) : (
          <EmptyState icon="megaphone" title="No campaigns yet" action={<Button variant="primary" icon="plus" onClick={() => actions.editCampaign()}>Create a campaign</Button>}>Set up a job, its screening questions and the contacts to call.</EmptyState>
        )}
      </div>
    </div>
  )
}
