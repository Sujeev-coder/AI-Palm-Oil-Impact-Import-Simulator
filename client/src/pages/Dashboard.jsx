import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts';
import axios from 'axios';
import { Package, TrendingUp, DollarSign, Activity, Leaf, MapPin, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const COLORS = ['#1B5E20', '#C9A227', '#E53935', '#1E88E5'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get('http://localhost:5000/api/dashboard');
        setData(response.data);
      } catch (error) {
        console.error('Dashboard data fetch error', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading || !data) return <div className="p-10 text-center text-xl animate-pulse text-gov-green font-bold">Loading Metrics...</div>;

  const { historicalData, kpis, nmeoOp, sources } = data;

  const pieData = [
    { name: 'Imported', value: kpis.total_import_volume },
    { name: 'Domestic', value: kpis.domestic_production }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h2 className="text-3xl font-extrabold text-gray-900">National Palm Oil Dashboard</h2>
        <p className="text-gray-500 mt-1">Source-backed trade, production, and area trends for India</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={`Import Volume (${kpis.latest_year})`} value={formatTonnes(kpis.total_import_volume)} icon={<Package size={22} className="text-blue-600" />} yoy={kpis.yoy_import} />
        <KpiCard title="Domestic Production" value={formatTonnes(kpis.domestic_production)} icon={<TrendingUp size={22} className="text-gov-gold" />} yoy={kpis.yoy_production} />
        <KpiCard title="Import Value" value={`$${kpis.import_value_usd_million.toFixed(1)}M`} icon={<DollarSign size={22} className="text-gov-green" />} yoy={kpis.yoy_import_value} />
        <KpiCard title="Avg Import Price" value={`$${kpis.avg_import_price_usd_per_tonne}/T`} icon={<Activity size={22} className="text-red-500" />} yoy={kpis.yoy_price} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Self-Reliance" value={`${kpis.self_reliance}%`} icon={<Target size={22} className="text-emerald-600" />} />
        <KpiCard title="Import Dependency" value={`${(100 - kpis.self_reliance).toFixed(1)}%`} icon={<ArrowDownRight size={22} className="text-amber-600" />} />
        <KpiCard title="Cultivated Area" value={formatHectares(kpis.cultivation_area)} icon={<Leaf size={22} className="text-green-600" />} yoy={kpis.yoy_cultivation} />
        <KpiCard title="Latest Data Year" value={kpis.latest_year} icon={<MapPin size={22} className="text-teal-600" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Historical Import vs Domestic Production">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="import_volume_tonnes" name="Imports (T)" fill="#1E88E5" radius={[4, 4, 0, 0]} />
              <Bar dataKey="domestic_production_tonnes" name="Domestic Production (T)" fill="#C9A227" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Import Dependency & Self-Reliance Trend">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="import_dependency" name="Import Dependency %" stroke="#E53935" fill="#E5393533" strokeWidth={2} />
              <Area type="monotone" dataKey="self_reliance" name="Self-Reliance %" stroke="#1B5E20" fill="#1B5E2033" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Import Value & Average Import Price">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis yAxisId="left" label={{ value: 'Import Value ($M)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Avg Price $/T', angle: 90, position: 'insideRight' }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Bar yAxisId="left" dataKey="import_value_usd_million" name="Import Value ($M)" fill="#0B6623" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="avg_import_price_usd_per_tonne" name="Avg Import Price ($/T)" stroke="#E53935" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Cultivated Area & Domestic Production">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="year" />
              <YAxis yAxisId="left" label={{ value: 'Area (ha)', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: 'Production (T)', angle: 90, position: 'insideRight' }} />
              <Tooltip contentStyle={{ borderRadius: '8px' }} />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="cultivated_area_ha" name="Cultivated Area (ha)" fill="#4CAF5033" stroke="#4CAF50" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="domestic_production_tonnes" name="Domestic Production (T)" stroke="#C9A227" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-around">
          <div className="text-center md:text-left mb-6 md:mb-0">
            <h3 className="text-xl font-bold text-gray-800">Current Market Dependency</h3>
            <p className="text-gray-500 mt-2 max-w-xs text-sm">Proportion of total availability sourced from imports versus domestic production.</p>
          </div>
          <div className="h-64 w-full md:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={5} dataKey="value" label>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {nmeoOp && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">NMEO-OP Progress</h3>
                <p className="text-xs text-gray-500">{nmeoOp.mission_name} (Launched {nmeoOp.launched})</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Target: {nmeoOp.target_year}</span>
            </div>

            <div className="space-y-4">
              <ProgressItem
                label="Area Under Plantation"
                actual={nmeoOp.actuals_2024.area_planted_lakh_ha}
                target={nmeoOp.targets.area_plantation_lakh_ha}
                unit="Lakh Ha"
                progress={nmeoOp.actuals_2024.area_progress_pct}
              />
              <ProgressItem
                label="CPO Production"
                actual={nmeoOp.actuals_2024.cpo_production_lakh_mt}
                target={nmeoOp.targets.cpo_production_lakh_mt}
                unit="Lakh MT"
                progress={nmeoOp.actuals_2024.production_progress_pct}
              />
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center"><MapPin size={14} className="mr-1" /> Focus Regions</p>
              <div className="flex flex-wrap gap-1.5">
                {nmeoOp.focus_states.map((state) => (
                  <span key={state} className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">{state}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {sources?.historicalData && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Data Sources</h3>
          <p className="text-sm text-gray-500 mb-4">Each dashboard metric below is tied to a cited source or a transparent derived formula.</p>
          <div className="space-y-3">
            {sources.historicalData.map((item) => (
              <div key={item.field} className="text-sm">
                <p className="font-semibold text-gray-800">{item.field}</p>
                <p className="text-gray-600">{item.source}</p>
                {item.notes && <p className="text-gray-500">{item.notes}</p>}
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-gov-green font-medium hover:underline">
                    Open source
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTonnes(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M T`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K T`;
  return `${value} T`;
}

function formatHectares(value) {
  if (value >= 100000) return `${(value / 100000).toFixed(2)} Lakh ha`;
  return `${value.toLocaleString()} ha`;
}

function KpiCard({ title, value, icon, yoy }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">{icon}</div>
        {yoy !== undefined && (
          <span className={`text-xs font-bold flex items-center ${yoy >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {yoy >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {Math.abs(yoy)}% YoY
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-1">{title}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-gray-800 mb-4">{title}</h3>
      <div className="h-72">{children}</div>
    </div>
  );
}

function ProgressItem({ label, actual, target, unit, progress }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{actual} / {target} {unit}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(progress, 100)}%`,
            background: progress >= 75 ? '#16A34A' : progress >= 40 ? '#CA8A04' : '#DC2626'
          }}
        />
      </div>
      <p className="text-xs text-gray-500 mt-0.5 text-right">{progress}% achieved</p>
    </div>
  );
}
