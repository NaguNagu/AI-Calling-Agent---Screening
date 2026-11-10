import { useEffect, useState } from 'react'
import Icon from './Icon'
import { Button, Field, IconButton, Modal, StatusBadge } from './ui'
import { supabase } from '../lib/supabase'

// These four are always asked by the voice agent (see bridge/server.js).
const STANDARD_QUESTIONS = [
  'What date and time suits you for an interview?',
  'Would you prefer a face-to-face or virtual interview?',
  'What is your last working day or notice period?',
  'What is the main reason for looking for a job change?',
]

const empty = { name: '', job_location: '', company_name: '', company_disclosure: 'if_asked', primary_language: 'English', caller_name: 'Anitha', jd_text: '' }

function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  if (lines.length < 2) return { error: 'The file needs a header row and at least one contact.' }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replaceAll(' ', '_'))
  const nameIndex = ['full_name', 'name'].map(h => headers.indexOf(h)).find(i => i >= 0)
  const phoneIndex = ['mobile_number', 'mobile', 'phone', 'phone_number'].map(h => headers.indexOf(h)).find(i => i >= 0)
  if (nameIndex === undefined || phoneIndex === undefined) return { error: 'Columns needed: full_name and mobile_number.' }
  const rows = lines.slice(1).map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')))
    .map(values => ({ full_name: values[nameIndex], mobile_number: values[phoneIndex] }))
    .filter(row => row.full_name && row.mobile_number)
  return { rows }
}

