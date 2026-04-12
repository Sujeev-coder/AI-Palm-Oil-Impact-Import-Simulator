const mongoose = require('mongoose');

const historicalDataSchema = new mongoose.Schema({
  year: Number,
  import_volume: Number,
  production: Number,
  price_index: Number
});

module.exports = mongoose.model('HistoricalData', historicalDataSchema);
