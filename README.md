# AI Palm Oil Import Impact Simulator

An interactive policy simulation platform for analyzing how palm oil tariff changes can affect farmer income, consumer prices, import dependency, domestic production, and edible-oil self-reliance in India.

The project combines a React dashboard, a Node.js API layer, and a FastAPI machine learning service. It uses sourced public datasets, transparent rule-based policy equations, and forecast models to make palm oil trade and production trends easier to explore.

## Features

- Policy simulation engine for palm oil import tariff scenarios
- Adjustable levers for customs duty, global CPO price, production gap, and import volume
- Farmer income, consumer price, and import dependency impact outputs
- Scenario comparison mode for testing two policy cases side by side
- Multi-year projection view for rule-based scenario outcomes
- National palm oil dashboard with imports, domestic production, cultivated area, import value, and price trends
- NMEO-OP progress tracking with mission targets and focus regions
- Forecasting API for import volume, import value, domestic production, and cultivated area
- Live daily CPO price lookup with fallback to historical dashboard data
- Optional MongoDB scenario saving

## Tech Stack

**Frontend**

- React
- Vite
- Tailwind CSS
- Recharts
- Axios
- Lucide React

**Backend**

- Node.js
- Express
- MongoDB / Mongoose
- Axios

**ML Service**

- Python
- FastAPI
- scikit-learn
- XGBoost
- statsmodels
- Prophet
- pandas
- joblib

## Project Structure

```text
AI Palm Oil Simulator/
|-- client/                 # React + Vite frontend
|   |-- src/pages/          # Landing, dashboard, simulator, insights pages
|   `-- package.json
|-- server/                 # Express backend API
|   |-- data/               # Dashboard datasets and source metadata
|   |-- models/             # Mongoose models
|   |-- routes/api.js       # API routes
|   `-- index.js
|-- ml-service/             # FastAPI forecasting service
|   |-- models/             # Trained model artifacts
|   |-- main.py             # ML API entrypoint
|   `-- requirements.txt
|-- tmp-data/               # Raw or temporary data files
`-- start.ps1               # Convenience script for frontend + Node backend
```

## How It Works

The simulator uses transparent policy equations for scenario analysis:

- Higher tariffs increase estimated farmer income
- Higher tariffs increase estimated consumer price pressure
- Higher tariffs reduce estimated import dependency
- Global CPO price changes affect both farmer income and consumer price movement

The dashboard is built from historical public data and derives additional indicators such as:

- Average import price per tonne
- Import dependency
- Self-reliance
- Year-over-year changes

The ML service provides forecast-safe predictions for:

- Import volume
- Import value
- Domestic production
- Cultivated area

If the ML service is not running, the Node backend falls back to a linear trend forecast so the app can still work for local demos.

## Getting Started

### Prerequisites

Install the following:

- Node.js
- npm
- Python 3.10+
- MongoDB, optional for saving scenarios

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd "AI Palm Oil Simulator"
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Install Backend Dependencies

```bash
cd ../server
npm install
```

### 4. Install ML Service Dependencies

```bash
cd ../ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

On macOS/Linux, activate the virtual environment with:

```bash
source .venv/bin/activate
```

## Running the Project

### Option 1: Run Frontend and Node Backend with PowerShell

From the project root:

```powershell
.\start.ps1
```

This starts:

- Node backend on `http://localhost:5000`
- Vite frontend on `http://localhost:5173`

### Option 2: Run Each Service Manually

Start the Node backend:

```bash
cd server
node index.js
```

Start the React frontend:

```bash
cd client
npm run dev
```

Start the ML service:

```bash
cd ml-service
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Open the frontend in your browser:

```text
http://localhost:5173
```

## API Overview

### Node Backend

Base URL:

```text
http://localhost:5000/api
```

Main routes:

- `GET /dashboard` - Returns historical dashboard data, KPIs, NMEO-OP data, and sources
- `POST /simulate` - Runs a single policy simulation
- `POST /batch-simulate` - Runs multiple scenarios
- `POST /forecast` - Returns ML forecast results or fallback trend forecast
- `POST /optimal-tariff` - Finds an optimal tariff under a consumer price constraint
- `GET /live-cpo-price` - Fetches daily CPO price or fallback historical price
- `POST /save-scenario` - Saves a scenario to MongoDB or returns local fallback data
- `GET /scenarios` - Lists saved scenarios

### ML Service

Base URL:

```text
http://localhost:8000
```

Main routes:

- `GET /health` - Checks whether forecast models are loaded
- `POST /predict` - Runs a rule-based impact prediction
- `POST /batch-predict` - Runs batch predictions
- `POST /optimal-tariff` - Finds an optimal tariff
- `POST /forecast` - Generates forecast results with uncertainty intervals

## Example Simulation Request

```json
{
  "tariff": 15,
  "global_price": 800,
  "production_gap": 7500,
  "import_volume": 8000
}
```

Example response:

```json
{
  "farmer_income_change": 12,
  "consumer_price_change": 7.5,
  "import_dependency": 50.42,
  "model_type": "rule-based",
  "method": "Weighted tariff and global-price equations with import response adjustment"
}
```

## Data Sources

The dashboard uses local dataset and source metadata files in `server/data/`.

Key data files include:

- `dashboardDataset.csv`
- `dashboardSources.json`
- `nmeoOp.json`
- `forecastTrainingDataset.csv`
- `forecastTrainingSources.json`
- `policyAssumptions.json`

The app is designed to keep derived indicators transparent and tied to source-backed data wherever possible.

## Environment Variables

The app can run without most environment variables, but these values are supported:

```env
PORT=5000
DASHBOARD_DATASET_PATH=path/to/dashboardDataset.csv
NMEO_OP_DATA_PATH=path/to/nmeoOp.json
COMMODITY_API_KEY=your_optional_api_key
```

MongoDB defaults to:

```text
mongodb://127.0.0.1:27017/palmoil_sim
```

If MongoDB is not running, the app continues in fallback mode and skips persistent scenario saving.

## Build

Build the frontend for production:

```bash
cd client
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Model Notes

The policy simulator is intentionally explainable. It uses a rule-based model for tariff impact simulation so users can understand how scenario inputs influence outputs.

The ML service loads forecast artifacts from:

```text
ml-service/models/forecast/
```

If forecast artifacts are missing or the ML service is offline, the Express backend provides a trend-based fallback forecast.

## Use Cases

- Academic policy analysis
- Agriculture and trade policy demos
- Data visualization projects
- Edible oil self-reliance research
- Scenario planning for tariff decisions
- Public dataset based forecasting experiments

## Disclaimer

This project is for educational, academic, and exploratory policy analysis. It should not be used as the sole basis for real-world policy, financial, or trade decisions.

## Author

Developed by Sujee.
