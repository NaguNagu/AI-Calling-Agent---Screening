import { useEffect, useState } from 'react'
import Icon from './Icon'
import { Avatar, Badge, Button, Drawer, EmptyState, IconButton, StatusBadge } from './ui'
import { supabase } from '../lib/supabase'
import { DECISION_OPTIONS, formatDateTime, formatDuration, statusMeta } from '../lib/format'

const KEY_ANSWERS = [
  ['interview_availability', 'Interview availability'],
  ['interview_type', 'Interview preference'],
  ['notice_period', 'Notice period / last day'],
  ['reason_for_job_change', 'Reason for change'],
]

export default function ContactDrawer({ contact, onClose, onCall, onChanged, notify }) {
  const [details, setDetails] = useState(null)
  const [calls, setCalls] = useState([])
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('candidates').select('*, campaigns(name, primary_language)').eq('id', contact.id).single(),
      supabase.from('calls').select('id, status, language, duration_seconds, created_at, failure_reason, ai_summary, candidate_answers(question_text, answer_text, created_at)').eq('candidate_id', contact.id).order('created_at', { ascending: false }),
    ]).then(([c, k]) => {
      if (!alive) return
      if (c.data) { setDetails(c.data); setNotes(c.data.recruiter_notes || '') }
      setCalls(k.data || [])
    })
    return () => { alive = false }
  }, [contact.id])

  const person = details || contact
  const decide = async (value) => {
    const next = person.recruiter_decision === value ? null : value
    const { error } = await supabase.from('candidates').update({ recruiter_decision: next }).eq('id', contact.id)
    if (error) { notify({ tone: 'danger', text: `Couldn’t save the decision: ${error.message}` }); return }
    setDetails(current => ({ ...current, recruiter_decision: next }))
    onChanged()
  }
  const saveNotes = async () => {
    setSavingNotes(true)
    const { error } = await supabase.from('candidates').update({ recruiter_notes: notes.trim() || null }).eq('id', contact.id)
    setSavingNotes(false)
    notify(error ? { tone: 'danger', text: `Notes weren’t saved: ${error.message}` } : { text: 'Notes saved.' })
    if (!error) setDetails(current => ({ ...current, recruiter_notes: notes.trim() || null }))
  }
  const keyAnswers = details ? KEY_ANSWERS.filter(([key]) => details[key]) : []

  return (
    <Drawer onClose={onClose}>
      <header className="drawer-head">
        <div className="person person-lg">
          <Avatar name={person.full_name} size="lg" />
          <div><h2>{person.full_name}</h2><small className="muted">{person.mobile_number} · {person.campaigns?.name || 'Individual call'}</small></div>
        </div>
        <IconButton icon="x" label="Close" onClick={onClose} />
      </header>

      <div className="drawer-body">
        <div className="drawer-actions">
          <StatusBadge status={person.status} />
          <Button size="sm" variant="primary" icon="phone" disabled={person.status === 'calling'} onClick={() => onCall(person)}>{person.status === 'calling' ? 'Calling…' : 'Call now'}</Button>
        </div>

        <section className="drawer-section">
          <h3>Your decision</h3>
          <div className="decision-group">
            {DECISION_OPTIONS.map(option => (
              <button key={option.value} className={`decision decision-${option.tone} ${person.recruiter_decision === option.value ? 'active' : ''}`} onClick={() => decide(option.value)} disabled={!details}>
                {person.recruiter_decision === option.value && <Icon name="check" size={14} />}{option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="drawer-section">
          <h3>Key answers</h3>
          {!details ? <div className="loading-block">Loading…</div> : keyAnswers.length ? (
            <dl className="answers-grid">{keyAnswers.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{details[key]}</dd></div>)}</dl>
          ) : <p className="muted small">No answers yet. They’ll appear here after a completed screening call.</p>}
        </section>

        <section className="drawer-section">
          <h3>Notes</h3>
          <textarea rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a private note about this candidate" />
          {notes !== (details?.recruiter_notes || '') && <div className="form-actions"><Button size="sm" variant="primary" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? 'Saving…' : 'Save note'}</Button></div>}
        </section>

        <section className="drawer-section">
          <h3>Call history</h3>
          {calls.length ? calls.map(call => {
            const meta = statusMeta(call.status === 'completed' ? 'completed' : call.status)
            return (
              <div className="call" key={call.id}>
                <div className="call-head">
                  <span><Icon name="phone" size={14} />{formatDateTime(call.created_at)}</span>
                  <span className="muted small">{formatDuration(call.duration_seconds)}{call.language ? ` · ${call.language}` : ''}</span>
                  <Badge tone={call.status === 'completed' ? (call.candidate_answers?.length ? 'success' : 'warning') : meta.tone}>
                    {call.status === 'completed' ? (call.candidate_answers?.length ? 'Answered' : 'Ended early') : call.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                {call.failure_reason && call.status !== 'completed' && <p className="muted small">Reason: {call.failure_reason}</p>}
                {call.candidate_answers?.length > 0 && (
                  <ol className="qa">{call.candidate_answers.map((a, i) => <li key={i}><b>{a.question_text}</b><span>{a.answer_text || '—'}</span></li>)}</ol>
                )}
              </div>
            )
          }) : <EmptyState icon="phone" title="Not called yet">Press “Call now” to start a screening call.</EmptyState>}
        </section>
      </div>
    </Drawer>
  )
}
