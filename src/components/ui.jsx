import { useCallback, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { decisionMeta, initials, statusMeta } from '../lib/format'

export function Button({ variant = 'secondary', size, icon, children, className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...props}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className = '', ...props }) {
  return <button className={`icon-btn ${className}`} aria-label={label} title={label} {...props}><Icon name={icon} size={16} /></button>
}

export function Badge({ tone = 'neutral', children, dot = true }) {
  return <span className={`badge badge-${tone}`}>{dot && <i />}{children}</span>
}

export function StatusBadge({ status }) {
  const { label, tone } = statusMeta(status)
  return <Badge tone={tone}>{label}</Badge>
}

export function DecisionBadge({ decision }) {
  const meta = decisionMeta(decision)
  return meta ? <Badge tone={meta.tone} dot={false}>{meta.label}</Badge> : null
}

export function Avatar({ name, size = 'md' }) {
  const palette = ['green', 'blue', 'violet', 'amber', 'rose', 'teal']
  const index = [...(name || '')].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length
  return <span className={`avatar avatar-${size} avatar-${palette[index]}`}>{initials(name)}</span>
}

export function EmptyState({ icon = 'users', title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function Modal({ title, kicker, description, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>
            {kicker && <div className="kicker">{kicker}</div>}
            <h2>{title}</h2>
            {description && <p className="muted">{description}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Drawer({ onClose, children }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay overlay-drawer" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">{children}</aside>
    </div>
  )
}

// A friendlier replacement for the browser's "OK / Cancel" pop-up.
// confirm({...}) resolves to 'confirm', 'secondary' or false.
export function useConfirm() {
  const [state, setState] = useState(null)
  const resolver = useRef(null)
  const confirm = useCallback((options) => new Promise((resolve) => { resolver.current = resolve; setState(options) }), [])
  const close = (result) => { resolver.current?.(result); setState(null) }
  const dialog = state && (
    <Modal title={state.title} onClose={() => close(false)} size="sm" footer={<>
      <Button onClick={() => close(false)}>{state.cancelLabel || 'Cancel'}</Button>
      {state.secondaryLabel && <Button onClick={() => close('secondary')}>{state.secondaryLabel}</Button>}
      <Button variant={state.tone === 'danger' ? 'danger' : 'primary'} icon={state.icon} onClick={() => close('confirm')} autoFocus>{state.confirmLabel || 'Confirm'}</Button>
    </>}>
      <p className="confirm-text">{state.message}</p>
    </Modal>
  )
  return [dialog, confirm]
}

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, toast.tone === 'danger' ? 7000 : 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])
  if (!toast) return null
  return (
    <div className={`toast toast-${toast.tone || 'success'}`} role="status">
      <Icon name={toast.tone === 'danger' ? 'alert' : 'check'} size={16} />
      <span>{toast.text}</span>
      <button onClick={onClose} aria-label="Dismiss"><Icon name="x" size={14} /></button>
    </div>
  )
}

export function Progress({ value, tone = 'brand' }) {
  return <div className={`progress progress-${tone}`}><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}{hint && <small>{hint}</small>}</span>
      {children}
    </label>
  )
}
