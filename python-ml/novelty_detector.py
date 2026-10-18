"""Novelty and anomaly detection module for the NeuroNose ML Pipeline.

Implements unknown odor and anomalous pattern rejection using Isolation Forest.
Protects downstream classification models from out-of-distribution (OOD)
chemical signatures and unexpected environmental interference.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

try:
    from config import DEFAULT_NOVELTY_PATH, RANDOM_SEED
except ImportError:
    from .config import DEFAULT_NOVELTY_PATH, RANDOM_SEED

logger = logging.getLogger(__name__)


class NoveltyDetector:
    """Out-of-distribution (OOD) pattern detector for multi-channel sensor arrays."""

    def __init__(
        self,
        contamination: float = 0.03,
        threshold: float = 0.0,
        random_state: int = RANDOM_SEED,
    ) -> None:
        """Initialize novelty detector.

        Args:
            contamination: Expected proportion of outliers in the training data.
            threshold: Decision boundary threshold for novelty classification.
                       Values < threshold are classified as unknown/anomalous.
            random_state: Deterministic random seed for reproducibility.
        """
        self.contamination = contamination
        self.threshold = threshold
        self.random_state = random_state
        self.model: IsolationForest = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )
        self.is_fitted: bool = False

    def fit(self, X: Union[np.ndarray, pd.DataFrame]) -> "NoveltyDetector":
        """Fit Isolation Forest on known in-distribution sensor data.

        Args:
            X: Standardized sensor training feature matrix.

        Returns:
            self
        """
        X_mat = np.asarray(X, dtype=np.float64)
        if X_mat.ndim == 1:
            X_mat = X_mat.reshape(1, -1)
        if X_mat.shape[0] < 5:
            raise ValueError(f"Need at least 5 samples to fit NoveltyDetector, got {X_mat.shape[0]}")

        self.model.fit(X_mat)
        self.is_fitted = True
        return self

    def score_samples(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        """Compute decision function anomaly scores for input samples.

        Higher scores correspond to typical/known samples. Lower or negative
        scores correspond to novel or anomalous patterns.
        """
        if not self.is_fitted:
            raise RuntimeError("NoveltyDetector must be fitted before scoring.")
        X_mat = np.asarray(X, dtype=np.float64)
        if X_mat.ndim == 1:
            X_mat = X_mat.reshape(1, -1)
        return self.model.decision_function(X_mat)

    def evaluate_sample(
        self, sample: Union[np.ndarray, List[float], Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Evaluate a single sample for novelty/anomaly.

        Args:
            sample: Standardized sensor feature vector or dict.

        Returns:
            Dictionary with keys:
            - is_known: bool (True if sample matches known distribution)
            - novelty_score: float (decision function score)
            - threshold: float (decision threshold applied)
            - status: str ('known_odor' or 'novel_unknown_odor')
        """
        if isinstance(sample, dict):
            # If a dict is provided, extract values in sorted key order or values list
            val_arr = np.array(list(sample.values()), dtype=np.float64)
        else:
            val_arr = np.asarray(sample, dtype=np.float64)

        if val_arr.ndim == 1:
            val_arr = val_arr.reshape(1, -1)

        score = float(self.score_samples(val_arr)[0])
        is_known = bool(score >= self.threshold)

        return {
            "is_known": is_known,
            "novelty_score": round(score, 4),
            "threshold": self.threshold,
            "status": "known_odor" if is_known else "novel_unknown_odor",
        }

    def evaluate_batch(
        self, X: Union[np.ndarray, pd.DataFrame]
    ) -> List[Dict[str, Any]]:
        """Evaluate a batch of samples for novelty/anomaly."""
        scores = self.score_samples(X)
        results = []
        for i, score in enumerate(scores):
            s = float(score)
            known = bool(s >= self.threshold)
            results.append({
                "index": i,
                "is_known": known,
                "novelty_score": round(s, 4),
                "threshold": self.threshold,
                "status": "known_odor" if known else "novel_unknown_odor",
            })
        return results

    def save(self, filepath: Union[str, Path] = DEFAULT_NOVELTY_PATH) -> None:
        """Save fitted novelty detector to disk."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted NoveltyDetector.")
        p = Path(filepath)
        p.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, p)
        logger.info(f"NoveltyDetector saved to: {p}")

    @classmethod
    def load(cls, filepath: Union[str, Path] = DEFAULT_NOVELTY_PATH) -> "NoveltyDetector":
        """Load fitted novelty detector from disk."""
        p = Path(filepath)
        if not p.exists():
            raise FileNotFoundError(f"NoveltyDetector file not found: {p}")
        obj = joblib.load(p)
        if isinstance(obj, IsolationForest):
            # Wrapped raw IsolationForest instance
            detector = cls()
            detector.model = obj
            detector.is_fitted = True
            return detector
        elif isinstance(obj, cls):
            return obj
        else:
            raise TypeError(f"Unrecognized object type in {p}: {type(obj)}")


def main():
    parser = argparse.ArgumentParser(description="Test novelty detection.")
    parser.add_argument("--detector", type=str, default=str(DEFAULT_NOVELTY_PATH), help="Detector path")
    args = parser.parse_args()

    detector = NoveltyDetector.load(args.detector)
    # Test with normal sample vs extreme outlier
    normal_sample = np.zeros(10)
    anomalous_sample = np.ones(10) * 15.0

    print("Normal sample:", detector.evaluate_sample(normal_sample))
    print("Anomalous sample:", detector.evaluate_sample(anomalous_sample))


if __name__ == "__main__":
    main()
