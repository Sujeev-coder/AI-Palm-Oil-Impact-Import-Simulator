const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');
const Simulation = require('../models/Simulation');

const DEFAULT_DASHBOARD_DATASET_PATH = path.join(__dirname, '..', 'data', 'dashboardDataset.csv');
const DEFAULT_NMEO_OP_PATH = path.join(__dirname, '..', 'data', 'nmeoOp.json');
const DEFAULT_DASHBOARD_SOURCES_PATH = path.join(__dirname, '..', 'data', 'dashboardSources.json');
const DASHBOARD_REQUIRED_FIELDS = [
  'year',
  'import_volume_tonnes',
  'import_value_usd_million',
  'domestic_production_tonnes',
  'cultivated_area_ha'
];
const MPOC_DAILY_PRICE_URL = 'https://www.mpoc.org.my/market-insight/daily-palm-oil-prices/';

async function loadDashboardDataset() {
  const datasetPath = process.env.DASHBOARD_DATASET_PATH
    ? path.resolve(process.env.DASHBOARD_DATASET_PATH)
    : DEFAULT_DASHBOARD_DATASET_PATH;

  const rawDataset = await fs.readFile(datasetPath, 'utf8');
  const extension = path.extname(datasetPath).toLowerCase();
  const historicalData = extension === '.csv'
    ? parseCsvDataset(rawDataset)
    : parseJsonDataset(rawDataset);

  if (historicalData.length < 2) {
    throw new Error('Dashboard dataset must contain at least two historical data rows.');
  }

  const normalizedHistoricalData = historicalData
    .map((entry, index) => normalizeHistoricalEntry(entry, index))
    .sort((a, b) => a.year - b.year);

  return {
    historicalData: normalizedHistoricalData,
    nmeoOp: await loadNmeoOpData(),
    sources: await loadDashboardSources()
  };
}

function parseJsonDataset(rawDataset) {
  const parsedDataset = JSON.parse(rawDataset);
  return Array.isArray(parsedDataset.historicalData) ? parsedDataset.historicalData : [];
}

function parseCsvDataset(rawDataset) {
  const lines = rawDataset
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(',').map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    return headers.reduce((entry, header, index) => {
      entry[header] = values[index];
      return entry;
    }, {});
  });
}

