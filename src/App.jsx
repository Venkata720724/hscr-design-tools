import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing    from './pages/Landing'
import Login      from './pages/Login'
import Register   from './pages/Register'
import Dashboard  from './pages/Dashboard'
import About      from './pages/About'
import History    from './pages/History'
import DistillationPage from './simulators/distillation/Page'
import HXPage           from './simulators/heat-exchanger/Page'
import ReactorPage      from './simulators/reactor/Page'
import Nav    from './components/Nav'
import Footer from './components/Footer'
import { SIMULATORS } from './lib/simulators'

function ComingSoon({ id }) {
  const sim = SIMULATORS.find(s => s.id === id)
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <div className="max-w-5xl mx-auto px-8 pt-24 pb-8 text-center">
        <h1 className="text-[28px] font-bold text-ink tracking-tight mb-3">{sim?.name}</h1>
        <p className="text-[14px] text-muted mb-2">{sim?.tagline}</p>
        <p className="text-[13px] text-muted mt-6">Full simulator — coming in the next build stage.</p>
      </div>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style:{fontSize:'13px',fontFamily:'Inter,sans-serif',border:'1px solid #f0f0f0',borderRadius:'10px'}
        }}/>
        <Routes>
          <Route path="/"          element={<Landing />} />
          <Route path="/login"     element={<Login />} />
          <Route path="/register"  element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/about"     element={<About />} />
          <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
          {/* ── 3 fully built simulators ── */}
          <Route path="/simulator/distillation"    element={<DistillationPage />} />
          <Route path="/simulator/heat-exchanger"  element={<HXPage />} />
          <Route path="/simulator/reactor"         element={<ReactorPage />} />
          {/* ── Coming soon ── */}
          <Route path="/simulator/pressure-vessel" element={<ComingSoon id="pressure-vessel" />} />
          <Route path="/simulator/mixer"           element={<ComingSoon id="mixer" />} />
          <Route path="/simulator/storage-tank"    element={<ComingSoon id="storage-tank" />} />
          <Route path="/simulator/piping"          element={<ComingSoon id="piping" />} />
          <Route path="/simulator/separations"     element={<ComingSoon id="separations" />} />
          <Route path="/simulator/meb"             element={<ComingSoon id="meb" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
