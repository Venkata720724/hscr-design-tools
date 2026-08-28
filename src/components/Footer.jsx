import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-[#d4d8de] mt-16">
      <div className="max-w-[1500px] mx-auto px-10 py-10">
        <div className="grid grid-cols-4 gap-8 mb-8">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
                <span className="text-[9px] font-black text-[#374151] tracking-tighter">HSCR</span>
              </div>
              <span className="text-[13px] font-semibold text-[#0f172a]">HSCR Design Tools</span>
            </div>
            <p className="text-[12px] text-[#374151] leading-relaxed">
              Professional chemical engineering simulators for process design and equipment sizing.
            </p>
            <p className="text-[11.5px] text-[#4b5563] mt-3">
              Hyderabad, Telangana, India
            </p>
          </div>

          {/* Simulators col 1 */}
          <div>
            <p className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider mb-3">Simulators</p>
            {['distillation','heat-exchanger','reactor','pressure-vessel','mixer'].map(id => (
              <Link key={id} to={`/simulator/${id}`}
                className="block text-[12.5px] text-[#374151] hover:text-[#0f172a] no-underline mb-1.5 transition-colors capitalize">
                {id.replace(/-/g,' ')}
              </Link>
            ))}
          </div>

          {/* Simulators col 2 */}
          <div>
            <p className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider mb-3">More simulators</p>
            {['storage-tank','piping','separations','meb'].map(id => (
              <Link key={id} to={`/simulator/${id}`}
                className="block text-[12.5px] text-[#374151] hover:text-[#0f172a] no-underline mb-1.5 transition-colors capitalize">
                {id.replace(/-/g,' ')}
              </Link>
            ))}
            <Link to="/textbooks"
              className="block text-[12.5px] text-[#374151] hover:text-[#0f172a] no-underline mt-3 transition-colors">
              Textbooks
            </Link>
          </div>

          {/* Contact */}
          <div>
            <p className="text-[11px] font-bold text-[#0f172a] uppercase tracking-wider mb-3">Contact</p>
            <p className="text-[12.5px] text-[#374151] mb-1.5">hscr_groups@gmail.com</p>
            <p className="text-[12.5px] text-[#374151] mb-1.5">Hyderabad, Telangana</p>
            <p className="text-[12.5px] text-[#374151]">India</p>
            <Link to="/about"
              className="block text-[12.5px] text-[#0f172a] font-medium hover:underline no-underline mt-3 transition-colors">
              About HSCR Group →
            </Link>
          </div>
        </div>

        <div className="border-t border-[#b8bcc4] pt-5 flex items-center justify-between">
          <p className="text-[11.5px] text-[#4b5563]">
            © {new Date().getFullYear()} HSCR Group. All rights reserved.
          </p>
          <p className="text-[11.5px] text-[#4b5563]">
            Results are for engineering guidance only. Verify all designs independently.
          </p>
        </div>
      </div>
    </footer>
  )
}
