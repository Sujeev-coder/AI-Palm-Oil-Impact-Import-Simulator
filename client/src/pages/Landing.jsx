import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, TrendingUp, BarChart2, ShieldCheck, Leaf, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function Landing() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await axios.get('http://localhost:5000/api/dashboard');
        setStats(res.data.kpis);
      } catch (e) { /* silent */ }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-[calc(100vh-140px)] bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-gov-green/10 blur-3xl"></div>
      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-gov-gold/20 blur-3xl"></div>

      <div className="flex-grow flex items-center justify-center relative z-10 px-4 py-12">
        <div className="max-w-5xl w-full">
          <div className="glass p-10 md:p-12 rounded-3xl text-center space-y-6 animate-fade-in-up">
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-green-100 text-gov-green font-semibold text-sm">
              
            </div>

            <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
              Policy <span className="text-transparent bg-clip-text bg-gradient-to-r from-gov-green to-emerald-600">Import Impact</span> Simulator
              <br /> for Palm Oil Tariffs
            </h1>

            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Run transparent tariff scenarios while grounding the dashboard and forecast tools in cited public datasets
              for imports, domestic production, cultivated area, and import value trends.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/simulator" className="px-8 py-4 bg-gov-green hover:bg-emerald-800 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all inline-flex items-center space-x-2 transform hover:-translate-y-1">
                <Activity size={22} />
                <span>Start Simulation Engine</span>
              </Link>
              <Link to="/dashboard" className="px-6 py-4 bg-white/70 hover:bg-white text-gov-green rounded-xl font-bold text-base shadow-sm hover:shadow-md transition-all inline-flex items-center space-x-2 border border-gov-green/20">
                <BarChart2 size={20} />
                <span>View Dashboard</span>
              </Link>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <StatBadge label="Import Volume" value={`${(stats.total_import_volume / 1000000).toFixed(2)}M T`} />
              <StatBadge label="Domestic Prod." value={`${(stats.domestic_production / 1000).toFixed(0)}K T`} />
              <StatBadge label="Self-Reliance" value={`${stats.self_reliance}%`} />
              <StatBadge label="Avg Import Price" value={`$${stats.avg_import_price_usd_per_tonne}/T`} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10">
            <FeatureCard icon={<TrendingUp size={26} className="text-gov-green" />} title="Production Trends" desc="Track domestic palm oil production against rising import demand with sourced annual data." />
            <FeatureCard icon={<Activity size={26} className="text-blue-600" />} title="Trade Value" desc="Review import value and average import price using World Bank WITS trade records." />
            <FeatureCard icon={<BarChart2 size={26} className="text-gov-gold" />} title="Dependency Ratio" desc="Measure import dependency and self-reliance from cited public datasets." />
          </div>

          <div className="mt-12 glass p-8 rounded-3xl animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gov-green/10 flex items-center justify-center">
                <Leaf size={28} className="text-gov-green" />
              </div>
              <div className="flex-grow">
                <h3 className="text-xl font-bold text-gray-900 mb-2">National Mission on Edible Oils - Oil Palm (NMEO-OP)</h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  The dashboard pairs the simulator with externally sourced historical data and uses NMEO-OP target values
                  from official government material so the visuals are easier to defend during academic review.
                </p>
              </div>
              <Link to="/dashboard" className="flex-shrink-0 flex items-center space-x-1 text-gov-green font-semibold text-sm hover:text-emerald-800 transition-colors whitespace-nowrap">
                <span>Track Progress</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value }) {
  return (
    <div className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/30 shadow-sm text-center">
      <p className="text-lg font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm">{desc}</p>
    </div>
  );
}