export default function CampaignForm({ campaign, onClose, onSaved, notify }) {
  const editing = Boolean(campaign?.id)
  const [form, setForm] = useState(empty)
  const [questions, setQuestions] = useState('')
  const [contacts, setContacts] = useState([])
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [csvNote, setCsvNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(editing)
  const set = (key) => (event) => setForm(current => ({ ...current, [key]: event.target.value }))

  useEffect(() => {
    if (!editing) return
    Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaign.id).single(),
      supabase.from('screening_questions').select('question_text').eq('campaign_id', campaign.id).eq('is_active', true).order('sort_order'),
      supabase.from('candidates').select('id, full_name, mobile_number, status').eq('campaign_id', campaign.id).order('created_at'),
    ]).then(([c, q, k]) => {
      if (c.error) { notify({ tone: 'danger', text: `Couldn’t open the campaign: ${c.error.message}` }); onClose(); return }
      setForm({ ...empty, ...Object.fromEntries(Object.keys(empty).map(key => [key, c.data[key] ?? empty[key]])) })
      setQuestions((q.data || []).map(row => row.question_text).join('\n'))
      setContacts(k.data || [])
      setLoading(false)
    })
  }, [editing, campaign, notify, onClose])

  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) return
    setContacts(current => [...current, { full_name: newName.trim(), mobile_number: newPhone.trim(), status: 'not_contacted', isNew: true }])
    setNewName('')
    setNewPhone('')
  }

  const readCsv = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { rows, error } = parseCsv(reader.result)
      if (error) { setCsvNote(error); return }
      setContacts(current => [...current, ...rows.map(row => ({ ...row, status: 'not_contacted', isNew: true }))])
      setCsvNote(`${rows.length} contact${rows.length === 1 ? '' : 's'} added from ${file.name}.`)
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  const updateContact = (index, key, value) => setContacts(current => current.map((c, i) => i === index ? { ...c, [key]: value, changed: !c.isNew } : c))
  const removeContact = (index) => setContacts(current => current.map((c, i) => i === index ? { ...c, removed: true } : c).filter(c => !(c.removed && c.isNew)))

  const save = async (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload = { ...form, name: form.name.trim(), job_location: form.job_location.trim() || null, company_name: form.company_name.trim() || null, caller_name: form.caller_name.trim() || 'Anitha', jd_text: form.jd_text.trim() || null }
    const { data, error } = editing
      ? await supabase.from('campaigns').update(payload).eq('id', campaign.id).select('id, name').single()
      : await supabase.from('campaigns').insert({ ...payload, status: 'created' }).select('id, name').single()
    if (error) { setSaving(false); notify({ tone: 'danger', text: `Campaign wasn’t saved: ${error.message}` }); return }

    const problems = []
    // Pick up a contact typed into the boxes but not yet added with the button.
    const pending = newName.trim() && newPhone.trim() ? [{ full_name: newName.trim(), mobile_number: newPhone.trim(), isNew: true }] : []
    const toInsert = [...contacts.filter(c => c.isNew), ...pending].map(c => ({ campaign_id: data.id, full_name: c.full_name, mobile_number: c.mobile_number }))
    if (toInsert.length) { const r = await supabase.from('candidates').insert(toInsert); if (r.error) problems.push(r.error.message) }
    for (const c of contacts.filter(c => c.removed && c.id)) { const r = await supabase.from('candidates').delete().eq('id', c.id); if (r.error) problems.push(r.error.message) }
    for (const c of contacts.filter(c => c.changed && !c.removed && c.id)) { const r = await supabase.from('candidates').update({ full_name: c.full_name, mobile_number: c.mobile_number }).eq('id', c.id); if (r.error) problems.push(r.error.message) }

    const questionRows = questions.split('\n').map(q => q.trim()).filter(Boolean).map((question_text, sort_order) => ({ campaign_id: data.id, question_text, sort_order, required: false }))
    if (editing) await supabase.from('screening_questions').delete().eq('campaign_id', data.id)
    if (questionRows.length) { const r = await supabase.from('screening_questions').insert(questionRows); if (r.error) problems.push(r.error.message) }

    setSaving(false)
    onSaved(problems.length
      ? { tone: 'danger', text: `“${data.name}” was saved, but some details weren’t: ${problems[0]}` }
      : { text: editing ? `“${data.name}” was updated.` : `“${data.name}” is ready. Start calling from the Campaigns page.` })
  }

  const visibleContacts = contacts.map((c, index) => ({ ...c, index })).filter(c => !c.removed)

  return (
    <Modal size="lg" kicker={editing ? 'Edit campaign' : 'New campaign'} title={editing ? form.name || 'Edit campaign' : 'Create a campaign'}
      description="Set up the job, what the agent should ask, and who to call." onClose={onClose}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="campaign-form" disabled={saving || loading || !form.name.trim()}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create campaign'}</Button></>}>
      {loading ? <div className="loading-block">Loading campaign…</div> : (
        <form id="campaign-form" className="form" onSubmit={save}>
          <section className="form-section">
            <div className="form-section-head"><span className="step">1</span><div><h3>Job details</h3><p className="muted small">What this campaign is hiring for.</p></div></div>
            <div className="grid-2">
              <Field label="Job title / campaign name" hint="Required"><input value={form.name} onChange={set('name')} placeholder="e.g. Senior Sales Executive" required autoFocus /></Field>
              <Field label="Job location"><input value={form.job_location} onChange={set('job_location')} placeholder="e.g. Chennai" /></Field>
              <Field label="Company name"><input value={form.company_name} onChange={set('company_name')} placeholder="Your company or client" /></Field>
              <Field label="Tell candidates the company name?">
                <select value={form.company_disclosure} onChange={set('company_disclosure')}>
                  <option value="if_asked">Only if they ask</option>
                  <option value="always">Always</option>
                  <option value="never">Never</option>
                </select>
              </Field>
            </div>
            <Field label="Job description" hint="Optional"><textarea rows="3" value={form.jd_text} onChange={set('jd_text')} placeholder="Paste the job requirement here." /></Field>
          </section>

          <section className="form-section">
            <div className="form-section-head"><span className="step">2</span><div><h3>The call</h3><p className="muted small">How the voice agent introduces itself and what it asks.</p></div></div>
            <div className="grid-2">
              <Field label="Call language">
                <select value={form.primary_language} onChange={set('primary_language')}><option>English</option><option>Tamil</option><option>Hindi</option></select>
              </Field>
              <Field label="Caller name" hint="The name the agent uses"><input value={form.caller_name} onChange={set('caller_name')} placeholder="Anitha" /></Field>
            </div>
            <div className="standard-qs">
              <b>Always asked</b>
              <ol>{STANDARD_QUESTIONS.map(q => <li key={q}>{q}</li>)}</ol>
            </div>
            <Field label="Your extra questions" hint="One question per line"><textarea rows="4" value={questions} onChange={e => setQuestions(e.target.value)} placeholder={'How many years of sales experience do you have?\nWhat is your current salary?'} /></Field>
          </section>

          <section className="form-section">
            <div className="form-section-head"><span className="step">3</span><div><h3>Contacts</h3><p className="muted small">Add people one at a time, or upload a CSV file.</p></div></div>
            <div className="add-row">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" aria-label="Full name" />
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Mobile, e.g. 98765 43210" aria-label="Mobile number" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addContact() } }} />
              <Button type="button" icon="plus" onClick={addContact} disabled={!newName.trim() || !newPhone.trim()}>Add</Button>
            </div>
            <label className="upload">
              <input type="file" accept=".csv,text/csv" onChange={readCsv} />
              <Icon name="upload" size={18} />
              <span><b>Upload a CSV file</b><small>Columns: full_name, mobile_number</small></span>
            </label>
            {csvNote && <p className="small muted">{csvNote}</p>}
            {visibleContacts.length > 0 && (
              <div className="contact-list">
                <div className="contact-list-head">{visibleContacts.length} contact{visibleContacts.length === 1 ? '' : 's'}</div>
                {visibleContacts.map(c => (
                  <div className="contact-list-row" key={c.id || `new-${c.index}`}>
                    <input value={c.full_name} onChange={e => updateContact(c.index, 'full_name', e.target.value)} aria-label="Contact name" />
                    <input value={c.mobile_number} onChange={e => updateContact(c.index, 'mobile_number', e.target.value)} aria-label="Mobile number" />
                    {c.isNew ? <span className="new-tag">New</span> : <StatusBadge status={c.status} />}
                    <IconButton icon="trash" label="Remove contact" type="button" onClick={() => removeContact(c.index)} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </form>
      )}
    </Modal>
  )
}
