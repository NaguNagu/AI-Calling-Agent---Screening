// Shared helpers for showing dates, numbers and statuses consistently.

export const SCREENED = ['completed', 'under_review', 'shortlisted', 'rejected']
export const CALLABLE = ['not_contacted', 'failed', 'no_answer', 'screening_incomplete']

const candidateStatus = {
  not_contacted: ['Not contacted', 'neutral'],
  scheduled: ['Scheduled', 'info'],
  calling: ['Calling now', 'info'],
  completed: ['Screened', 'success'],
  no_answer: ['No answer', 'warning'],
  failed: ['Call failed', 'danger'],
  screening_incomplete: ['Incomplete', 'warning'],
  under_review: ['Under review', 'info'],
  shortlisted: ['Shortlisted', 'success'],
  rejected: ['Rejected', 'danger'],
  contact_later: ['Contact later', 'neutral'],
}

const decisions = {
  shortlisted: ['Shortlisted', 'success'],
  needs_review: ['Needs review', 'info'],
  contact_later: ['Contact later', 'neutral'],
  rejected: ['Rejected', 'danger'],
}

export const DECISION_OPTIONS = Object.entries(decisions).map(([value, [label, tone]]) => ({ value, label, tone }))

export function statusMeta(status) {
  const [label, tone] = candidateStatus[status] || [status ? status.replaceAll('_', ' ') : 'Unknown', 'neutral']
  return { label, tone }
}

export function decisionMeta(decision) {
  if (!decision) return null
  const [label, tone] = decisions[decision] || [decision.replaceAll('_', ' '), 'neutral']
  return { label, tone }
}

export function needsReview(candidate) {
  return (SCREENED.includes(candidate.status) && !candidate.recruiter_decision) || candidate.recruiter_decision === 'needs_review'
}

// What a campaign really looks like right now, worked out from its contacts.
export function campaignState(campaign, contacts) {
  const calling = contacts.some(contact => contact.status === 'calling')
  if (campaign.status === 'in_progress' && calling) return { key: 'running', label: 'Calling', tone: 'info' }
  if (campaign.status === 'completed') return { key: 'completed', label: 'Completed', tone: 'success' }
  if (campaign.status === 'error') return { key: 'error', label: 'Needs attention', tone: 'danger' }
  if (!contacts.length) return { key: 'draft', label: 'Draft', tone: 'neutral' }
  return { key: 'ready', label: 'Ready to call', tone: 'neutral' }
}

export function formatMinutes(value) {
  const n = Number(value || 0)
  return Number(n.toFixed(n < 10 ? 2 : 1)).toLocaleString('en-IN')
}

export function formatDuration(seconds) {
  if (!seconds) return '—'
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function formatDateTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value || 0))
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
}

export function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

export function displayName(user) {
  const meta = user?.user_metadata || {}
  const name = meta.full_name || meta.name
  if (name) return name
  const prefix = (user?.email || 'there').split('@')[0].replace(/[._-]+/g, ' ')
  return prefix.replace(/\b\w/g, letter => letter.toUpperCase())
}

export function initials(name = '') {
  return name.trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export function latestCall(candidate) {
  return [...(candidate.calls || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
}

export function isThisMonth(value, now = new Date()) {
  const d = new Date(value)
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}
