"""
Palm Oil Import Impact Simulator - XGBoost Model Training Script
Generates synthetic economic data and trains 3 XGBoost models:
  1. Farmer Income Change predictor
  2. Consumer Price Change predictor
  3. Import Dependency predictor
"""

import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

np.random.seed(42)

# --------------------------------------------------------------------------
# 1.  Generate Synthetic Training Data
#     Based on realistic economic relationships for palm oil imports in India
# --------------------------------------------------------------------------
NUM_SAMPLES = 5000

tariff = np.random.uniform(0, 50, NUM_SAMPLES)               # Customs duty %
global_price = np.random.uniform(500, 1500, NUM_SAMPLES)      # $/Tonne (CPO)
production_gap = np.random.uniform(2000, 15000, NUM_SAMPLES)  # '000 Tonnes domestic gap
import_volume = np.random.uniform(3000, 15000, NUM_SAMPLES)   # '000 Tonnes planned imports

# --- Feature interactions & non-linear effects ---
tariff_sq = tariff ** 2
price_deviation = global_price - 800  # deviation from baseline
tariff_price_interaction = tariff * (global_price / 1000)
gap_import_ratio = production_gap / (import_volume + 1)

# --- Target 1: Farmer Income Change (%) ---
# Higher tariff → protects domestic farmers → income rises (with diminishing returns)
# Higher global price → local prices can match → income rises
# Larger production gap → more demand pressure → slight positive
farmer_income_change = (
    tariff * 0.85
    - tariff_sq * 0.004                          # diminishing returns at very high tariffs
    + price_deviation * 0.012
    + tariff_price_interaction * 0.15
    + gap_import_ratio * 2.5
    + np.random.normal(0, 0.8, NUM_SAMPLES)      # noise
)

# --- Target 2: Consumer Price Change (%) ---
# Higher tariff → imported oil costs more → consumer prices rise
# Higher global price → everything costs more
# Interaction effects make it non-linear
consumer_price_change = (
    tariff * 0.55
    + tariff_sq * 0.002
    + price_deviation * 0.022
    + tariff_price_interaction * 0.08
    - gap_import_ratio * 1.2                     # more domestic supply → slight relief
    + np.random.normal(0, 0.6, NUM_SAMPLES)
)

# --- Target 3: Import Dependency (%) ---
# Higher tariff → discourages imports → lower dependency
# Larger production gap → need more imports → higher dependency
# Higher import volume planned → higher dependency baseline
adjusted_imports = np.maximum(0, import_volume * (1 - tariff * 0.006 - tariff_sq * 0.00005))
total_supply = adjusted_imports + production_gap + 1
import_dependency = (adjusted_imports / total_supply) * 100 + np.random.normal(0, 1.0, NUM_SAMPLES)
import_dependency = np.clip(import_dependency, 0, 100)

# --------------------------------------------------------------------------
# 2.  Build DataFrame
# --------------------------------------------------------------------------
df = pd.DataFrame({
    'tariff': tariff,
    'global_price': global_price,
    'production_gap': production_gap,
    'import_volume': import_volume,
    'farmer_income_change': farmer_income_change,
    'consumer_price_change': consumer_price_change,
    'import_dependency': import_dependency
})

features = ['tariff', 'global_price', 'production_gap', 'import_volume']
X = df[features]

# --------------------------------------------------------------------------
# 3.  Train 3 XGBoost Models
# --------------------------------------------------------------------------
models_dir = os.path.join(os.path.dirname(__file__), 'models')
os.makedirs(models_dir, exist_ok=True)

targets = {
    'farmer_income': 'farmer_income_change',
    'consumer_price': 'consumer_price_change',
    'import_dependency': 'import_dependency'
}

for name, col in targets.items():
    print(f"\n{'='*50}")
    print(f"Training model: {name}")
    print(f"{'='*50}")

    y = df[col]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.9,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=42,
        verbosity=0
    )
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"  MAE  = {mae:.4f}")
    print(f"  R²   = {r2:.4f}")

    # Save
    model_path = os.path.join(models_dir, f'{name}_model.json')
    model.save_model(model_path)
    print(f"  Saved → {model_path}")

# Also save the feature names for reference
joblib.dump(features, os.path.join(models_dir, 'feature_names.pkl'))
print(f"\n✅ All 3 XGBoost models trained and saved to: {models_dir}")
