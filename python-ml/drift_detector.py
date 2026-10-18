"""Sensor drift and distribution shift detector for the NeuroNose ML Pipeline.

Monitors sensor aging, chemical contamination, and environmental baseline drift
over time using running statistical moments and two-sample Kolmogorov-Smirnov (KS) tests.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

try:
    from config import ALL_SENSOR_CHANNELS, CHANNEL_NAMES
except ImportError:
    from .config import ALL_SENSOR_CHANNELS, CHANNEL_NAMES

logger = logging.getLogger(__name__)


class DriftDetector:
    """Detects multi-channel sensor baseline and distribution drift."""

    def __init__(
        self,
        p_value_threshold: float = 0.05,
        z_score_threshold: float = 2.0,
        channel_names: Optional[List[str]] = None,
    ) -> None:
        """Initialize drift detector.

        Args:
            p_value_threshold: Significance level below which the null hypothesis
                               (distributions identical) is rejected.
            z_score_threshold: Normalized mean shift (|mean_curr - mean_ref| / std_ref)
                               required to flag physical baseline drift.
            channel_names: List of channel names to monitor (defaults to CHANNEL_NAMES).
        """
        self.p_value_threshold = p_value_threshold
        self.z_score_threshold = z_score_threshold
        self.channel_names = channel_names or list(CHANNEL_NAMES)

        self.reference_data_: Optional[np.ndarray] = None
        self.ref_means_: Optional[np.ndarray] = None
        self.ref_stds_: Optional[np.ndarray] = None
        self.is_fitted: bool = False

    def fit_reference(self, reference_data: Union[np.ndarray, pd.DataFrame]) -> "DriftDetector":
        """Store reference baseline distribution from calibrated pristine sensor state.

        Args:
            reference_data: Initial calibration dataset [N, n_channels].

        Returns:
            self
        """
        if isinstance(reference_data, pd.DataFrame):
            ref_mat = reference_data[self.channel_names].to_numpy(dtype=np.float64)
        else:
            ref_mat = np.asarray(reference_data, dtype=np.float64)
            if ref_mat.shape[1] > len(self.channel_names):
                ref_mat = ref_mat[:, :len(self.channel_names)]

        if ref_mat.shape[0] < 10:
            raise ValueError(
                f"Reference dataset too small ({ref_mat.shape[0]} samples). Need at least 10 samples."
            )

        # Impute NaNs if any
        nan_mask = np.isnan(ref_mat)
        if nan_mask.any():
            col_means = np.nanmean(ref_mat, axis=0)
            for c in range(ref_mat.shape[1]):
                ref_mat[nan_mask[:, c], c] = col_means[c]

        self.reference_data_ = ref_mat
        self.ref_means_ = np.mean(ref_mat, axis=0)
        self.ref_stds_ = np.std(ref_mat, axis=0)
        # Avoid zero std
        self.ref_stds_ = np.where(self.ref_stds_ < 1e-4, 1e-4, self.ref_stds_)

        self.is_fitted = True
        logger.info(f"DriftDetector reference fitted on {len(ref_mat)} samples across {len(self.channel_names)} channels.")
        return self

    def check_drift(
        self, current_data: Union[np.ndarray, pd.DataFrame]
    ) -> Dict[str, Any]:
        """Perform two-sample KS hypothesis test and mean shift analysis against reference baseline.

        Args:
            current_data: Recent sensor measurement window [M, n_channels].

        Returns:
            Dictionary containing:
            - drift_detected: bool (True if significant drift detected in one or more channels)
            - drift_channels: list of channel names with detected drift
            - drift_magnitude: dict mapping channel name to standardized mean shift
            - p_values: dict mapping channel name to KS test p-value
            - ks_statistics: dict mapping channel name to KS test statistic
        """
        if not self.is_fitted:
            raise RuntimeError("DriftDetector has not been fitted with a reference baseline.")

        if isinstance(current_data, pd.DataFrame):
            curr_mat = current_data[self.channel_names].to_numpy(dtype=np.float64)
        else:
            curr_mat = np.asarray(current_data, dtype=np.float64)
            if curr_mat.shape[1] > len(self.channel_names):
                curr_mat = curr_mat[:, :len(self.channel_names)]

        if curr_mat.ndim == 1:
            curr_mat = curr_mat.reshape(1, -1)

        if curr_mat.shape[0] < 5:
            raise ValueError(
                f"Current window too small ({curr_mat.shape[0]} samples). Need at least 5 samples for drift testing."
            )

        # Impute NaNs in current window
        nan_mask = np.isnan(curr_mat)
        if nan_mask.any():
            col_means = np.nanmean(curr_mat, axis=0)
            for c in range(curr_mat.shape[1]):
                curr_mat[nan_mask[:, c], c] = col_means[c]

        drift_channels: List[str] = []
        drift_magnitude: Dict[str, float] = {}
        p_values: Dict[str, float] = {}
        ks_stats: Dict[str, float] = {}

        curr_means = np.mean(curr_mat, axis=0)

        for idx, ch_name in enumerate(self.channel_names):
            ref_ch = self.reference_data_[:, idx]
            curr_ch = curr_mat[:, idx]

            # 1. Kolmogorov-Smirnov 2-sample test
            ks_res = ks_2samp(ref_ch, curr_ch)
            ks_stat = float(ks_res.statistic)
            p_val = float(ks_res.pvalue)

            # 2. Standardized mean shift (z-score)
            mean_shift_z = abs(curr_means[idx] - self.ref_means_[idx]) / self.ref_stds_[idx]

            ks_stats[ch_name] = round(ks_stat, 4)
            p_values[ch_name] = round(p_val, 6)
            drift_magnitude[ch_name] = round(float(mean_shift_z), 4)

            # Drift is flagged if KS rejects equality AND magnitude exceeds threshold
            if p_val < self.p_value_threshold and mean_shift_z >= self.z_score_threshold:
                drift_channels.append(ch_name)

        drift_detected = len(drift_channels) > 0

        return {
            "drift_detected": drift_detected,
            "drift_channels": drift_channels,
            "drift_magnitude": drift_magnitude,
            "p_values": p_values,
            "ks_statistics": ks_stats,
            "n_reference_samples": len(self.reference_data_),
            "n_current_samples": len(curr_mat),
        }
