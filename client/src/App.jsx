import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Landing from './pages/Landing';
import Simulator from './pages/Simulator';
import Dashboard from './pages/Dashboard';
import Insights from './pages/Insights';
import { Menu, X } from 'lucide-react';

function NavLink({ to, children, onClick }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`font-semibold transition-colors ${active ? 'text-gov-gold' : 'hover:text-gov-gold'}`}
    >
      {children}
    </Link>
  );
}

function AppContent() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navigation Bar */}
      <header className="bg-gov-green text-white shadow-md z-50 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gov-gold flex items-center justify-center font-bold text-gov-green shadow-sm text-sm">
              GOI
            </div>
            <div>
              <h1 className="text-lg font-bold font-serif leading-tight">Ministry of Agriculture</h1>
              <p className="text-xs text-gov-gold font-medium">Palm Oil Import Impact Simulator</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex space-x-6">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/simulator">Simulator</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>
            <NavLink to="/insights">Insights</NavLink>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/20 animate-fade-in-up">
            <nav className="flex flex-col px-4 py-3 space-y-3">
              <NavLink to="/" onClick={() => setMobileOpen(false)}>Home</NavLink>
              <NavLink to="/simulator" onClick={() => setMobileOpen(false)}>Simulator</NavLink>
              <NavLink to="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</NavLink>
              <NavLink to="/insights" onClick={() => setMobileOpen(false)}>Insights</NavLink>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/insights" element={<Insights />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-400 py-6 text-center mt-auto text-sm">
        <p>© 2026 Ministry of Agriculture & Farmers Welfare, Govt of India.</p>
        <p className="text-xs text-gray-500 mt-1">Powered by XGBoost AI • NMEO-OP Framework</p>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
