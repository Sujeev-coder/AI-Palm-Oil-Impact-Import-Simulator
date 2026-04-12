const mongoose = require('mongoose');

const simulationSchema = new mongoose.Schema({
  scenarioName: String,
  inputs: {
    tariff: Number,
    global_price: Number,
    production_gap: Number,
    import_volume: Number
  },
  outputs: {
    farmer_income_change: Number,
    consumer_price_change: Number,
    import_dependency: Number
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Simulation', simulationSchema);
