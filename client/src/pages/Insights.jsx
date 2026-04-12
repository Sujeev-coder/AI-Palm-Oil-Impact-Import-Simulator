import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, Info, CheckCircle2, Search, Loader2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';

export default function Insights() {
  const [scenarios, setScenarios] = useState([]);
  const [optimalData, setOptimalData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loadingOptimal, setLoadingOptimal] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [maxPriceThreshold, setMaxPriceThreshold] = useState(8.0);
  const [forecastYears, setForecastYears] = useState(3);

  useEffect(() => {
    async function fetchScenarios() {
      try {
        const response = await axios.get('http://localhost:5000/api/scenarios');
        setScenarios(response.data);
      } catch (error) {
        console.error('Error fetching scenarios', error);
      }
    }
    fetchScenarios();
  }, []);

  const findOptimalTariff = async () => {
    setLoadingOptimal(true);
    try {
      const response = await axios.post('http://localhost:5000/api/optimal-tariff', {
        global_price: 800,
        production_gap: 7500,
        import_volume: 8000,
        max_consumer_price_rise: maxPriceThreshold
      });
      setOptimalData(response.data);
    } catch (error) {
      console.error('Error finding optimal tariff', error);
    } finally {
      setLoadingOptimal(false);
    }
  };

  const runForecast = async () => {
    setLoadingForecast(true);
    try {
      const response = await axios.post('http://localhost:5000/api/forecast', { years_ahead: forecastYears });
      setForecastData(response.data);
    } catch (error) {
      console.error('Error running forecast', error);
    } finally {
      setLoadingForecast(false);
    }
  };

  const displayScenarios = scenarios.length > 0 ? scenarios : [
    { scenarioName: 'Low Tariff', inputs: { tariff: 2.0, global_price: 800, production_gap: 7500, import_volume: 8000 }, outputs: { farmer_income_change: 1.6, consumer_price_change: 1.0, import_dependency: 51.2 }, timestamp: '2026-03-20T10:30:00Z' },
    { scenarioName: 'Current Policy', inputs: { tariff: 5.5, global_price: 800, production_gap: 7500, import_volume: 8000 }, outputs: { farmer_income_change: 4.4, consumer_price_change: 2.75, import_dependency: 50.8 }, timestamp: '2026-03-25T14:15:00Z' },
    { scenarioName: 'Protectionist', inputs: { tariff: 12.0, global_price: 800, production_gap: 7500, import_volume: 8000 }, outputs: { farmer_income_change: 9.6, consumer_price_change: 6.0, import_dependency: 49.3 }, timestamp: '2026-04-01T09:00:00Z' },
  ];

  const compareData = displayScenarios.map((scenario) => ({
    name: scenario.scenarioName || `T-${scenario.inputs.tariff}%`,
    'Farmer Income': scenario.outputs.farmer_income_change,
    'Consumer Price': scenario.outputs.consumer_price_change,
    'Import Dep': scenario.outputs.import_dependency / 10,
  }));

  const dynamicInsights = generateDynamicInsights(displayScenarios, optimalData, forecastData);
  const sweepChart = optimalData?.sweep_results?.filter((_, i) => i % 2 === 0) || [];
  const forecastChartData = (forecastData?.forecast || []).map((row) => ({
    ...row,
    import_volume_lower: row.import_volume_interval?.lower ?? row.import_volume_tonnes,
    import_volume_upper: row.import_volume_interval?.upper ?? row.import_volume_tonnes,
    domestic_production_lower: row.domestic_production_interval?.lower ?? row.domestic_production_tonnes,
    domestic_production_upper: row.domestic_production_interval?.upper ?? row.domestic_production_tonnes,
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">Policy Insights Engine</h2>
        <p className="text-gray-500 mt-2">Rule-based tariff insights plus real-data forecasts trained on the sourced dashboard dataset.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {dynamicInsights.map((insight, i) => (
            <InsightCard key={i} type={insight.type} title={insight.title} desc={insight.desc} />
          ))}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <Search size={20} className="text-gov-green" />
              <h4 className="font-bold text-gray-900">Optimal Tariff Finder</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">Rule-based sweep: find the tariff that maximizes farmer income while keeping consumer price rise under your threshold.</p>
            <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Max Consumer Price Rise</span>
              <span className="font-bold text-red-500">{maxPriceThreshold}%</span>
            </label>
            <input type="range" min="2" max="20" step="0.5" value={maxPriceThreshold} onChange={(e) => setMaxPriceThreshold(parseFloat(e.target.value))} className="w-full accent-gov-green mb-3" />
            <button onClick={findOptimalTariff} disabled={loadingOptimal} className="w-full py-2.5 bg-gov-green hover:bg-emerald-800 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2">
              {loadingOptimal ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              <span>{loadingOptimal ? 'Computing...' : 'Find Optimal Tariff'}</span>
            </button>

            {optimalData && (
              <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs font-semibold text-green-700 mb-2">Transparent Recommendation</p>
                <p className="text-2xl font-black text-green-800">{optimalData.optimal_tariff}%</p>
                <p className="text-xs text-green-600 mt-1">Farmer +{optimalData.farmer_income_change}% | Consumer +{optimalData.consumer_price_change}% | Dep: {optimalData.import_dependency}%</p>
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp size={20} className="text-blue-600" />
              <h4 className="font-bold text-gray-900">Real-Data Forecast</h4>
            </div>
            <p className="text-xs text-gray-500 mb-3">Forecast future import, value, production, and area trends from the sourced historical dataset.</p>
            <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
              <span>Forecast Horizon</span>
              <span className="font-bold text-blue-600">{forecastYears} year(s)</span>
            </label>
            <input type="range" min="1" max="5" step="1" value={forecastYears} onChange={(e) => setForecastYears(parseInt(e.target.value))} className="w-full accent-blue-600 mb-3" />
            <button onClick={runForecast} disabled={loadingForecast} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center space-x-2">
              {loadingForecast ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
              <span>{loadingForecast ? 'Forecasting...' : 'Run Forecast'}</span>
            </button>

            {forecastData && (
              <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs font-semibold text-blue-700 mb-1 uppercase tracking-wider">{forecastData.model_type}</p>
                <p className="text-sm text-blue-800">Trained on {forecastData.training_rows} real historical rows up to {forecastData.base_year}.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {forecastData?.forecast?.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Forecasted Import and Production Trend</h3>
              <p className="text-sm text-gray-500 mb-4">Shaded bands show forecast uncertainty around import and domestic production estimates.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Legend />
                    <Area type="monotone" dataKey="import_volume_upper" name="Imports Upper" stroke="none" fill="#90CAF9" fillOpacity={0.15} />
                    <Area type="monotone" dataKey="import_volume_lower" name="Imports Lower" stroke="none" fill="#FFFFFF" fillOpacity={1} />
                    <Area type="monotone" dataKey="domestic_production_upper" name="Production Upper" stroke="none" fill="#A5D6A7" fillOpacity={0.18} />
                    <Area type="monotone" dataKey="domestic_production_lower" name="Production Lower" stroke="none" fill="#FFFFFF" fillOpacity={1} />
                    <Line type="monotone" dataKey="import_volume_tonnes" name="Imports (T)" stroke="#1E88E5" strokeWidth={2} />
                    <Line type="monotone" dataKey="domestic_production_tonnes" name="Domestic Production (T)" stroke="#1B5E20" strokeWidth={2} />
                    <Line type="monotone" dataKey="cultivated_area_ha" name="Area (ha)" stroke="#C9A227" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {optimalData && sweepChart.length > 0 && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Tariff Sweep Analysis (0-50%)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sweepChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="tariff" label={{ value: 'Tariff %', position: 'insideBottom', offset: -5 }} />
                    <YAxis />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="farmer_income_change" name="Farmer Inc %" stroke="#1B5E20" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="consumer_price_change" name="Consumer Prc %" stroke="#E53935" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="import_dependency" name="Import Dep %" stroke="#1E88E5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Scenario Impact Comparison</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="Farmer Income" fill="#1B5E20" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Consumer Price" fill="#E53935" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Import Dep" fill="#1E88E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Saved Scenarios</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm whitespace-nowrap">
                <thead className="tracking-wider border-b border-gray-100 font-semibold text-gray-500 bg-gray-50 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Scenario</th>
                    <th className="px-4 py-3">Tariff</th>
                    <th className="px-4 py-3">CPO Price</th>
                    <th className="px-4 py-3 text-green-600">Farmer Delta</th>
                    <th className="px-4 py-3 text-red-600">Consumer Delta</th>
                    <th className="px-4 py-3 text-blue-600">Dep %</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700 font-medium">
                  {displayScenarios.slice(0, 8).map((sim, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{sim.scenarioName || `Scenario ${i + 1}`}</td>
                      <td className="px-4 py-3">{sim.inputs.tariff}%</td>
                      <td className="px-4 py-3">${sim.inputs.global_price}</td>
                      <td className="px-4 py-3 text-green-600">+{sim.outputs.farmer_income_change}%</td>
                      <td className="px-4 py-3 text-red-500">+{sim.outputs.consumer_price_change}%</td>
                      <td className="px-4 py-3">{sim.outputs.import_dependency}%</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{sim.timestamp ? new Date(sim.timestamp).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function generateDynamicInsights(scenarios, optimalData, forecastData) {
  const insights = [];

  if (forecastData?.forecast?.length) {
    const latest = forecastData.forecast[forecastData.forecast.length - 1];
    insights.push({
      type: 'info',
      title: `Forecast Through ${latest.year}`,
      desc: `The real-data forecast projects imports near ${Math.round(latest.import_volume_tonnes).toLocaleString()} tonnes and domestic production near ${Math.round(latest.domestic_production_tonnes).toLocaleString()} tonnes by ${latest.year}.`
    });
  }

  if (scenarios.length > 0) {
    const maxFarmer = scenarios.reduce((max, scenario) => scenario.outputs.farmer_income_change > max.outputs.farmer_income_change ? scenario : max, scenarios[0]);
    insights.push({
      type: 'positive',
      title: 'Best Farmer Outcome',
      desc: `A ${maxFarmer.inputs.tariff}% tariff yields the highest farmer income boost of +${maxFarmer.outputs.farmer_income_change}%.`
    });

    const highPriceScenarios = scenarios.filter((scenario) => scenario.outputs.consumer_price_change > 5);
    if (highPriceScenarios.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Inflationary Risk Detected',
        desc: `${highPriceScenarios.length} scenario(s) show consumer price increases above 5%, which may pressure food affordability.`
      });
    }

    const avgDep = scenarios.reduce((sum, scenario) => sum + scenario.outputs.import_dependency, 0) / scenarios.length;
    insights.push({
      type: 'info',
      title: 'Import Dependency Status',
      desc: `Average import dependency across saved scenarios is ${avgDep.toFixed(1)}%.`
    });
  }

  if (optimalData) {
    insights.unshift({
      type: 'positive',
      title: `Suggested Tariff: ${optimalData.optimal_tariff}%`,
      desc: `The rule-based sweep suggests ${optimalData.optimal_tariff}% as the highest farmer-supporting tariff that stays inside your consumer-price threshold.`
    });
  }

  if (insights.length === 0) {
    insights.push({ type: 'info', title: 'Run Analysis First', desc: 'Execute simulator scenarios or run the real-data forecast to populate insights here.' });
  }

  return insights;
}

function InsightCard({ type, title, desc }) {
  const Icon = type === 'positive' ? CheckCircle2 : type === 'warning' ? AlertTriangle : Info;
  const colorClass = type === 'positive' ? 'text-green-600 bg-green-50 border-green-200' : type === 'warning' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-blue-600 bg-blue-50 border-blue-200';

  return (
    <div className={`p-5 rounded-2xl border ${colorClass} shadow-sm`}>
      <div className="flex items-center space-x-2 mb-2">
        <Icon size={20} />
        <h4 className="font-bold text-base">{title}</h4>
      </div>
      <p className="text-gray-700/90 leading-relaxed font-medium text-sm">{desc}</p>
    </div>
  );
}
