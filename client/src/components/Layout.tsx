import { Outlet } from "react-router-dom";
import { logout } from "../api";
import NavLink from "./NavLink";

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-56 border-r border-white/10 flex flex-col">
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <span className="text-2xl" aria-hidden>🛡️</span>
          <span className="font-semibold text-primary tracking-wider">AEGIS VANGUARD</span>
        </div>
        <nav className="p-2 flex flex-col gap-1 flex-1">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/scan">New Scan</NavLink>
          <NavLink to="/history">Scan History</NavLink>
          <NavLink to="/leads">Lead CRM</NavLink>
        </nav>
        <div className="p-2 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full px-3 py-2 rounded-md text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors text-left"
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
