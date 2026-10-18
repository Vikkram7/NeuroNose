"""Inference and prediction module for the NeuroNose ML Pipeline.

Provides high-throughput batch and low-latency single-sample inference.
Features confidence estimation with explicit uncalibrated probability disclaimers
and strict input validation.
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

try:
    from config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        DEFAULT_MODEL_PATH,
        DEFAULT_PREPROCESSOR_PATH,
    )
    from preprocessing import SensorPreprocessor
except ImportError:
    from .config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        DEFAULT_MODEL_PATH,
        DEFAULT_PREPROCESSOR_PATH,
    )
    from .preprocessing import SensorPreprocessor

logger = logging.getLogger(__name__)

CONFIDENCE_DISCLAIMER = (
    "Model confidence is derived from tree-vote frequencies or uncalibrated Platt scaling. "
    "It is NOT a formally calibrated posterior probability."
)


class Predictor:
    """Production inference engine for e-nose sensor classification."""

    def __init__(
        self,
        model_path: Union[str, Path] = DEFAULT_MODEL_PATH,
        preprocessor_path: Union[str, Path] = DEFAULT_PREPROCESSOR_PATH,
    ) -> None:
        """Initialize and load trained model and preprocessor artifacts."""
        self.model_path = Path(model_path)
        self.preprocessor_path = Path(preprocessor_path)

        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file not found: {self.model_path}")
        if not self.preprocessor_path.exists():
            raise FileNotFoundError(f"Preprocessor file not found: {self.preprocessor_path}")

        self.model = joblib.load(self.model_path)
        self.preprocessor = SensorPreprocessor.load(self.preprocessor_path)

        # Cache class names from the model
        if hasattr(self.model, "classes_"):
            self.classes_ = list(self.model.classes_)
        else:
            self.classes_ = []

    def _format_input(
        self, sample: Union[Dict[str, Any], List[float], np.ndarray, pd.Series]
    ) -> np.ndarray:
        """Validate and convert sample input into a standard 2D numpy array [1, n_features]."""
        if isinstance(sample, dict):
            # Check for required channels, default temp/humidity if missing
            row = []
            for ch in CHANNEL_NAMES:
                if ch not in sample:
                    raise ValueError(f"Missing required sensor channel '{ch}' in input dict.")
                row.append(float(sample[ch]))

            temp = sample.get("temperature", 23.0)
            hum = sample.get("humidity", 50.0)
            row.extend([float(temp), float(hum)])
            return np.array([row], dtype=np.float64)

        elif isinstance(sample, (list, tuple, np.ndarray)):
            arr = np.asarray(sample, dtype=np.float64)
            if arr.ndim == 1:
                if len(arr) == len(CHANNEL_NAMES):
                    # Default temp=23.0, hum=50.0 appended
                    arr = np.append(arr, [23.0, 50.0])
                elif len(arr) != len(ALL_SENSOR_CHANNELS):
                    raise ValueError(
                        f"Expected {len(ALL_SENSOR_CHANNELS)} channels or {len(CHANNEL_NAMES)} sensor values, "
                        f"got {len(arr)}"
                    )
                return arr.reshape(1, -1)
            elif arr.ndim == 2:
                if arr.shape[1] == len(CHANNEL_NAMES):
                    aux = np.tile([23.0, 50.0], (arr.shape[0], 1))
                    return np.hstack([arr, aux])
                elif arr.shape[1] != len(ALL_SENSOR_CHANNELS):
                    raise ValueError(
                        f"Expected input with {len(ALL_SENSOR_CHANNELS)} columns, got {arr.shape[1]}"
                    )
                return arr
            else:
                raise ValueError(f"Expected 1D or 2D array, got dimension {arr.ndim}")

        elif isinstance(sample, pd.Series):
            return self._format_input(sample.to_dict())

        else:
            raise TypeError(f"Unsupported sample input type: {type(sample)}")

    def predict_single(
        self, sample: Union[Dict[str, Any], List[float], np.ndarray, pd.Series]
    ) -> Dict[str, Any]:
        """Perform classification inference on a single sensor measurement.

        Args:
            sample: Sensor reading dict or numeric array.

        Returns:
            JSON-serializable prediction result dictionary.
        """
        raw_mat = self._format_input(sample)
        scaled_mat = self.preprocessor.transform(raw_mat)

        pred_label = str(self.model.predict(scaled_mat)[0])

        probabilities: Dict[str, float] = {}
        confidence = 1.0

        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(scaled_mat)[0]
            for cls_name, prob_val in zip(self.classes_, probs):
                probabilities[str(cls_name)] = round(float(prob_val), 4)
            confidence = round(float(np.max(probs)), 4)
        else:
            probabilities[pred_label] = 1.0

        return {
            "predicted_class": pred_label,
            "confidence": confidence,
            "probabilities": probabilities,
            "calibrated": False,
            "confidence_note": CONFIDENCE_DISCLAIMER,
        }

    def predict_batch(
        self, samples: Union[pd.DataFrame, List[Dict[str, Any]], np.ndarray]
    ) -> List[Dict[str, Any]]:
        """Perform batch classification on multiple sensor readings.

        Args:
            samples: DataFrame, list of dicts, or 2D array.

        Returns:
            List of prediction result dictionaries.
        """
        if isinstance(samples, pd.DataFrame):
            if samples.empty:
                return []
            # Ensure columns exist
            for ch in CHANNEL_NAMES:
                if ch not in samples.columns:
                    raise ValueError(f"Missing required sensor column '{ch}' in DataFrame")

            features_df = samples.copy()
            if "temperature" not in features_df.columns:
                features_df["temperature"] = 23.0
            if "humidity" not in features_df.columns:
                features_df["humidity"] = 50.0

            raw_mat = features_df[ALL_SENSOR_CHANNELS].to_numpy(dtype=np.float64)
        elif isinstance(samples, list):
            if not samples:
                return []
            raw_mat = np.vstack([self._format_input(s) for s in samples])
        elif isinstance(samples, np.ndarray):
            raw_mat = self._format_input(samples)
        else:
            raise TypeError(f"Unsupported batch input type: {type(samples)}")

        scaled_mat = self.preprocessor.transform(raw_mat)
        pred_labels = self.model.predict(scaled_mat)

        if hasattr(self.model, "predict_proba"):
            all_probs = self.model.predict_proba(scaled_mat)
        else:
            all_probs = None

        results: List[Dict[str, Any]] = []
        for i in range(len(pred_labels)):
            pred_label = str(pred_labels[i])
            probabilities: Dict[str, float] = {}
            if all_probs is not None:
                probs = all_probs[i]
                for cls_name, p in zip(self.classes_, probs):
                    probabilities[str(cls_name)] = round(float(p), 4)
                conf = round(float(np.max(probs)), 4)
            else:
                probabilities[pred_label] = 1.0
                conf = 1.0

            results.append({
                "index": i,
                "predicted_class": pred_label,
                "confidence": conf,
                "probabilities": probabilities,
                "calibrated": False,
                "confidence_note": CONFIDENCE_DISCLAIMER,
            })

        return results


def main():
    parser = argparse.ArgumentParser(description="Run NeuroNose inference.")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL_PATH), help="Model file path")
    parser.add_argument("--preprocessor", type=str, default=str(DEFAULT_PREPROCESSOR_PATH), help="Preprocessor path")
    parser.add_argument(
        "--sample-json",
        type=str,
        default=None,
        help="JSON string with sensor channels, e.g. '{\"ch0\": 1.1, \"ch1\": 3.5, ...}'",
    )
    args = parser.parse_args()

    predictor = Predictor(model_path=args.model, preprocessor_path=args.preprocessor)

    if args.sample_json:
        sample_dict = json.loads(args.sample_json)
        result = predictor.predict_single(sample_dict)
    else:
        # Default test vector (coffee aroma fingerprint)
        sample_dict = {
            "ch0": 1.15, "ch1": 3.55, "ch2": 1.45, "ch3": 3.85,
            "ch4": 2.95, "ch5": 1.25, "ch6": 2.05, "ch7": 1.65,
            "temperature": 27.5, "humidity": 62.0,
        }
        print("[INFO] No sample provided. Running inference on coffee aroma test sample:")
        result = predictor.predict_single(sample_dict)

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
