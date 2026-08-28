import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'
import Footer from '../components/Footer'

export default function History() {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setRuns(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // Click a run → navigate to that simulator with inputs pre-filled and results shown
  const openRun = (run) => {
    const path = `/simulator/${run.simulator_id}`
    // Pass the saved payload via navigation state
    navigate(path, {
      state: {
        restore: true,
        inputs: run.payload?.inputs,
        results: run.payload?.key_results,
        label: run.label,
      }
    })
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) +
      ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })
  }

  const simColor = {
    distillation: '#2563eb',
    'heat-exchanger': '#16a34a',
    reactor: '#dc2626',
    'pressure-vessel': '#ea580c',
    mixer: '#0891b2',
    'storage-tank': '#ca8a04',
    piping: '#15803d',
    separations: '#a21caf',
    meb: '#1d4ed8',
  }

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-4xl mx-auto px-8 pt-10 pb-8">
        <h1 className="text-[22px] font-bold text-ink tracking-tight mb-1">Calculation history</h1>
        <p className="text-[13px] text-muted mb-6">
          Your last 50 calculations. Click any row to reload that calculation with all inputs and results.
        </p>

        {loading && (
          <div className="flex items-center gap-2 text-muted text-[13px] py-8">
            <div className="w-4 h-4 border-2 border-line border-t-brand rounded-full animate-spin"/>
            Loading history…
          </div>
        )}

        {!loading && runs.length === 0 && (
          <div className="text-center py-16 bg-soft rounded-xl border border-line">
            <p className="text-[14px] font-medium text-ink mb-2">No calculations yet</p>
            <p className="text-[12.5px] text-muted">
              Run a simulator and your calculations will appear here automatically.
            </p>
          </div>
        )}

        {!loading && runs.length > 0 && (
          <div className="border border-line rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-line">
                  <th className="text-left py-3 px-4 text-[11px] font-bold text-muted uppercase tracking-wide">Simulator</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold text-muted uppercase tracking-wide">Summary</th>
                  <th className="text-left py-3 px-4 text-[11px] font-bold text-muted uppercase tracking-wide">Date & Time</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => {
                  const simName = run.simulator_id?.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
                  const color = simColor[run.simulator_id] || '#64748b'
                  const summary = run.label?.split('—')[1]?.trim() || '—'
                  return (
                    <tr key={run.id}
                      onClick={() => openRun(run)}
                      className="border-b border-line last:border-0 hover:bg-[#f8fafc] cursor-pointer transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}/>
                          <span className="text-[12.5px] font-medium text-ink">{simName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[12px] text-muted">{summary}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[12px] text-muted">{formatDate(run.created_at)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[12px] font-medium text-brand">Reload →</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
