"""
Palm Oil Import Impact Simulator API.

- Scenario simulation is rule-based and transparent.
- Forecasting uses trained forecast-safe models with uncertainty bands.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import os
import logging
from typing import Dict, List, Optional
import joblib
import pandas as pd

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Palm Oil Import Impact Simulator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
FORECAST_MODELS_DIR = os.path.join(MODELS_DIR, "forecast")
forecast_models: Dict[str, dict] = {}
forecast_metadata = {}


def load_forecast_models():
    global forecast_metadata

    target_files = {
        "import_volume_tonnes": "import_volume_tonnes.joblib",
        "import_value_usd_million": "import_value_usd_million.joblib",
        "domestic_production_tonnes": "domestic_production_tonnes.joblib",
        "cultivated_area_ha": "cultivated_area_ha.joblib",
    }

    for name, filename in target_files.items():
        path = os.path.join(FORECAST_MODELS_DIR, filename)
        if os.path.exists(path):
            forecast_models[name] = joblib.load(path)
            logger.info("Loaded forecast model artifact: %s", name)
        else:
            logger.warning("Forecast model file not found: %s", path)

    metadata_path = os.path.join(FORECAST_MODELS_DIR, "metadata.joblib")
    if os.path.exists(metadata_path):
        forecast_metadata = joblib.load(metadata_path)


load_forecast_models()


class SimulationRequest(BaseModel):
    tariff: float
    global_price: float
    production_gap: float
    import_volume: float


class SimulationResponse(BaseModel):
    farmer_income_change: float
    consumer_price_change: float
    import_dependency: float
    model_type: str = "rule-based"
    method: str


class BatchRequest(BaseModel):
    scenarios: List[SimulationRequest]


class OptimalTariffRequest(BaseModel):
    global_price: float = 800
    production_gap: float = 7500
    import_volume: float = 8000
    max_consumer_price_rise: float = 8.0


class OptimalTariffResponse(BaseModel):
    optimal_tariff: float
    farmer_income_change: float
    consumer_price_change: float
    import_dependency: float
    model_type: str = "rule-based"
    sweep_results: list


class ForecastRequest(BaseModel):
    years_ahead: int = 3


class IntervalBand(BaseModel):
    lower: float
    upper: float


class ForecastPoint(BaseModel):
    year: int
    import_volume_tonnes: float
    import_value_usd_million: float
    domestic_production_tonnes: float
    cultivated_area_ha: float
    avg_import_price_usd_per_tonne: float
    import_dependency: float
    self_reliance: float
    import_volume_interval: IntervalBand
    import_value_interval: IntervalBand
    domestic_production_interval: IntervalBand
    cultivated_area_interval: IntervalBand


class ForecastResponse(BaseModel):
    model_type: str
    training_rows: int
    base_year: int
    interval_method: str
    selected_models: Dict[str, str]
    best_pattern_fit_models: Dict[str, str]
    forecast: List[ForecastPoint]
    model_metrics_file: Optional[str] = None


def _predict_single(tariff, global_price, production_gap, import_volume):
    t_inc = tariff * 0.8
    t_price = tariff * 0.5
    t_imp = -tariff * 0.3
    g_inc = (global_price - 800) * 0.01
    g_price = (global_price - 800) * 0.02
    new_imports = max(0, import_volume * (1 + t_imp / 100))
    total = new_imports + production_gap + 1
    dep = (new_imports / total) * 100
    return {
        "farmer_income_change": round(t_inc + g_inc, 2),
        "consumer_price_change": round(t_price + g_price, 2),
        "import_dependency": round(dep, 2),
        "model_type": "rule-based",
        "method": "Weighted tariff and global-price equations with import response adjustment",
    }


def _build_future_years(base_year, years_ahead):
    years_ahead = max(1, min(5, years_ahead))
    return [base_year + step for step in range(1, years_ahead + 1)]


def _predict_artifact(artifact, future_years):
    name = artifact["name"]
    model = artifact["model"]
    residual_std = artifact.get("residual_std", 0.0)
    years_ahead = len(future_years)

    if name in {"linear", "poly2_ridge", "poly3_ridge", "elasticnet", "random_forest", "xgboost"}:
        frame = pd.DataFrame({"year": future_years})
        point = [max(0.0, float(value)) for value in model.predict(frame)]
        lower = []
        upper = []
        for step, value in enumerate(point, start=1):
            spread = residual_std * 1.96 * (step ** 0.5)
            lower.append(max(0.0, value - spread))
            upper.append(max(0.0, value + spread))
        return point, lower, upper

    if name in {"arima", "sarimax"}:
        forecast_result = model.get_forecast(steps=years_ahead)
        predicted = forecast_result.predicted_mean
        conf = forecast_result.conf_int(alpha=0.05)
        if hasattr(conf, "columns"):
            lower_values = conf[conf.columns[0]].tolist()
            upper_values = conf[conf.columns[1]].tolist()
        else:
            conf_array = np.asarray(conf)
            lower_values = conf_array[:, 0].tolist()
            upper_values = conf_array[:, 1].tolist()
        point = [max(0.0, float(value)) for value in predicted]
        lower = [max(0.0, float(value)) for value in lower_values]
        upper = [max(0.0, float(value)) for value in upper_values]
        return point, lower, upper

    if name == "prophet":
        future = pd.DataFrame({"ds": pd.to_datetime([f"{year}-01-01" for year in future_years])})
        forecast = model.predict(future)
        point = [max(0.0, float(value)) for value in forecast["yhat"]]
        lower = [max(0.0, float(value)) for value in forecast["yhat_lower"]]
        upper = [max(0.0, float(value)) for value in forecast["yhat_upper"]]
        return point, lower, upper

    raise HTTPException(status_code=500, detail=f"Unsupported forecast model artifact: {name}")


def _forecast_series(years_ahead):
    if not forecast_models or not forecast_metadata:
        raise HTTPException(status_code=503, detail="Forecast models are not available. Run train_forecast_model.py first.")

    base_year = max(forecast_metadata["years"])
    future_years = _build_future_years(base_year, years_ahead)
    per_target_predictions = {}

    for target, artifact in forecast_models.items():
        point, lower, upper = _predict_artifact(artifact, future_years)
        per_target_predictions[target] = {
            "point": point,
            "lower": lower,
            "upper": upper,
            "interval_method": artifact.get("interval_method", "unknown"),
        }

    forecast = []
    for index, year in enumerate(future_years):
        row = {
            "year": year,
            "import_volume_tonnes": round(per_target_predictions["import_volume_tonnes"]["point"][index], 2),
            "import_value_usd_million": round(per_target_predictions["import_value_usd_million"]["point"][index], 2),
            "domestic_production_tonnes": round(per_target_predictions["domestic_production_tonnes"]["point"][index], 2),
            "cultivated_area_ha": round(per_target_predictions["cultivated_area_ha"]["point"][index], 2),
            "import_volume_interval": {
                "lower": round(per_target_predictions["import_volume_tonnes"]["lower"][index], 2),
                "upper": round(per_target_predictions["import_volume_tonnes"]["upper"][index], 2),
            },
            "import_value_interval": {
                "lower": round(per_target_predictions["import_value_usd_million"]["lower"][index], 2),
                "upper": round(per_target_predictions["import_value_usd_million"]["upper"][index], 2),
            },
            "domestic_production_interval": {
                "lower": round(per_target_predictions["domestic_production_tonnes"]["lower"][index], 2),
                "upper": round(per_target_predictions["domestic_production_tonnes"]["upper"][index], 2),
            },
            "cultivated_area_interval": {
                "lower": round(per_target_predictions["cultivated_area_ha"]["lower"][index], 2),
                "upper": round(per_target_predictions["cultivated_area_ha"]["upper"][index], 2),
            },
        }

        avg_price = (row["import_value_usd_million"] * 1000000) / row["import_volume_tonnes"] if row["import_volume_tonnes"] else 0.0
        total_supply = row["import_volume_tonnes"] + row["domestic_production_tonnes"]
        import_dependency = (row["import_volume_tonnes"] / total_supply) * 100 if total_supply else 0.0
        self_reliance = (row["domestic_production_tonnes"] / total_supply) * 100 if total_supply else 0.0

        row["avg_import_price_usd_per_tonne"] = round(avg_price, 2)
        row["import_dependency"] = round(import_dependency, 2)
        row["self_reliance"] = round(self_reliance, 2)
        forecast.append(row)

    interval_methods = {
        target: artifact.get("interval_method", "unknown")
        for target, artifact in forecast_models.items()
    }

    return {
        "model_type": "real-data-forecast",
        "training_rows": forecast_metadata.get("training_rows", 0),
        "base_year": base_year,
        "interval_method": jsonable_interval_summary(interval_methods),
        "selected_models": forecast_metadata.get("selected_models", {}),
        "best_pattern_fit_models": forecast_metadata.get("best_pattern_fit_models", {}),
        "model_metrics_file": forecast_metadata.get("model_report_file"),
        "forecast": forecast,
    }


def jsonable_interval_summary(interval_methods):
    parts = [f"{target}: {method}" for target, method in interval_methods.items()]
    return "; ".join(parts)


@app.post("/predict", response_model=SimulationResponse)
def predict_impact(req: SimulationRequest):
    result = _predict_single(req.tariff, req.global_price, req.production_gap, req.import_volume)
    return SimulationResponse(**result)


@app.post("/batch-predict")
def batch_predict(req: BatchRequest):
    results = []
    for scenario in req.scenarios:
        result = _predict_single(scenario.tariff, scenario.global_price, scenario.production_gap, scenario.import_volume)
        result["inputs"] = scenario.model_dump()
        results.append(result)
    return {"results": results}


@app.post("/optimal-tariff", response_model=OptimalTariffResponse)
def find_optimal_tariff(req: OptimalTariffRequest):
    sweep_results = []
    best_tariff = 0.0
    best_farmer = -999.0

    for tariff in np.arange(0, 50.5, 0.5):
        result = _predict_single(float(tariff), req.global_price, req.production_gap, req.import_volume)
        entry = {
            "tariff": float(tariff),
            "farmer_income_change": result["farmer_income_change"],
            "consumer_price_change": result["consumer_price_change"],
            "import_dependency": result["import_dependency"],
        }
        sweep_results.append(entry)

        if result["consumer_price_change"] <= req.max_consumer_price_rise and result["farmer_income_change"] > best_farmer:
            best_farmer = result["farmer_income_change"]
            best_tariff = float(tariff)

    best_result = _predict_single(best_tariff, req.global_price, req.production_gap, req.import_volume)

    return OptimalTariffResponse(
        optimal_tariff=best_tariff,
        farmer_income_change=best_result["farmer_income_change"],
        consumer_price_change=best_result["consumer_price_change"],
        import_dependency=best_result["import_dependency"],
        model_type=best_result["model_type"],
        sweep_results=sweep_results,
    )


@app.post("/forecast", response_model=ForecastResponse)
def forecast_trends(req: ForecastRequest):
    return ForecastResponse(**_forecast_series(req.years_ahead))


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "forecast_models_loaded": len(forecast_models),
        "forecast_model_names": {target: artifact.get("name") for target, artifact in forecast_models.items()},
        "ready": len(forecast_models) == 4,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
