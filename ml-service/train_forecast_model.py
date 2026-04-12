"""
Train forecasting models on the separated forecast training dataset.

This trainer compares time-series-friendly models using:
- rolling one-step MAE for in-range fit
- extrapolation stability across a 5-year horizon
- confidence interval width

It keeps the current assignment logic:
- best_pattern_fit_model: lowest rolling MAE across all candidates
- final_forecast_model: best forecast-safe model for future extrapolation
"""

from pathlib import Path
import json
import math
import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import ElasticNet, LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.statespace.sarimax import SARIMAX

try:
    from xgboost import XGBRegressor
except ImportError:
    XGBRegressor = None

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR.parent / "server" / "data" / "forecastTrainingDataset.csv"
FORECAST_MODELS_DIR = BASE_DIR / "models" / "forecast"

TARGET_COLUMNS = [
    "import_volume_tonnes",
    "import_value_usd_million",
    "domestic_production_tonnes",
    "cultivated_area_ha",
]

MODEL_FAMILIES = {
    "linear": "trend-regression",
    "poly2_ridge": "trend-regression",
    "poly3_ridge": "trend-regression",
    "elasticnet": "trend-regularized-regression",
    "random_forest": "tree-ensemble",
    "xgboost": "tree-ensemble",
    "arima": "classical-time-series",
    "sarimax": "classical-time-series",
}

FORECAST_SAFE_MODELS = {"linear", "poly2_ridge", "poly3_ridge", "elasticnet", "arima", "sarimax"}
DEFAULT_HORIZON = 5
Z_VALUE_95 = 1.96
HEAVY_VALIDATION_SPLITS = 3
MEDIUM_VALIDATION_SPLITS = 4


def build_sklearn_candidates(row_count):
    candidates = {
        "linear": Pipeline([
            ("regressor", LinearRegression()),
        ]),
        "poly2_ridge": Pipeline([
            ("poly", PolynomialFeatures(degree=2, include_bias=False)),
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=1.0)),
        ]),
        "poly3_ridge": Pipeline([
            ("poly", PolynomialFeatures(degree=3, include_bias=False)),
            ("scaler", StandardScaler()),
            ("regressor", Ridge(alpha=3.0)),
        ]),
        "elasticnet": Pipeline([
            ("poly", PolynomialFeatures(degree=2, include_bias=False)),
            ("scaler", StandardScaler()),
            ("regressor", ElasticNet(alpha=0.05, l1_ratio=0.4, max_iter=10000, random_state=42)),
        ]),
    }

    candidates["random_forest"] = RandomForestRegressor(
        n_estimators=300,
        max_depth=4,
        min_samples_leaf=2,
        random_state=42,
    )

    if XGBRegressor is not None:
        candidates["xgboost"] = XGBRegressor(
            n_estimators=300,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            reg_alpha=0.0,
            reg_lambda=1.0,
            objective="reg:squarederror",
            random_state=42,
        )

    return candidates


def is_heavy_model(name):
    return name in {"arima", "sarimax"}


def is_medium_model(name):
    return name in {"random_forest", "xgboost"}


def available_candidate_names(row_count):
    names = set(build_sklearn_candidates(row_count).keys())
    if row_count >= 6:
        names.add("arima")
        names.add("sarimax")
    return names


def build_model_notes(name):
    notes = {
        "linear": "Best when the target follows a steady long-run trend and we want stable extrapolation.",
        "poly2_ridge": "Useful when the target has mild curvature while still needing smooth future-year forecasting.",
        "poly3_ridge": "Useful when the trend is nonlinear and we still need controlled extrapolation beyond the observed years.",
        "elasticnet": "Balances nonlinear trend fitting with regularization, which helps control overfitting during extrapolation.",
        "random_forest": "Good for fitting nonlinear patterns within the observed range, but weak for extrapolating to future unseen years.",
        "xgboost": "Good for complex in-range pattern fitting, but future-year extrapolation can be unstable because tree splits do not extend trends naturally.",
        "arima": "Classical time-series model that uses autocorrelation and differencing, suitable for smooth short-horizon extrapolation.",
        "sarimax": "Extension of ARIMA with a state-space form, useful for stable short-horizon trend continuation even without seasonal data.",
    }
    return notes[name]


