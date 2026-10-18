"""Feature engineering and extraction for the NeuroNose ML Pipeline.

Extracts statistical, cross-channel, and temporal features from multi-channel
e-nose sensor arrays. Supports both instantaneous multi-channel fingerprint
representation and windowed time-series analysis.
"""

from __future__ import annotations

import logging
from typing import List, Optional, Union
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.decomposition import PCA

try:
    from config import CHANNEL_NAMES, NUM_CHANNELS
except ImportError:
    from .config import CHANNEL_NAMES, NUM_CHANNELS

logger = logging.getLogger(__name__)


def compute_zero_crossing_rate(arr: np.ndarray) -> float:
    """Compute zero-crossing rate (around the signal mean) of a 1D sequence."""
    if len(arr) <= 1:
        return 0.0
    centered = arr - np.mean(arr)
    crossings = np.sum(np.diff(np.signbit(centered)) != 0)
    return float(crossings / (len(arr) - 1))


class SensorFeatureExtractor(BaseEstimator, TransformerMixin):
    """Scikit-learn compatible feature extractor for e-nose sensor data.

    Extracts:
    - Raw channel levels
    - Spatial cross-channel statistics: mean, std, min, max, range, total energy
    - Relative channel ratios (channel normalized by array mean)
    - PCA projection components across the 8 sensor channels
    - Cross-channel pairwise interaction / contrast features
    """

    def __init__(
        self,
        n_pca_components: int = 3,
        include_ratios: bool = True,
        include_channel_stats: bool = True,
    ) -> None:
        """Initialize feature extractor.

        Args:
            n_pca_components: Number of PCA components to fit on sensor channels.
            include_ratios: Whether to compute channel / mean-array ratios.
            include_channel_stats: Whether to include cross-channel statistical summaries.
        """
        self.n_pca_components = n_pca_components
        self.include_ratios = include_ratios
        self.include_channel_stats = include_channel_stats

        self.pca_: Optional[PCA] = None
        self.feature_names_: List[str] = []
        self.is_fitted: bool = False

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Optional[Union[np.ndarray, pd.Series]] = None,
    ) -> "SensorFeatureExtractor":
        """Fit PCA and determine feature column names from training data.

        Args:
            X: Input feature matrix (must have at least 8 sensor channels).
            y: Ignored.

        Returns:
            self
        """
        if isinstance(X, pd.DataFrame):
            # If named columns include ch0-ch7, extract them
            if all(ch in X.columns for ch in CHANNEL_NAMES):
                sensor_data = X[CHANNEL_NAMES].to_numpy(dtype=np.float64)
            else:
                sensor_data = X.iloc[:, :NUM_CHANNELS].to_numpy(dtype=np.float64)
        else:
            sensor_data = np.asarray(X, dtype=np.float64)[:, :NUM_CHANNELS]

        # Handle NaNs if any during fit
        nan_mask = np.isnan(sensor_data)
        if nan_mask.any():
            col_means = np.nanmean(sensor_data, axis=0)
            col_means = np.nan_to_num(col_means, nan=1.0)
            for c in range(sensor_data.shape[1]):
                sensor_data[nan_mask[:, c], c] = col_means[c]

        # Fit PCA on the 8 sensor channels
        n_comp = min(self.n_pca_components, sensor_data.shape[1], sensor_data.shape[0])
        self.pca_ = PCA(n_components=n_comp, random_state=42)
        self.pca_.fit(sensor_data)

        # Generate output feature names
        names = []
        if isinstance(X, pd.DataFrame):
            names.extend(list(X.columns))
        else:
            names.extend([f"raw_feat_{i}" for i in range(np.asarray(X).shape[1])])

        if self.include_channel_stats:
            names.extend([
                "sensor_array_mean",
                "sensor_array_std",
                "sensor_array_min",
                "sensor_array_max",
                "sensor_array_range",
                "sensor_array_energy",
            ])

        if self.include_ratios:
            for i in range(NUM_CHANNELS):
                names.append(f"ch{i}_rel_ratio")

        for k in range(n_comp):
            names.append(f"sensor_pca_{k}")

        self.feature_names_ = names
        self.is_fitted = True
        return self

    def transform(
        self, X: Union[np.ndarray, pd.DataFrame]
    ) -> pd.DataFrame:
        """Extract all engineered features.

        Args:
            X: Input feature matrix or DataFrame.

        Returns:
            DataFrame with enriched feature columns.
        """
        if not self.is_fitted:
            raise RuntimeError("SensorFeatureExtractor must be fitted before transforming.")

        if isinstance(X, pd.DataFrame):
            raw_df = X.copy().reset_index(drop=True)
            if all(ch in raw_df.columns for ch in CHANNEL_NAMES):
                sensor_data = raw_df[CHANNEL_NAMES].to_numpy(dtype=np.float64)
            else:
                sensor_data = raw_df.iloc[:, :NUM_CHANNELS].to_numpy(dtype=np.float64)
        else:
            arr = np.asarray(X, dtype=np.float64)
            raw_cols = [f"raw_feat_{i}" for i in range(arr.shape[1])]
            raw_df = pd.DataFrame(arr, columns=raw_cols)
            sensor_data = arr[:, :NUM_CHANNELS]

        # Handle NaNs during transform safely
        clean_sensor_data = np.copy(sensor_data)
        nan_mask = np.isnan(clean_sensor_data)
        if nan_mask.any():
            col_means = np.nanmean(clean_sensor_data, axis=0)
            col_means = np.nan_to_num(col_means, nan=1.0)
            for c in range(clean_sensor_data.shape[1]):
                clean_sensor_data[nan_mask[:, c], c] = col_means[c]

        extra_features: List[pd.Series] = []

        # 1. Cross-channel summary statistics
        if self.include_channel_stats:
            mean_vals = np.mean(clean_sensor_data, axis=1)
            std_vals = np.std(clean_sensor_data, axis=1)
            min_vals = np.min(clean_sensor_data, axis=1)
            max_vals = np.max(clean_sensor_data, axis=1)
            range_vals = max_vals - min_vals
            energy_vals = np.mean(clean_sensor_data ** 2, axis=1)

            extra_features.append(pd.Series(mean_vals, name="sensor_array_mean"))
            extra_features.append(pd.Series(std_vals, name="sensor_array_std"))
            extra_features.append(pd.Series(min_vals, name="sensor_array_min"))
            extra_features.append(pd.Series(max_vals, name="sensor_array_max"))
            extra_features.append(pd.Series(range_vals, name="sensor_array_range"))
            extra_features.append(pd.Series(energy_vals, name="sensor_array_energy"))

            # 2. Relative ratios
            if self.include_ratios:
                eps = 1e-6
                for i in range(NUM_CHANNELS):
                    ratio = clean_sensor_data[:, i] / (mean_vals + eps)
                    extra_features.append(pd.Series(ratio, name=f"ch{i}_rel_ratio"))

        # 3. PCA Components
        if self.pca_ is not None:
            pca_proj = self.pca_.transform(clean_sensor_data)
            for k in range(pca_proj.shape[1]):
                extra_features.append(pd.Series(pca_proj[:, k], name=f"sensor_pca_{k}"))

        if extra_features:
            features_df = pd.concat([raw_df] + extra_features, axis=1)
        else:
            features_df = raw_df

        return features_df

    def get_feature_names_out(self, input_features: Optional[List[str]] = None) -> List[str]:
        """Return the names of the extracted features."""
        return list(self.feature_names_)


