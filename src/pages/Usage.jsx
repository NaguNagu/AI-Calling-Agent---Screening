import Icon from '../components/Icon'
import { EmptyState, Progress } from '../components/ui'
import { formatCurrency, formatDateTime, formatMinutes, isThisMonth } from '../lib/format'

function Stat({ icon, tone, label, value, detail }) {
  return (
    <div className="stat">
      <div className={`stat-icon tone-${tone}`}><Icon name={icon} size={18} /></div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  )
}

export default function Usage({ data }) {
  const { campaigns, usage } = data
  const sum = (events) => events.reduce((total, event) => total + Number(event.minutes || 0), 0)
  const thisMonth = usage.filter(event => isThisMonth(event.created_at))
  const priced = usage.filter(event => event.estimated_cost != null)
  const cost = priced.reduce((total, event) => total + Number(event.estimated_cost), 0)
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date())

  const byCampaign = [...campaigns.map(c => ({ id: c.id, name: c.name })), { id: null, name: 'Individual calls' }]
    .map(group => { const events = usage.filter(e => (e.campaign_id || null) === group.id); return { ...group, calls: events.length, minutes: sum(events) } })
    .filter(group => group.calls > 0)
    .sort((a, b) => b.minutes - a.minutes)
  const maxMinutes = Math.max(1, ...byCampaign.map(g => g.minutes))
  const campaignName = (id) => campaigns.find(c => c.id === id)?.name || 'Individual call'

  return (
    <div className="page">
      <div className="page-head"><div><h1>Usage</h1><p className="muted">Call minutes recorded for every call Kural AI has made.</p></div></div>

      <section className="stats">
        <Stat icon="clock" tone="violet" label={`Minutes in ${monthName}`} value={formatMinutes(sum(thisMonth))} detail={`${thisMonth.length} call${thisMonth.length === 1 ? '' : 's'} this month`} />
        <Stat icon="chart" tone="blue" label="Minutes all time" value={formatMinutes(sum(usage))} detail={`${usage.length} calls recorded`} />
        <Stat icon="phone" tone="green" label="Average call length" value={usage.length ? `${formatMinutes(sum(usage) / usage.length)} min` : '—'} detail="Per recorded call" />
        <Stat icon="report" tone="amber" label="Estimated cost" value={priced.length ? formatCurrency(cost) : 'Not tracked'} detail={priced.length ? `From ${priced.length} priced calls` : 'Provider prices aren’t recorded yet'} />
      </section>

      {usage.length ? (
        <section className="split split-even">
          <div className="card">
            <div className="card-head"><div><h2>Minutes by campaign</h2><p className="muted">Where your calling time goes.</p></div></div>
            <div className="outcomes">
              {byCampaign.map(group => (
                <div className="outcome" key={group.id || 'none'}>
                  <div className="outcome-row"><span>{group.name}</span><b>{formatMinutes(group.minutes)} min <small className="muted">· {group.calls} call{group.calls === 1 ? '' : 's'}</small></b></div>
                  <Progress value={group.minutes / maxMinutes * 100} />
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><div><h2>Recent calls</h2><p className="muted">The latest recorded usage.</p></div></div>
            <div className="table-scroll">
              <table className="table">
                <thead><tr><th>When</th><th>Campaign</th><th className="right">Minutes</th></tr></thead>
                <tbody>
                  {usage.slice(0, 10).map(event => (
                    <tr key={event.id}><td className="nowrap">{formatDateTime(event.created_at)}</td><td>{campaignName(event.campaign_id)}</td><td className="right">{formatMinutes(event.minutes)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <div className="card"><EmptyState icon="chart" title="No calls recorded yet">Minutes appear here automatically after each call ends.</EmptyState></div>
      )}
    </div>
  )
}
