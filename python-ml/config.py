"""Central configuration for the NeuroNose ML Pipeline.

Provides centralized constants, paths, sensor parameters, class definitions,
and fixed-point quantization settings.
"""

from pathlib import Path
from typing import Dict, List

# -----------------------------------------------------------------------------
# Global Reproducibility & Hardware Specifications
# -----------------------------------------------------------------------------
RANDOM_SEED: int = 42
NUM_CHANNELS: int = 8
SAMPLE_RATE: int = 10  # Hertz (samples per second)

# Sensor Channel Definitions
CHANNEL_NAMES: List[str] = [f"ch{i}" for i in range(NUM_CHANNELS)]
AUX_CHANNELS: List[str] = ["temperature", "humidity"]
ALL_SENSOR_CHANNELS: List[str] = CHANNEL_NAMES + AUX_CHANNELS

# -----------------------------------------------------------------------------
# Odor Class Labels & Encoding
# -----------------------------------------------------------------------------
CLASS_LABELS: List[str] = [
    "fresh_food",
    "spoiled_food",
    "coffee_aroma",
    "tea_aroma",
    "ambient_air",
    "chemical_voc",
]

LABEL_TO_ID: Dict[str, int] = {label: idx for idx, label in enumerate(CLASS_LABELS)}
ID_TO_LABEL: Dict[int, str] = {idx: label for idx, label in enumerate(CLASS_LABELS)}

# Typical nominal sensor baseline responses (Voltages, nominal range 0.2V - 4.5V)
NOMINAL_FINGERPRINTS: Dict[str, List[float]] = {
    "fresh_food":   [0.85, 1.20, 0.90, 1.35, 0.75, 1.10, 0.65, 1.05],
    "spoiled_food": [2.85, 1.65, 3.25, 1.90, 2.55, 3.60, 1.95, 2.75],
    "coffee_aroma": [1.15, 3.55, 1.45, 3.85, 2.95, 1.25, 2.05, 1.65],
    "tea_aroma":    [0.95, 1.60, 2.25, 1.55, 1.30, 1.05, 2.65, 1.45],
    "ambient_air":  [0.40, 0.42, 0.38, 0.41, 0.39, 0.40, 0.42, 0.39],
    "chemical_voc": [3.95, 2.25, 1.85, 3.75, 4.25, 2.05, 3.15, 4.45],
}

# -----------------------------------------------------------------------------
# Q8.8 Fixed-Point Quantization Parameters
# -----------------------------------------------------------------------------
# Q8.8 represents signed 16-bit fixed point:
# 1 sign bit + 7 integer bits + 8 fractional bits
Q88_INT_BITS: int = 8      # Total integer bits including sign
Q88_FRAC_BITS: int = 8     # Fractional bits
Q88_TOTAL_BITS: int = 16   # Total word width
Q88_SCALE: float = 256.0   # 2^8
Q88_RAW_MIN: int = -32768  # -2^15
Q88_RAW_MAX: int = 32767   # 2^15 - 1
Q88_FLOAT_MIN: float = -128.0
Q88_FLOAT_MAX: float = 32767 / 256.0  # 127.99609375
Q88_STEP: float = 1.0 / 256.0         # 0.00390625

# -----------------------------------------------------------------------------
# RTL Verification Parameters
# -----------------------------------------------------------------------------
# Parameters matching the SystemVerilog hardware modules:
# Filter coefficient alpha in Q8.8 (e.g. alpha = 0.25 -> 64/256)
RTL_FILTER_ALPHA_FLOAT: float = 0.25
RTL_FILTER_ALPHA_Q88: int = int(round(RTL_FILTER_ALPHA_FLOAT * Q88_SCALE))
RTL_BASELINE_DECAY_FLOAT: float = 0.01
RTL_BASELINE_DECAY_Q88: int = int(round(RTL_BASELINE_DECAY_FLOAT * Q88_SCALE))

# -----------------------------------------------------------------------------
# Directory & File Paths
# -----------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent
PROJECT_ROOT: Path = BASE_DIR.parent
DATA_DIR: Path = PROJECT_ROOT / "datasets"
MODELS_DIR: Path = BASE_DIR / "models"
EVAL_DIR: Path = BASE_DIR / "evaluation"
VERIFICATION_DIR: Path = PROJECT_ROOT / "verification"

DEFAULT_DATASET_PATH: Path = DATA_DIR / "sensor_data_demo.csv"
DEFAULT_MODEL_PATH: Path = MODELS_DIR / "neuronose_rf_model.joblib"
DEFAULT_PREPROCESSOR_PATH: Path = MODELS_DIR / "sensor_preprocessor.joblib"
DEFAULT_NOVELTY_PATH: Path = MODELS_DIR / "novelty_detector.joblib"
DEFAULT_METADATA_PATH: Path = MODELS_DIR / "training_metadata.json"
DEFAULT_TEST_VECTORS_PATH: Path = VERIFICATION_DIR / "test_vectors.csv"

# Ensure runtime directories exist
for directory in [DATA_DIR, MODELS_DIR, EVAL_DIR, VERIFICATION_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