def build_validation_split_indexes(name, total_rows, min_train_size):
    split_indexes = list(range(min_train_size, total_rows))

    if is_heavy_model(name) and len(split_indexes) > HEAVY_VALIDATION_SPLITS:
        return split_indexes[-HEAVY_VALIDATION_SPLITS:]

    if is_medium_model(name) and len(split_indexes) > MEDIUM_VALIDATION_SPLITS:
        return split_indexes[-MEDIUM_VALIDATION_SPLITS:]

    return split_indexes


def clean_numeric(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return max(0.0, float(value))


def extract_confidence_bounds(conf_int_result):
    if hasattr(conf_int_result, "columns"):
        lower_col = conf_int_result.columns[0]
        upper_col = conf_int_result.columns[1]
        return conf_int_result[lower_col].tolist(), conf_int_result[upper_col].tolist()

    conf_array = np.asarray(conf_int_result)
    return conf_array[:, 0].tolist(), conf_array[:, 1].tolist()


def build_point_frame(years):
    return pd.DataFrame({"year": list(years)})


def fit_named_model(name, x_values, y_values):
    sklearn_candidates = build_sklearn_candidates(len(x_values))

    if name in sklearn_candidates:
        model = clone(sklearn_candidates[name])
        model.fit(x_values, y_values)
        return model

    if name == "arima":
        return ARIMA(y_values.to_numpy(dtype=float), order=(1, 1, 0), trend="t").fit()

    if name == "sarimax":
        return SARIMAX(
            y_values.to_numpy(dtype=float),
            order=(1, 1, 0),
            trend="t",
            enforce_stationarity=False,
            enforce_invertibility=False,
        ).fit(disp=False)

    raise ValueError(f"Unsupported model: {name}")


def predict_named_model(name, model, future_years, residual_std=None):
    future_years = list(future_years)

    if name in MODEL_FAMILIES and MODEL_FAMILIES[name] in {
        "trend-regression",
        "trend-regularized-regression",
        "tree-ensemble",
    }:
        frame = build_point_frame(future_years)
        predictions = model.predict(frame)
        lower = []
        upper = []
        for step, prediction in enumerate(predictions, start=1):
            spread = (residual_std or 0.0) * Z_VALUE_95 * math.sqrt(step)
            lower.append(clean_numeric(prediction - spread))
            upper.append(clean_numeric(prediction + spread))
        return {
            "point": [clean_numeric(prediction) for prediction in predictions],
            "lower": lower,
            "upper": upper,
        }

    if name in {"arima", "sarimax"}:
        forecast_result = model.get_forecast(steps=len(future_years))
        predicted = forecast_result.predicted_mean
        lower_values, upper_values = extract_confidence_bounds(forecast_result.conf_int(alpha=0.05))
        return {
            "point": [clean_numeric(value) for value in predicted],
            "lower": [clean_numeric(value) for value in lower_values],
            "upper": [clean_numeric(value) for value in upper_values],
        }

    raise ValueError(f"Unsupported model: {name}")


def rolling_metrics(name, x_values, y_values, min_train_size=5):
    errors = []
    residuals = []
    interval_widths = []

    split_indexes = build_validation_split_indexes(name, len(x_values), min_train_size)

    for split_index in split_indexes:
        x_train = x_values.iloc[:split_index].reset_index(drop=True)
        y_train = y_values.iloc[:split_index].reset_index(drop=True)
        x_test = x_values.iloc[[split_index]].reset_index(drop=True)
        y_test = y_values.iloc[[split_index]].reset_index(drop=True)

        model = fit_named_model(name, x_train, y_train)
        train_predictions = predict_named_model(name, model, x_train["year"].tolist())
        train_residuals = y_train.to_numpy(dtype=float) - np.array(train_predictions["point"], dtype=float)
        residual_std = float(np.std(train_residuals, ddof=1)) if len(train_residuals) > 1 else 0.0

        prediction = predict_named_model(name, model, x_test["year"].tolist(), residual_std=residual_std)
        point_value = prediction["point"][0]
        lower_value = prediction["lower"][0]
        upper_value = prediction["upper"][0]
        actual_value = float(y_test.iloc[0])

        errors.append(abs(actual_value - point_value))
        residuals.append(actual_value - point_value)
        interval_widths.append(max(0.0, upper_value - lower_value))

    rolling_mae = float(np.mean(errors)) if errors else float("inf")
    residual_std = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
    avg_interval_width = float(np.mean(interval_widths)) if interval_widths else 0.0

    fitted_model = fit_named_model(name, x_values, y_values)
    future_years = [int(x_values["year"].iloc[-1]) + step for step in range(1, DEFAULT_HORIZON + 1)]
    future_prediction = predict_named_model(name, fitted_model, future_years, residual_std=residual_std)
    point_forecast = np.array(future_prediction["point"], dtype=float)
    mean_level = max(float(np.mean(np.abs(point_forecast))), 1.0)
    delta_values = np.diff(point_forecast)
    extrapolation_stability = float(np.std(delta_values) / mean_level) if len(delta_values) > 0 else 0.0

    artifact = {
        "name": name,
        "family": MODEL_FAMILIES[name],
        "model": fitted_model,
        "residual_std": residual_std,
        "interval_method": "native-95-percent" if name in {"arima", "sarimax", "prophet"} else "residual-normal-approx-95-percent",
        "future_years": future_years,
        "preview_forecast": {
            "point": [round(value, 4) if value is not None else None for value in future_prediction["point"]],
            "lower": [round(value, 4) if value is not None else None for value in future_prediction["lower"]],
            "upper": [round(value, 4) if value is not None else None for value in future_prediction["upper"]],
        },
    }

    return {
        "rolling_mae": rolling_mae,
        "extrapolation_stability": extrapolation_stability,
        "avg_interval_width": avg_interval_width,
        "artifact": artifact,
        "validation_splits_used": len(split_indexes),
    }


def choose_best_name(metrics, allowed_models=None, score_key="rolling_mae"):
    eligible = {
        name: values
        for name, values in metrics.items()
        if allowed_models is None or name in allowed_models
    }
    return min(eligible, key=lambda name: eligible[name][score_key])


def choose_best_forecast_model(metrics):
    eligible = {name: values for name, values in metrics.items() if name in FORECAST_SAFE_MODELS}
    mae_values = [values["rolling_mae"] for values in eligible.values()]
    stability_values = [values["extrapolation_stability"] for values in eligible.values()]

    mae_min, mae_max = min(mae_values), max(mae_values)
    stability_min, stability_max = min(stability_values), max(stability_values)

    def normalize(value, min_value, max_value):
        if max_value == min_value:
            return 0.0
        return (value - min_value) / (max_value - min_value)

    scores = {}
    for name, values in eligible.items():
        normalized_mae = normalize(values["rolling_mae"], mae_min, mae_max)
        normalized_stability = normalize(values["extrapolation_stability"], stability_min, stability_max)
        scores[name] = 0.7 * normalized_mae + 0.3 * normalized_stability

    best_name = min(scores, key=scores.get)
    return best_name, scores


def main():
    df = pd.read_csv(DATASET_PATH).sort_values("year").reset_index(drop=True)
    FORECAST_MODELS_DIR.mkdir(parents=True, exist_ok=True)

    metadata = {
        "dataset_path": str(DATASET_PATH),
        "years": df["year"].tolist(),
        "targets": TARGET_COLUMNS,
        "training_rows": len(df),
        "target_training_rows": {},
        "selection_method": "rolling-validation-mae-with-extrapolation-stability",
        "assignment_policy": "Forecast API uses forecast-safe models chosen by rolling MAE plus extrapolation stability. Tree models are still reported for in-range pattern fitting but are not preferred for final future extrapolation.",
        "candidates": sorted({
            candidate
            for target in TARGET_COLUMNS
            for candidate in available_candidate_names(len(df[["year", target]].dropna()))
        }),
        "selected_models": {},
        "best_pattern_fit_models": {},
        "validation_mae": {},
        "extrapolation_stability": {},
        "avg_interval_width": {},
        "forecast_selection_score": {},
        "model_report_file": str(FORECAST_MODELS_DIR / "model_metrics_report.json"),
    }

    model_report = {
        "dataset_path": str(DATASET_PATH),
        "years": df["year"].tolist(),
        "selection_policy": {
            "forecast_api_models": "Only forecast-safe models are eligible for final forecast endpoints.",
            "pattern_fit_models": "All candidates are evaluated to show which one best fits observed history in rolling one-step validation.",
            "reason": "The app forecasts future years beyond the training window, so extrapolation stability matters in addition to in-range fit."
        },
        "targets": {},
    }

    for target in TARGET_COLUMNS:
        target_df = df[["year", target]].dropna().reset_index(drop=True)
        x_values = target_df[["year"]]
        y_values = target_df[target]

        if len(target_df) < 5:
            raise ValueError(f"Not enough training rows for {target}. Found {len(target_df)} rows.")

        metrics = {}
        for candidate_name in sorted(available_candidate_names(len(target_df))):
            metrics[candidate_name] = rolling_metrics(candidate_name, x_values, y_values)

        best_pattern_name = choose_best_name(metrics, score_key="rolling_mae")
        best_forecast_name, forecast_scores = choose_best_forecast_model(metrics)

        artifact = metrics[best_forecast_name]["artifact"]
        artifact["target"] = target
        artifact["training_years"] = target_df["year"].tolist()
        joblib.dump(artifact, FORECAST_MODELS_DIR / f"{target}.joblib")

        metadata["selected_models"][target] = best_forecast_name
        metadata["best_pattern_fit_models"][target] = best_pattern_name
        metadata["target_training_rows"][target] = len(target_df)
        metadata["validation_mae"][target] = {name: round(values["rolling_mae"], 4) for name, values in metrics.items()}
        metadata["extrapolation_stability"][target] = {name: round(values["extrapolation_stability"], 6) for name, values in metrics.items()}
        metadata["avg_interval_width"][target] = {name: round(values["avg_interval_width"], 4) for name, values in metrics.items()}
        metadata["forecast_selection_score"][target] = {name: round(score, 6) for name, score in forecast_scores.items()}

        model_report["targets"][target] = {
            "training_rows": len(target_df),
            "final_forecast_model": best_forecast_name,
            "best_pattern_fit_model": best_pattern_name,
            "final_forecast_reason": "Chosen for the API because it balances rolling MAE with smoother future extrapolation.",
            "pattern_fit_reason": "Lowest rolling MAE across all evaluated candidates for observed historical windows.",
            "candidates": [
                {
                    "name": name,
                    "family": MODEL_FAMILIES[name],
                    "rolling_mae": round(values["rolling_mae"], 4),
                    "extrapolation_stability": round(values["extrapolation_stability"], 6),
                    "avg_interval_width": round(values["avg_interval_width"], 4),
                    "used_for_forecast_api": name == best_forecast_name,
                    "best_pattern_fit": name == best_pattern_name,
                    "forecast_safe": name in FORECAST_SAFE_MODELS,
                    "forecast_selection_score": round(forecast_scores.get(name, 0.0), 6) if name in forecast_scores else None,
                    "interval_method": values["artifact"]["interval_method"],
                    "validation_splits_used": values["validation_splits_used"],
                    "notes": build_model_notes(name),
                }
                for name, values in sorted(metrics.items())
            ],
        }

        print(
            f"Saved forecast model for {target}: {best_forecast_name} "
            f"(best overall fit: {best_pattern_name}) using {len(target_df)} rows"
        )

    joblib.dump(metadata, FORECAST_MODELS_DIR / "metadata.joblib")
    (FORECAST_MODELS_DIR / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    (FORECAST_MODELS_DIR / "model_metrics_report.json").write_text(
        json.dumps(model_report, indent=2),
        encoding="utf-8",
    )
    print(f"Saved forecast metadata to {FORECAST_MODELS_DIR}")


if __name__ == "__main__":
    main()