async function loadNmeoOpData() {
  const metadataPath = process.env.NMEO_OP_DATA_PATH
    ? path.resolve(process.env.NMEO_OP_DATA_PATH)
    : DEFAULT_NMEO_OP_PATH;

  try {
    const rawMetadata = await fs.readFile(metadataPath, 'utf8');
    return JSON.parse(rawMetadata);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function loadDashboardSources() {
  try {
    const rawSources = await fs.readFile(DEFAULT_DASHBOARD_SOURCES_PATH, 'utf8');
    return JSON.parse(rawSources);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function normalizeHistoricalEntry(entry, index) {
  const normalizedEntry = {};

  for (const field of DASHBOARD_REQUIRED_FIELDS) {
    if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
      throw new Error(`Dashboard dataset row ${index + 1} is missing "${field}".`);
    }

    const value = Number(entry[field]);
    if (Number.isNaN(value)) {
      throw new Error(`Dashboard dataset row ${index + 1} has an invalid numeric value for "${field}".`);
    }

    normalizedEntry[field] = value;
  }

  return normalizedEntry;
}

function enrichHistoricalData(historicalData) {
  return historicalData.map((entry) => ({
    ...entry,
    avg_import_price_usd_per_tonne: parseFloat(((entry.import_value_usd_million * 1000000) / entry.import_volume_tonnes).toFixed(2)),
    import_dependency: parseFloat(((entry.import_volume_tonnes / (entry.import_volume_tonnes + entry.domestic_production_tonnes)) * 100).toFixed(1)),
    self_reliance: parseFloat(((entry.domestic_production_tonnes / (entry.import_volume_tonnes + entry.domestic_production_tonnes)) * 100).toFixed(1))
  }));
}

function buildKpis(enrichedData) {
  const latest = enrichedData[enrichedData.length - 1];
  const previous = enrichedData[enrichedData.length - 2];

  return {
    latest_year: latest.year,
    total_import_volume: latest.import_volume_tonnes,
    import_value_usd_million: latest.import_value_usd_million,
    domestic_production: latest.domestic_production_tonnes,
    avg_import_price_usd_per_tonne: latest.avg_import_price_usd_per_tonne,
    self_reliance: latest.self_reliance,
    cultivation_area: latest.cultivated_area_ha,
    yoy_import: parseFloat((((latest.import_volume_tonnes - previous.import_volume_tonnes) / previous.import_volume_tonnes) * 100).toFixed(1)),
    yoy_import_value: parseFloat((((latest.import_value_usd_million - previous.import_value_usd_million) / previous.import_value_usd_million) * 100).toFixed(1)),
    yoy_production: parseFloat((((latest.domestic_production_tonnes - previous.domestic_production_tonnes) / previous.domestic_production_tonnes) * 100).toFixed(1)),
    yoy_price: parseFloat((((latest.avg_import_price_usd_per_tonne - previous.avg_import_price_usd_per_tonne) / previous.avg_import_price_usd_per_tonne) * 100).toFixed(1)),
    yoy_cultivation: parseFloat((((latest.cultivated_area_ha - previous.cultivated_area_ha) / previous.cultivated_area_ha) * 100).toFixed(1))
  };
}

function calculateScenario(inputs) {
  const tariff = Number(inputs.tariff);
  const globalPrice = Number(inputs.global_price);
  const productionGap = Number(inputs.production_gap);
  const importVolume = Number(inputs.import_volume);

  const tariffIncomeEffect = tariff * 0.8;
  const tariffPriceEffect = tariff * 0.5;
  const tariffImportEffect = -tariff * 0.3;
  const globalIncomeEffect = (globalPrice - 800) * 0.01;
  const globalPriceEffect = (globalPrice - 800) * 0.02;
  const adjustedImports = Math.max(0, importVolume * (1 + tariffImportEffect / 100));
  const importDependency = (adjustedImports / (adjustedImports + productionGap + 1)) * 100;

  return {
    farmer_income_change: parseFloat((tariffIncomeEffect + globalIncomeEffect).toFixed(2)),
    consumer_price_change: parseFloat((tariffPriceEffect + globalPriceEffect).toFixed(2)),
    import_dependency: parseFloat(importDependency.toFixed(2)),
    model_type: 'rule-based',
    method: 'Weighted tariff and global-price equations with import response adjustment'
  };
}

function buildForecastFallback(historicalData, yearsAhead) {
  const years = historicalData.map((row) => row.year);
  const baseYear = years[years.length - 1];
  const clampedYearsAhead = Math.max(1, Math.min(5, Number(yearsAhead) || 3));
  const targets = ['import_volume_tonnes', 'import_value_usd_million', 'domestic_production_tonnes', 'cultivated_area_ha'];

  const regressions = Object.fromEntries(
    targets.map((target) => [target, fitLinearTrend(years, historicalData.map((row) => row[target]))])
  );

  const forecast = Array.from({ length: clampedYearsAhead }, (_, index) => {
    const year = baseYear + index + 1;
    const row = { year };

    for (const target of targets) {
      row[target] = Math.max(0, regressions[target].intercept + regressions[target].slope * year);
      row[target] = parseFloat(row[target].toFixed(2));
    }

    row.import_volume_interval = buildFallbackInterval(row.import_volume_tonnes, index + 1);
    row.import_value_interval = buildFallbackInterval(row.import_value_usd_million, index + 1);
    row.domestic_production_interval = buildFallbackInterval(row.domestic_production_tonnes, index + 1);
    row.cultivated_area_interval = buildFallbackInterval(row.cultivated_area_ha, index + 1);

    row.avg_import_price_usd_per_tonne = row.import_volume_tonnes
      ? parseFloat(((row.import_value_usd_million * 1000000) / row.import_volume_tonnes).toFixed(2))
      : 0;

    const totalSupply = row.import_volume_tonnes + row.domestic_production_tonnes;
    row.import_dependency = totalSupply ? parseFloat(((row.import_volume_tonnes / totalSupply) * 100).toFixed(2)) : 0;
    row.self_reliance = totalSupply ? parseFloat(((row.domestic_production_tonnes / totalSupply) * 100).toFixed(2)) : 0;

    return row;
  });

  return {
    model_type: 'trend-fallback',
    training_rows: historicalData.length,
    base_year: baseYear,
    interval_method: 'fallback-relative-band',
    selected_models: Object.fromEntries(targets.map((target) => [target, 'linear-fallback'])),
    best_pattern_fit_models: Object.fromEntries(targets.map((target) => [target, 'linear-fallback'])),
    model_metrics_file: null,
    forecast
  };
}

function buildFallbackInterval(value, step) {
  const spread = value * 0.08 * Math.sqrt(step);
  return {
    lower: parseFloat(Math.max(0, value - spread).toFixed(2)),
    upper: parseFloat(Math.max(0, value + spread).toFixed(2))
  };
}

function fitLinearTrend(xValues, yValues) {
  const n = xValues.length;
  const sumX = xValues.reduce((sum, value) => sum + value, 0);
  const sumY = yValues.reduce((sum, value) => sum + value, 0);
  const sumXY = xValues.reduce((sum, value, index) => sum + value * yValues[index], 0);
  const sumXX = xValues.reduce((sum, value) => sum + value * value, 0);
  const denominator = n * sumXX - sumX * sumX;

  if (!denominator) {
    return { slope: 0, intercept: sumY / n };
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function stripHtml(value) {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMpocCpoPrice(html) {
  const text = stripHtml(html);
  const datedTableMatch = text.match(/CPO Prices.*?Pricing Date\s+Settlement Price RM\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{2})\s+([\d,]+(?:\.\d+)?)/i);
  if (datedTableMatch) {
    return {
      pricingDate: datedTableMatch[1],
      settlementRmPerTonne: Number(datedTableMatch[2].replace(/,/g, ''))
    };
  }

  const fallbackTodayMatch = text.match(/Palm Oil Price Today\s+RM\s*([\d,]+(?:\.\d+)?)/i);
  if (fallbackTodayMatch) {
    return {
      pricingDate: null,
      settlementRmPerTonne: Number(fallbackTodayMatch[1].replace(/,/g, ''))
    };
  }

  return null;
}

async function fetchUsdPerMyrRate() {
  const response = await axios.get('https://api.frankfurter.dev/v1/latest?base=MYR&symbols=USD', { timeout: 5000 });
  const rate = response.data?.rates?.USD;

  if (!rate) {
    throw new Error('USD conversion rate unavailable.');
  }

  return {
    rate: Number(rate),
    date: response.data?.date || null
  };
}

async function fetchFreeDailyCpoPrice() {
  const mpocResponse = await axios.get(MPOC_DAILY_PRICE_URL, {
    timeout: 7000,
    headers: {
      'User-Agent': 'Mozilla/5.0 Palm Oil Import Impact Simulator'
    }
  });

  const mpocPrice = extractMpocCpoPrice(mpocResponse.data);
  if (!mpocPrice?.settlementRmPerTonne) {
    throw new Error('Could not extract MPOC daily CPO price.');
  }

  const fx = await fetchUsdPerMyrRate();
  return {
    price: Number((mpocPrice.settlementRmPerTonne * fx.rate).toFixed(2)),
    source: 'MPOC daily CPO price converted from MYR to USD',
    live: true,
    market_date: mpocPrice.pricingDate,
    fx_date: fx.date,
    settlement_rm_per_tonne: mpocPrice.settlementRmPerTonne
  };
}

async function buildHistoricalPriceFallback() {
  const dataset = await loadDashboardDataset();
  const enrichedData = enrichHistoricalData(dataset.historicalData);
  const latest = enrichedData[enrichedData.length - 1];

  return {
    price: latest.avg_import_price_usd_per_tonne,
    source: `Latest dashboard average import price (${latest.year})`,
    live: false,
    market_date: String(latest.year),
    settlement_rm_per_tonne: null
  };
}

router.get('/live-cpo-price', async (req, res) => {
  try {
    const freeDailyPrice = await fetchFreeDailyCpoPrice();
    return res.json(freeDailyPrice);
  } catch (freeSourceError) {
    console.warn('Free daily CPO lookup failed, trying alternate source.', freeSourceError.message);
  }

  try {
    const apiKey = process.env.COMMODITY_API_KEY;
    if (apiKey) {
      const response = await axios.get(`https://api.commodities-api.com/api/latest?access_key=${apiKey}&base=USD&symbols=CPO`, { timeout: 3000 });
      if (response.data && response.data.data && response.data.data.rates.CPO) {
        return res.json({ price: parseFloat((1 / response.data.data.rates.CPO).toFixed(2)), source: 'Commodities-API', live: true });
      }
    }
  } catch (paidSourceError) {
    console.warn('Commodities API lookup failed.', paidSourceError.message);
  }

  try {
    const fallback = await buildHistoricalPriceFallback();
    res.json(fallback);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch palm oil price' });
  }
});

router.post('/simulate', async (req, res) => {
  try {
    res.json(calculateScenario(req.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const dataset = await loadDashboardDataset();
    const enrichedData = enrichHistoricalData(dataset.historicalData);

    res.json({
      historicalData: enrichedData,
      kpis: buildKpis(enrichedData),
      nmeoOp: dataset.nmeoOp,
      sources: dataset.sources
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/forecast', async (req, res) => {
  try {
    const response = await axios.post('http://127.0.0.1:8000/forecast', req.body, { timeout: 5000 });
    res.json(response.data);
  } catch (error) {
    const dataset = await loadDashboardDataset();
    res.json(buildForecastFallback(dataset.historicalData, req.body?.years_ahead));
  }
});

router.post('/optimal-tariff', async (req, res) => {
  try {
    const { global_price = 800, production_gap = 7500, import_volume = 8000, max_consumer_price_rise = 8 } = req.body;
    const sweep = [];
    let bestTariff = 0;
    let bestFarmer = -999;

    for (let tariff = 0; tariff <= 50; tariff += 0.5) {
      const result = calculateScenario({ tariff, global_price, production_gap, import_volume });
      const entry = { tariff, ...result };
      sweep.push(entry);

      if (result.consumer_price_change <= max_consumer_price_rise && result.farmer_income_change > bestFarmer) {
        bestFarmer = result.farmer_income_change;
        bestTariff = tariff;
      }
    }

    const best = sweep.find((scenario) => scenario.tariff === bestTariff);
    res.json({ optimal_tariff: bestTariff, ...best, sweep_results: sweep });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/batch-simulate', async (req, res) => {
  try {
    const results = (req.body.scenarios || []).map((scenario) => ({
      inputs: scenario,
      ...calculateScenario(scenario)
    }));
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/save-scenario', async (req, res) => {
  try {
    const sim = new Simulation(req.body);
    await sim.save();
    res.status(201).json(sim);
  } catch (error) {
    console.warn('DB not connected, skipping save for local demo.');
    res.status(200).json({ ...req.body, _id: Date.now().toString(), timestamp: new Date().toISOString() });
  }
});

router.get('/scenarios', async (req, res) => {
  try {
    const scenarios = await Simulation.find().sort('-timestamp').limit(10);
    res.json(scenarios);
  } catch (error) {
    res.json([]);
  }
});

module.exports = router;
