import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import axios from 'axios';
import { Play, Save, AlertCircle, GitCompare, Calendar, RefreshCw, Globe, Sigma } from 'lucide-react';

export default function Simulator() {
  const [inputs, setInputs] = useState({ tariff: 5.5, global_price: 800, production_gap: 7500, import_volume: 8000 });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [projectionYears, setProjectionYears] = useState(1);
  const [compareMode, setCompareMode] = useState(false);
  const [compareInputs, setCompareInputs] = useState({ tariff: 15, global_price: 800, production_gap: 7500, import_volume: 8000 });
  const [compareResults, setCompareResults] = useState(null);
  const [autoFillStatus, setAutoFillStatus] = useState({ loading: false, loaded: false, sourceYear: null });

  useEffect(() => {
    hydrateInputsFromLatestData();
  }, []);

  const hydrateInputsFromLatestData = async () => {
    setAutoFillStatus((current) => ({ ...current, loading: true }));

    try {
      const response = await axios.get('http://localhost:5000/api/dashboard');
      const latest = response.data?.historicalData?.[response.data.historicalData.length - 1];

      if (!latest) {
        return;
      }

      const autoInputs = deriveScenarioInputs(latest);

      setInputs((current) => ({ ...current, ...autoInputs }));
      setCompareInputs((current) => ({ ...current, ...autoInputs }));
      setAutoFillStatus({ loading: false, loaded: true, sourceYear: latest.year });
    } catch (error) {
      console.error('Failed to auto-fill scenario inputs', error);
      setAutoFillStatus({ loading: false, loaded: false, sourceYear: null });
    }
  };

  const handleSimulate = async () => {
    setLoading(true);
    setSaved(false);
    try {
      const response = await axios.post('http://localhost:5000/api/simulate', inputs);
      setResults(response.data);

      if (compareMode) {
        const compareRes = await axios.post('http://localhost:5000/api/simulate', compareInputs);
        setCompareResults(compareRes.data);
      } else {
        setCompareResults(null);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!results) return;
    try {
      await axios.post('http://localhost:5000/api/save-scenario', {
        scenarioName: `Scenario - Tariff ${inputs.tariff}%`,
        inputs,
        outputs: results
      });
      setSaved(true);
    } catch (error) {
      console.error(error);
    }
  };

  const chartData = results ? [
    { name: 'Farmer Income', Before: 0, After: results.farmer_income_change },
    { name: 'Consumer Price', Before: 0, After: results.consumer_price_change },
  ] : [];

  const projectionData = results ? Array.from({ length: projectionYears }, (_, i) => ({
    year: `Year ${i + 1}`,
    farmer_income: parseFloat((results.farmer_income_change * (1 + i * 0.15)).toFixed(2)),
    consumer_price: parseFloat((results.consumer_price_change * (1 + i * 0.08)).toFixed(2)),
    import_dep: parseFloat(Math.max(5, results.import_dependency - i * 1.5).toFixed(2)),
  })) : [];

  const radarData = results ? [
    { metric: 'Farmer Income', A: Math.min(100, Math.max(0, results.farmer_income_change * 3)), fullMark: 100 },
    { metric: 'Consumer Relief', A: Math.min(100, Math.max(0, 100 - results.consumer_price_change * 3)), fullMark: 100 },
    { metric: 'Self-Reliance', A: Math.min(100, Math.max(0, 100 - results.import_dependency)), fullMark: 100 },
    { metric: 'Price Stability', A: Math.min(100, Math.max(0, 80 - results.consumer_price_change * 2)), fullMark: 100 },
    { metric: 'Policy Balance', A: Math.min(100, Math.max(0, results.farmer_income_change * 2.5 + (100 - results.import_dependency) * 0.3)), fullMark: 100 },
  ] : [];

  const compareChartData = results && compareResults ? [
    { metric: 'Farmer Inc %', 'Scenario A': results.farmer_income_change, 'Scenario B': compareResults.farmer_income_change },
    { metric: 'Consumer Prc %', 'Scenario A': results.consumer_price_change, 'Scenario B': compareResults.consumer_price_change },
    { metric: 'Import Dep %', 'Scenario A': results.import_dependency / 2, 'Scenario B': compareResults.import_dependency / 2 },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-extrabold text-gray-900">Policy Simulation Engine</h2>
        <p className="text-gray-500 mt-2">Transparent rule-based scenario analysis using explicit tariff and price equations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Simulation Levers</h3>
              <span className="text-xs font-medium text-gray-400">Scenario A</span>
            </div>
            <SliderInputs
              inputs={inputs}
              setInputs={setInputs}
              autoFillStatus={autoFillStatus}
              onAutoFill={hydrateInputsFromLatestData}
            />

            <div className="mt-5 pt-4 border-t border-gray-100">
              <label className="flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                <span className="flex items-center"><Calendar size={16} className="mr-1.5" />Multi-Year Projection</span>
                <span className="font-bold text-gov-green">{projectionYears} yr</span>
              </label>
              <input type="range" min="1" max="5" step="1" value={projectionYears} onChange={(e) => setProjectionYears(parseInt(e.target.value))} className="w-full accent-gov-green" />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1</span><span>3</span><span>5</span></div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" checked={compareMode} onChange={(e) => setCompareMode(e.target.checked)} className="accent-gov-green w-4 h-4" />
                <GitCompare size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Compare Scenarios</span>
              </label>
            </div>

            <button onClick={handleSimulate} disabled={loading} className="mt-6 w-full py-3 bg-gov-green hover:bg-emerald-800 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 transform hover:-translate-y-0.5">
              {loading ? <span className="animate-pulse">Computing...</span> : <><Play size={20} /><span>Execute Simulation</span></>}
            </button>
          </div>

          {compareMode && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 border-l-4 border-l-blue-500">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center"><GitCompare size={18} className="mr-2 text-blue-500" /> Scenario B</h3>
              <SliderInputs
                inputs={compareInputs}
                setInputs={setCompareInputs}
                accent="blue"
                autoFillStatus={autoFillStatus}
                onAutoFill={hydrateInputsFromLatestData}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          {results ? (
            <div className="space-y-6 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Sigma size={16} className="text-gov-green" />
                  <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-1 rounded-full uppercase tracking-wider">{results.model_type || 'rule-based'} engine</span>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-green-900">Method</p>
                <p className="text-sm text-green-800 mt-1">{results.method}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResultCard title="Farmer Income" value={`${results.farmer_income_change > 0 ? '+' : ''}${results.farmer_income_change}%`} color="text-green-600" compare={compareResults?.farmer_income_change} />
                <ResultCard title="Consumer Price Shift" value={`${results.consumer_price_change > 0 ? '+' : ''}${results.consumer_price_change}%`} color="text-red-600" compare={compareResults?.consumer_price_change} />
                <ResultCard title="Import Dependency" value={`${results.import_dependency}%`} color="text-gov-gold" compare={compareResults?.import_dependency} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">Impact Analysis</h3>
                    <button onClick={handleSave} className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"><Save size={14} /><span>{saved ? 'Saved!' : 'Save'}</span></button>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Before" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="After" fill="#1B5E20" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Multi-Dimensional Impact</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                        <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: '#6B7280' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="Score" dataKey="A" stroke="#0B6623" fill="#0B662366" strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {projectionYears > 1 && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{projectionYears}-Year Rule-Based Projection</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projectionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="farmer_income" name="Farmer Inc %" fill="#1B5E20" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="consumer_price" name="Consumer Prc %" fill="#E53935" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="import_dep" name="Import Dep %" fill="#1E88E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {compareMode && compareResults && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Scenario A vs B Comparison</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={compareChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="metric" />
                        <YAxis />
                        <Tooltip contentStyle={{ borderRadius: '8px' }} />
                        <Legend />
                        <Bar dataKey="Scenario A" fill="#1B5E20" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Scenario B" fill="#1E88E5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full bg-white/50 border border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-12 text-center text-gray-500 min-h-[400px]">
              <AlertCircle size={48} className="mb-4 text-gray-300" />
              <p className="text-lg font-medium">No active simulation.</p>
              <p className="text-sm mt-1 max-w-sm">Adjust the levers on the left and execute the rule-based simulation engine to generate scenario outputs.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function deriveScenarioInputs(latest) {
  const latestImportVolume = Number((latest.import_volume_tonnes / 1000).toFixed(1));
  const derivedProductionGap = Number((Math.max(latest.import_volume_tonnes - latest.domestic_production_tonnes, 0) / 1000).toFixed(1));

  return {
    production_gap: derivedProductionGap,
    import_volume: latestImportVolume
  };
}

function SliderInputs({ inputs, setInputs, accent = 'gov-green', autoFillStatus, onAutoFill }) {
  const accentClass = accent === 'blue' ? 'accent-blue-600' : 'accent-gov-green';
  const focusClass = accent === 'blue' ? 'focus:ring-blue-500' : 'focus:ring-gov-green';
  const textClass = accent === 'blue' ? 'text-blue-600' : 'text-gov-green';
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [priceStatus, setPriceStatus] = useState(null);

  const fetchLivePrice = async () => {
    setFetchingPrice(true);
    try {
      const response = await axios.get('http://localhost:5000/api/live-cpo-price');
      if (response.data && response.data.price) {
        setInputs({ ...inputs, global_price: response.data.price });
        setPriceStatus({
          source: response.data.source || 'Daily market price',
          marketDate: response.data.market_date || null,
          live: Boolean(response.data.live)
        });
      }
    } catch (error) {
      console.error('Failed to fetch live price', error);
      setPriceStatus({
        source: 'Unable to fetch daily price',
        marketDate: null,
        live: false
      });
    } finally {
      setFetchingPrice(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-700 mb-1"><span>Customs Duty (Tariff)</span><span className={`font-bold ${textClass}`}>{inputs.tariff}%</span></label>
        <input type="range" min="0" max="50" step="0.5" value={inputs.tariff} onChange={(e) => setInputs({ ...inputs, tariff: parseFloat(e.target.value) })} className={`w-full ${accentClass}`} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Global CPO Price ($/Ton)</label>
          <button onClick={fetchLivePrice} disabled={fetchingPrice} className={`flex items-center space-x-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-semibold transition-colors ${fetchingPrice ? 'text-gray-400' : 'text-blue-600'}`} title="Fetch latest available daily palm oil market price">
            {fetchingPrice ? <RefreshCw size={12} className="animate-spin" /> : <Globe size={12} />}
            <span>{fetchingPrice ? 'Syncing...' : 'Daily Price'}</span>
          </button>
        </div>
        <input type="number" value={inputs.global_price} onChange={(e) => setInputs({ ...inputs, global_price: parseFloat(e.target.value) })} className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 ${focusClass} focus:border-transparent outline-none`} />
        {priceStatus && (
          <p className="mt-1 text-xs text-gray-500">
            {priceStatus.source}
            {priceStatus.marketDate ? ` • ${priceStatus.marketDate}` : ''}
            {priceStatus.live ? ' • daily market feed' : ' • fallback'}
          </p>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Auto-fill</p>
            <p className="text-xs text-gray-600">
              {autoFillStatus?.loaded && autoFillStatus?.sourceYear
                ? `Using latest dashboard data from ${autoFillStatus.sourceYear}.`
                : 'Pull latest import and production values from the dashboard dataset.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onAutoFill}
            disabled={autoFillStatus?.loading}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              autoFillStatus?.loading ? 'bg-gray-200 text-gray-400' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {autoFillStatus?.loading ? 'Syncing...' : 'Use Latest Data'}
          </button>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Production Gap ('000 Tonnes)</label>
        <input type="number" value={inputs.production_gap} onChange={(e) => setInputs({ ...inputs, production_gap: parseFloat(e.target.value) })} className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 ${focusClass} focus:border-transparent outline-none`} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Planned Import Volume ('000 Tonnes)</label>
        <input type="number" value={inputs.import_volume} onChange={(e) => setInputs({ ...inputs, import_volume: parseFloat(e.target.value) })} className={`w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 ${focusClass} focus:border-transparent outline-none`} />
      </div>
    </div>
  );
}

function ResultCard({ title, value, color, compare }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-gov-green">
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className={`text-3xl font-black ${color}`}>{value}</p>
      {compare !== undefined && <p className="text-xs text-blue-500 mt-1 font-medium">vs B: {compare > 0 ? '+' : ''}{compare}%</p>}
    </div>
  );
}
