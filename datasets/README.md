# NeuroNose Sensor Datasets

This directory contains multi-channel electronic nose (e-nose) sensor measurement data used for machine learning model training, algorithm verification, and hardware-software co-simulation.

> [!WARNING]
> **SYNTHETIC DATA NOTICE**:
> The datasets in this directory are generated via deterministic numerical simulation. They represent emulated multi-channel sensor response profiles and have **NOT** been collected or calibrated on physical sensor hardware in operational environments.

---

## 1. Dataset Schema & Column Specification

Each dataset is formatted as a comma-separated values (CSV) table with the following schema:

| Column Name | Data Type | Physical Meaning | Typical Range |
| :--- | :--- | :--- | :--- |
| `timestamp` | String (ISO 8601) | Sample acquisition timestamp (`YYYY-MM-DD HH:MM:SS.mmm`) | Monotonically increasing |
| `session_id` | String | Unique measurement session identifier (`sess_<id>_<class>`) | Discrete categorical |
| `ch0` | Float64 | Sensor Channel 0 voltage response (e.g. general VOC / alcohols) | 0.05 V – 5.0 V |
| `ch1` | Float64 | Sensor Channel 1 voltage response (e.g. aromatics / pyrazines) | 0.05 V – 5.0 V |
| `ch2` | Float64 | Sensor Channel 2 voltage response (e.g. sulfides / amines) | 0.05 V – 5.0 V |
| `ch3` | Float64 | Sensor Channel 3 voltage response (e.g. phenols / combustion) | 0.05 V – 5.0 V |
| `ch4` | Float64 | Sensor Channel 4 voltage response (e.g. esters / ketones) | 0.05 V – 5.0 V |
| `ch5` | Float64 | Sensor Channel 5 voltage response (e.g. amine decomposition) | 0.05 V – 5.0 V |
| `ch6` | Float64 | Sensor Channel 6 voltage response (e.g. terpenes / floral VOCs) | 0.05 V – 5.0 V |
| `ch7` | Float64 | Sensor Channel 7 voltage response (e.g. high-molecular VOCs) | 0.05 V – 5.0 V |
| `temperature`| Float64 | Environmental ambient temperature (°C) | 15.0 °C – 35.0 °C |
| `humidity` | Float64 | Environmental relative humidity (% RH) | 30.0 % – 85.0 % |
| `label` | String | Ground-truth odor category class | One of 6 target classes |

---

## 2. Odor Classes & Nominal Fingerprints

The simulation models 6 distinct odor classes, each exhibiting a characteristic 8-channel sensor fingerprint:

1. `fresh_food`: Low-to-moderate baseline with subtle organic ester signatures.
2. `spoiled_food`: High amplitude on amine and sulfide sensing channels (`ch0`, `ch2`, `ch5`) and elevated local humidity.
3. `coffee_aroma`: Strong response on pyrazines, phenols, and aromatic channels (`ch1`, `ch3`, `ch4`) with moderate temperature elevation.
4. `tea_aroma`: Subtle floral/terpene signature prominent on `ch2` and `ch6`.
5. `ambient_air`: Quiescent baseline background response across all 8 channels (~0.40 V).
6. `chemical_voc`: Heavy, saturating volatile organic compound exposure peaking across `ch0`, `ch4`, and `ch7`.

---

## 3. How to Generate Synthetic Data

To generate the reference demo dataset (`datasets/sensor_data_demo.csv`) and verification test vectors:

```bash
# Generate default demo dataset (200 samples/class, seed=42)
python datasets/generate_demo_data.py

# Custom sample count and output path
python datasets/generate_demo_data.py --samples-per-class 500 --seed 123 --output-dataset datasets/custom_dataset.csv
```

Alternatively, invoke the generator directly from `python-ml/`:

```bash
python python-ml/sensor_data_generator.py --samples-per-class 200 --noise 0.10 --seed 42 --output datasets/sensor_data_demo.csv
```

---

## 4. Dataset Partitioning & Preventing Data Leakage

> [!IMPORTANT]
> **NEVER perform naive uniform random row-wise splits on sensor time-series data!**

Adjacent time-series samples within a measurement session exhibit high temporal auto-correlation and shared session-level baseline offsets. A naive random split leaks session parameters into the test set, creating artificially inflated accuracy metrics.

**Best Practice**:
- NeuroNose uses **session-aware partitioning** (`split_by_session` in `dataset_loader.py`).
- Complete `session_id` measurement blocks are segregated into either train or test sets.
- No session ever appears in both training and evaluation partitions.

---

## 5. Synthetic vs. Real Sensor Data Limitations

While deterministic simulation enables reproducible pipeline validation and bit-exact RTL co-simulation, real physical e-nose arrays exhibit complexities not fully captured in synthetic models:

1. **Non-linear Environmental Cross-Sensitivity**: Real MOS sensors exhibit complex non-linear response curves with humidity and temperature variations that vary per chemical analyte.
2. **Sensor Poisoning & Irreversible Aging**: Exposure to high concentrations of sulfur, siloxanes, or heavy VOCs can permanently degrade physical sensor sensitivity.
3. **Thermal Dynamics & Warm-up Transients**: Real sensor heaters take minutes to reach chemical equilibrium upon power-up.
4. **Manufacturing Tolerances**: Real physical sensor arrays exhibit chip-to-chip resistance variation (often ±20% to ±50%) requiring individual baseline calibration.
