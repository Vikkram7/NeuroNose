"""Dataset loader and schema validation for the NeuroNose ML Pipeline.

Implements rigorous schema validation, range checks, class imbalance reporting,
and session-aware dataset splitting to eliminate data leakage between training
and evaluation partitions.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

try:
    from config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        CLASS_LABELS,
        RANDOM_SEED,
    )
except ImportError:
    from .config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        CLASS_LABELS,
        RANDOM_SEED,
    )

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Expected minimum and maximum allowable physical values for validation
SENSOR_BOUNDS = {
    "sensor_voltage": (-0.5, 15.0),    # Volts (allow slight negative offset during calibration)
    "temperature": (-40.0, 85.0),      # Celsius
    "humidity": (0.0, 100.0),          # Relative humidity %
}


class ValidationError(ValueError):
    """Raised when a dataset fails schema or integrity validation."""
    pass


def load_and_validate_dataset(
    filepath_or_buffer: Union[str, Path, pd.DataFrame],
) -> pd.DataFrame:
    """Load a sensor dataset and perform strict schema and range validation.

    Args:
        filepath_or_buffer: Path to CSV file or an existing DataFrame.

    Returns:
        Validated DataFrame.

    Raises:
        ValidationError: If schema, datatypes, or value bounds are violated.
        FileNotFoundError: If the specified CSV file path does not exist.
    """
    if isinstance(filepath_or_buffer, pd.DataFrame):
        df = filepath_or_buffer.copy()
    else:
        path = Path(filepath_or_buffer)
        if not path.exists():
            raise FileNotFoundError(f"Dataset file not found: {path.resolve()}")
        try:
            df = pd.read_csv(path)
        except Exception as e:
            raise ValidationError(f"Failed to parse CSV file: {e}") from e

    # Check for empty dataframe
    if df.empty:
        raise ValidationError("Dataset is empty (0 rows).")

    # 1. Required columns check
    expected_cols = ["timestamp", "session_id"] + ALL_SENSOR_CHANNELS + ["label"]
    missing_cols = [col for col in expected_cols if col not in df.columns]
    if missing_cols:
        raise ValidationError(
            f"Dataset schema missing required columns: {missing_cols}. Expected columns: {expected_cols}"
        )

    # 2. Check data types and convert numeric columns
    numeric_cols = ALL_SENSOR_CHANNELS
    for col in numeric_cols:
        if not pd.api.types.is_numeric_dtype(df[col]):
            try:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            except Exception as e:
                raise ValidationError(f"Column '{col}' cannot be cast to numeric: {e}") from e

    # 3. Range and sanity validation
    # Sensor channels
    for ch in CHANNEL_NAMES:
        valid_mask = df[ch].notna()
        if valid_mask.any():
            ch_min, ch_max = df.loc[valid_mask, ch].min(), df.loc[valid_mask, ch].max()
            v_min, v_max = SENSOR_BOUNDS["sensor_voltage"]
            if ch_min < v_min or ch_max > v_max:
                logger.warning(
                    f"Sensor channel '{ch}' has values outside nominal bounds [{v_min}, {v_max}]: min={ch_min}, max={ch_max}"
                )

    # Temperature
    valid_temp = df["temperature"].notna()
    if valid_temp.any():
        t_min, t_max = df.loc[valid_temp, "temperature"].min(), df.loc[valid_temp, "temperature"].max()
        b_min, b_max = SENSOR_BOUNDS["temperature"]
        if t_min < b_min or t_max > b_max:
            logger.warning(f"Temperature values outside [{b_min}, {b_max}]°C: min={t_min}, max={t_max}")

    # Humidity
    valid_hum = df["humidity"].notna()
    if valid_hum.any():
        h_min, h_max = df.loc[valid_hum, "humidity"].min(), df.loc[valid_hum, "humidity"].max()
        hb_min, hb_max = SENSOR_BOUNDS["humidity"]
        if h_min < hb_min or h_max > hb_max:
            logger.warning(f"Humidity values outside [{hb_min}, {hb_max}]%: min={h_min}, max={h_max}")

    # 4. Label validation
    df["label"] = df["label"].astype(str)
    present_labels = df["label"].unique().tolist()
    unknown_labels = [lbl for lbl in present_labels if lbl not in CLASS_LABELS]
    if unknown_labels:
        logger.warning(f"Dataset contains unknown labels: {unknown_labels}. Known classes: {CLASS_LABELS}")

    return df


def get_dataset_summary(df: pd.DataFrame) -> Dict[str, Any]:
    """Generate statistical summary and data quality metrics for the dataset.

    Args:
        df: Input sensor DataFrame.

    Returns:
        Dictionary containing class balance, missing values, sessions, and channel stats.
    """
    total_samples = len(df)
    class_counts = df["label"].value_counts().to_dict()
    missing_counts = df[ALL_SENSOR_CHANNELS].isna().sum().to_dict()
    total_missing = sum(missing_counts.values())
    total_cells = total_samples * len(ALL_SENSOR_CHANNELS)
    missing_ratio = total_missing / total_cells if total_cells > 0 else 0.0

    session_counts = df["session_id"].nunique()
    classes_per_session = df.groupby("session_id")["label"].nunique().to_dict()

    channel_stats: Dict[str, Dict[str, float]] = {}
    for col in ALL_SENSOR_CHANNELS:
        channel_stats[col] = {
            "mean": float(df[col].mean()) if df[col].notna().any() else 0.0,
            "std": float(df[col].std()) if df[col].notna().any() else 0.0,
            "min": float(df[col].min()) if df[col].notna().any() else 0.0,
            "max": float(df[col].max()) if df[col].notna().any() else 0.0,
        }

    # Imbalance ratio: max_class_count / min_class_count
    counts = list(class_counts.values())
    imbalance_ratio = (max(counts) / min(counts)) if counts and min(counts) > 0 else 1.0

    return {
        "total_samples": total_samples,
        "num_classes": len(class_counts),
        "class_counts": class_counts,
        "imbalance_ratio": round(imbalance_ratio, 3),
        "num_sessions": session_counts,
        "total_missing_values": int(total_missing),
        "missing_value_percentage": round(missing_ratio * 100.0, 2),
        "channel_statistics": channel_stats,
    }


def split_by_session(
    df: pd.DataFrame,
    test_size: float = 0.2,
    random_state: int = RANDOM_SEED,
    feature_cols: Optional[List[str]] = None,
    target_col: str = "label",
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, Dict[str, Any]]:
    """Split dataset by session_id to guarantee zero data leakage between train and test.

    Randomly splitting adjacent sensor time-series rows causes severe optimistic bias
    due to auto-correlation and session drift. This function partitions entire sessions,
    ensuring each class is represented in both train and test partitions without
    any session appearing in both.

    Args:
        df: Input DataFrame with 'session_id', feature columns, and target column.
        test_size: Fraction of sessions allocated to the test set (approximate).
        random_state: Fixed random seed for reproducible partitioning.
        feature_cols: List of feature column names (defaults to ALL_SENSOR_CHANNELS).
        target_col: Name of target label column.

    Returns:
        (X_train, X_test, y_train, y_test, split_metadata)
    """
    if feature_cols is None:
        feature_cols = ALL_SENSOR_CHANNELS

    rng = np.random.default_rng(random_state)
    train_sessions: List[str] = []
    test_sessions: List[str] = []

    # Partition sessions per class to maintain class representation in both sets
    for label, group in df.groupby(target_col):
        unique_sessions = group["session_id"].unique()
        n_sessions = len(unique_sessions)

        if n_sessions <= 1:
            logger.warning(
                f"Class '{label}' has only 1 session ({unique_sessions[0]}). "
                "It will be assigned to train set, so it won't appear in test set."
            )
            train_sessions.extend(unique_sessions)
            continue

        shuffled_sessions = list(unique_sessions)
        rng.shuffle(shuffled_sessions)

        n_test = max(1, int(round(n_sessions * test_size)))
        if n_test >= n_sessions:
            n_test = n_sessions - 1  # Keep at least 1 in train

        test_sessions.extend(shuffled_sessions[:n_test])
        train_sessions.extend(shuffled_sessions[n_test:])

    train_mask = df["session_id"].isin(train_sessions)
    test_mask = df["session_id"].isin(test_sessions)

    train_df = df[train_mask]
    test_df = df[test_mask]

    X_train = train_df[feature_cols].copy()
    y_train = train_df[target_col].copy()

    X_test = test_df[feature_cols].copy()
    y_test = test_df[target_col].copy()

    split_metadata = {
        "random_seed": random_state,
        "test_size_ratio": test_size,
        "n_train_samples": len(X_train),
        "n_test_samples": len(X_test),
        "train_sessions": sorted(train_sessions),
        "test_sessions": sorted(test_sessions),
        "train_class_distribution": y_train.value_counts().to_dict(),
        "test_class_distribution": y_test.value_counts().to_dict(),
    }

    logger.info(
        f"Session-aware split complete: {len(X_train)} train samples ({len(train_sessions)} sessions), "
        f"{len(X_test)} test samples ({len(test_sessions)} sessions)."
    )

    return X_train, X_test, y_train, y_test, split_metadata
