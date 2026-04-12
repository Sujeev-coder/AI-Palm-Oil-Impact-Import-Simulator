require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

// Optional MongoDB connection for fully working backend
mongoose.connect('mongodb://127.0.0.1:27017/palmoil_sim', {
  // Options no longer needed in modern mongoose but harmless
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.warn('MongoDB connection failed. Running in mock fallback mode. To fix, Ensure MongoDB is running locally on port 27017.');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