def extract_windowed_features(
    df: pd.DataFrame,
    window_size: int = 10,
    step_size: int = 5,
    channels: Optional[List[str]] = None,
) -> pd.DataFrame:
    """Extract temporal statistical features across sliding windows for time-series analysis.

    For each sensor channel within a window, computes:
    - mean
    - standard deviation (std)
    - min and max
    - range (max - min)
    - signal energy
    - mean-crossing rate
    - rate of change (slope/diff mean)

    Args:
        df: Input DataFrame containing sensor time-series with 'session_id' and 'label'.
        window_size: Number of consecutive time-steps in each sliding window.
        step_size: Stride between successive sliding windows.
        channels: List of sensor channel names (defaults to CHANNEL_NAMES).

    Returns:
        DataFrame with one row per sliding window containing all engineered features.
    """
    if channels is None:
        channels = CHANNEL_NAMES

    window_records = []

    # Group by session to ensure windows never cross session boundaries
    for session_id, session_group in df.groupby("session_id"):
        session_group = session_group.reset_index(drop=True)
        n_rows = len(session_group)

        if n_rows < window_size:
            continue

        for start_idx in range(0, n_rows - window_size + 1, step_size):
            end_idx = start_idx + window_size
            window = session_group.iloc[start_idx:end_idx]

            record = {
                "session_id": session_id,
                "label": window["label"].iloc[-1],
                "timestamp_start": window["timestamp"].iloc[0],
                "timestamp_end": window["timestamp"].iloc[-1],
            }

            # Auxiliary features: mean temperature and humidity in window
            if "temperature" in window.columns:
                record["temp_mean"] = float(window["temperature"].mean())
            if "humidity" in window.columns:
                record["hum_mean"] = float(window["humidity"].mean())

            # Channel statistics
            for ch in channels:
                sig = window[ch].to_numpy(dtype=np.float64)
                # Impute NaNs in window with channel mean if any
                if np.isnan(sig).any():
                    m = np.nanmean(sig)
                    sig = np.nan_to_num(sig, nan=m if not np.isnan(m) else 0.0)

                ch_mean = float(np.mean(sig))
                ch_std = float(np.std(sig))
                ch_min = float(np.min(sig))
                ch_max = float(np.max(sig))
                ch_range = ch_max - ch_min
                ch_energy = float(np.mean(sig ** 2))
                ch_zcr = compute_zero_crossing_rate(sig)
                ch_slope = float(np.mean(np.diff(sig))) if len(sig) > 1 else 0.0

                record[f"{ch}_mean"] = ch_mean
                record[f"{ch}_std"] = ch_std
                record[f"{ch}_min"] = ch_min
                record[f"{ch}_max"] = ch_max
                record[f"{ch}_range"] = ch_range
                record[f"{ch}_energy"] = ch_energy
                record[f"{ch}_zcr"] = ch_zcr
                record[f"{ch}_slope"] = ch_slope

            window_records.append(record)

    return pd.DataFrame(window_records)
