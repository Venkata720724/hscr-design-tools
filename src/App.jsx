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
import Textbooks  from './pages/Textbooks'
import DistillationPage   from './simulators/distillation/Page'
import HXPage             from './simulators/heat-exchanger/Page'
import ReactorPage        from './simulators/reactor/Page'
import PressureVesselPage from './simulators/pressure-vessel/Page'
import MixerPage          from './simulators/mixer/Page'
import StorageTankPage    from './simulators/storage-tank/Page'
import PipingPage         from './simulators/piping/Page'
import SeparationsPage    from './simulators/separations/Page'
import MEBPage            from './simulators/meb/Page'
import Nav    from './components/Nav'
import Footer from './components/Footer'
import { SIMULATORS } from './lib/simulators'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style:{fontSize:'13px',fontFamily:'Inter,sans-serif',border:'1px solid #f0f0f0',borderRadius:'10px'}
        }}/>
        <Routes>
          {/* Public pages */}
          <Route path="/"           element={<Landing />} />
          <Route path="/login"      element={<Login />} />
          <Route path="/register"   element={<Register />} />
          <Route path="/about"      element={<About />} />
          <Route path="/textbooks"  element={<Textbooks />} />

          {/* Protected — require sign-in */}
          <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/history"    element={<ProtectedRoute><History /></ProtectedRoute>} />

          {/* Simulators — all protected */}
          <Route path="/simulator/distillation"    element={<ProtectedRoute><DistillationPage /></ProtectedRoute>} />
          <Route path="/simulator/heat-exchanger"  element={<ProtectedRoute><HXPage /></ProtectedRoute>} />
          <Route path="/simulator/reactor"         element={<ProtectedRoute><ReactorPage /></ProtectedRoute>} />
          <Route path="/simulator/pressure-vessel" element={<ProtectedRoute><PressureVesselPage /></ProtectedRoute>} />
          <Route path="/simulator/mixer"           element={<ProtectedRoute><MixerPage /></ProtectedRoute>} />
          <Route path="/simulator/storage-tank"    element={<ProtectedRoute><StorageTankPage /></ProtectedRoute>} />
          <Route path="/simulator/piping"          element={<ProtectedRoute><PipingPage /></ProtectedRoute>} />
          <Route path="/simulator/separations"     element={<ProtectedRoute><SeparationsPage /></ProtectedRoute>} />
          <Route path="/simulator/meb"             element={<ProtectedRoute><MEBPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
