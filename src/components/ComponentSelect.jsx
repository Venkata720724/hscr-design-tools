import { useState, useRef, useEffect } from 'react'
import { COMPONENTS, searchComponents } from '../lib/components_db'

// Searchable dropdown for component selection
// Auto-fills Antoine constants and physical properties
// All fields remain editable after selection

export default function ComponentSelect({ label, onSelect }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const ref = useRef(null)
  const results = searchComponents(query)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (comp) => {
    setSelected(comp)
    setQuery(comp.name)
    setOpen(false)
    onSelect(comp)
  }

  return (
    <div ref={ref} className="mb-3 relative">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wide block mb-1">{label}</label>
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setSelected(null) }}
        onFocus={() => setOpen(true)}
        placeholder="Type to search component..."
        className="w-full h-8 border border-line rounded-lg px-2.5 text-[12px] bg-white text-ink focus:outline-none focus:border-brand transition-colors"
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-line rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {results.map(comp => (
            <button key={comp.name} onClick={() => pick(comp)}
              className="w-full text-left px-3 py-2 hover:bg-soft transition-colors border-b border-line last:border-0 cursor-pointer bg-transparent">
              <span className="text-[12px] font-medium text-ink">{comp.name}</span>
              <span className="text-[10.5px] text-muted ml-2">{comp.formula}</span>
              <span className="text-[10px] text-muted ml-2">MW={comp.MW}</span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="text-[10px] text-green-600 mt-0.5">
          ✓ {selected.name} selected — all properties auto-filled. Edit any value below if needed.
        </p>
      )}
      {!selected && query.length > 2 && results.length === 0 && (
        <p className="text-[10px] text-muted mt-0.5">
          Component not found — enter values manually below.
        </p>
      )}
    </div>
  )
}
