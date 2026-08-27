import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import toast from 'react-hot-toast'
import { SIMULATORS } from '../lib/simulators'

export default function History() {
  const { user } = useAuth()
  const [runs, setRuns]     = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRuns = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) toast.error('Could not load history')
    else setRuns(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRuns() }, [user])

  const deleteRun = async (id) => {
    await supabase.from('runs').delete().eq('id', id)
    setRuns(r => r.filter(x => x.id !== id))
    toast.success('Run deleted')
  }

  const simName = id => SIMULATORS.find(s => s.id === id)?.name || id

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-5xl mx-auto px-8 pt-14 pb-8">
        <div className="mb-10">
          <h1 className="text-[26px] font-bold text-ink tracking-tight mb-1">Simulation history</h1>
          <p className="text-[13.5px] text-muted">Your last 50 saved runs.</p>
        </div>

        {loading ? (
          <p className="text-[13px] text-muted">Loading…</p>
        ) : runs.length === 0 ? (
          <div className="text-center py-24 border border-line rounded-2xl">
            <p className="text-[15px] font-medium text-ink mb-2">No saved runs yet</p>
            <p className="text-[13px] text-muted mb-6">Run a simulator and save your results to see them here.</p>
            <Link to="/dashboard"><button className="btn-primary">Open a simulator</button></Link>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="grid py-2 border-b border-line text-[11px] font-semibold text-muted uppercase tracking-wider px-2"
              style={{ gridTemplateColumns: '1fr 160px 160px 100px' }}>
              <span>Simulator</span><span>Date</span><span>Label</span><span></span>
            </div>
            {runs.map(run => (
              <div key={run.id}
                className="grid items-center py-3.5 border-b border-line px-2 hover:bg-neutral-50 rounded transition-colors"
                style={{ gridTemplateColumns: '1fr 160px 160px 100px' }}>
                <span className="text-[13.5px] font-medium text-ink">{simName(run.simulator_id)}</span>
                <span className="text-[12px] text-muted">
                  {new Date(run.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
                <span className="text-[12px] text-muted truncate">{run.label || 'Untitled run'}</span>
                <div className="flex justify-end gap-3">
                  <Link to={`/simulator/${run.simulator_id}`}>
                    <button className="text-[11.5px] text-brand hover:underline bg-transparent border-none cursor-pointer">Open →</button>
                  </Link>
                  <button onClick={() => deleteRun(run.id)}
                    className="text-[11.5px] text-muted hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
