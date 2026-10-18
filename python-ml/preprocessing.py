"""Sensor preprocessing pipeline for the NeuroNose ML Pipeline.

Implements robust missing value imputation, learned outlier clipping,
and standard feature scaling with strict guarantees against data leakage.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)


class SensorPreprocessor(BaseEstimator, TransformerMixin):
    """Complete sensor signal preprocessing pipeline.

    Encapsulates:
    1. Missing value imputation (median learned on training split)
    2. Outlier clipping (percentile bounds learned on training split)
    3. Standard scaling (mean and standard deviation learned on training split)

    Guarantees zero data leakage by saving and re-applying parameters fitted
    only on the training dataset.
    """

    def __init__(
        self,
        impute_strategy: str = "median",
        clip_lower_quantile: float = 0.005,
        clip_upper_quantile: float = 0.995,
        with_mean: bool = True,
        with_std: bool = True,
    ) -> None:
        """Initialize preprocessor with hyperparameters.

        Args:
            impute_strategy: Imputation strategy ('median', 'mean', etc.).
            clip_lower_quantile: Lower quantile threshold for outlier clipping.
            clip_upper_quantile: Upper quantile threshold for outlier clipping.
            with_mean: Whether StandardScaler centers the data.
            with_std: Whether StandardScaler scales the data to unit variance.
        """
        self.impute_strategy = impute_strategy
        self.clip_lower_quantile = clip_lower_quantile
        self.clip_upper_quantile = clip_upper_quantile
        self.with_mean = with_mean
        self.with_std = with_std

        # State learned during fit
        self.is_fitted: bool = False
        self.feature_names_: List[str] = []
        self.clip_lower_bounds_: Optional[np.ndarray] = None
        self.clip_upper_bounds_: Optional[np.ndarray] = None
        self.imputer_: Optional[SimpleImputer] = None
        self.scaler_: Optional[StandardScaler] = None

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Optional[Union[np.ndarray, pd.Series]] = None,
    ) -> "SensorPreprocessor":
        """Fit imputation, clipping bounds, and scaler on training data ONLY.

        Args:
            X: Training feature matrix (shape [n_samples, n_features]).
            y: Optional target labels (ignored).

        Returns:
            self
        """
        if isinstance(X, pd.DataFrame):
            self.feature_names_ = list(X.columns)
            X_mat = X.to_numpy(dtype=np.float64, copy=True)
        else:
            X_mat = np.array(X, dtype=np.float64, copy=True)
            self.feature_names_ = [f"feat_{i}" for i in range(X_mat.shape[1])]

        if X_mat.shape[0] == 0:
            raise ValueError("Cannot fit preprocessor on empty dataset.")

        # 1. Fit Imputer
        self.imputer_ = SimpleImputer(strategy=self.impute_strategy)
        X_imputed = self.imputer_.fit_transform(X_mat)

        # 2. Learn Outlier Clipping Bounds from training data
        self.clip_lower_bounds_ = np.nanquantile(
            X_imputed, self.clip_lower_quantile, axis=0
        )
        self.clip_upper_bounds_ = np.nanquantile(
            X_imputed, self.clip_upper_quantile, axis=0
        )

        # Apply clipping to fit data before fitting scaler
        X_clipped = np.clip(
            X_imputed, self.clip_lower_bounds_, self.clip_upper_bounds_
        )

        # 3. Fit Scaler
        self.scaler_ = StandardScaler(
            with_mean=self.with_mean, with_std=self.with_std
        )
        self.scaler_.fit(X_clipped)

        self.is_fitted = True
        return self

    def transform(
        self, X: Union[np.ndarray, pd.DataFrame]
    ) -> np.ndarray:
        """Apply learned preprocessors to new data (test or inference).

        Args:
            X: Input feature matrix.

        Returns:
            Scaled and normalized feature matrix as a numpy array.
        """
        if not self.is_fitted:
            raise RuntimeError(
                "SensorPreprocessor has not been fitted yet. Call fit() first."
            )

        if isinstance(X, pd.DataFrame):
            X_mat = X.to_numpy(dtype=np.float64, copy=True)
        else:
            X_mat = np.array(X, dtype=np.float64, copy=True)

        if X_mat.ndim == 1:
            X_mat = X_mat.reshape(1, -1)

        if X_mat.shape[1] != len(self.feature_names_):
            raise ValueError(
                f"Feature dimension mismatch: expected {len(self.feature_names_)} features, "
                f"got {X_mat.shape[1]}"
            )

        # 1. Impute using training medians
        X_imputed = self.imputer_.transform(X_mat)

        # 2. Clip using training bounds
        X_clipped = np.clip(
            X_imputed, self.clip_lower_bounds_, self.clip_upper_bounds_
        )

        # 3. Standardize using training mean and scale
        X_scaled = self.scaler_.transform(X_clipped)

        return X_scaled

    def fit_transform(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Optional[Union[np.ndarray, pd.Series]] = None,
    ) -> np.ndarray:
        """Fit to training data and return transformed output."""
        return self.fit(X, y).transform(X)

    def get_feature_names_out(
        self, input_features: Optional[List[str]] = None
    ) -> List[str]:
        """Return names of transformed features."""
        if input_features is not None:
            return list(input_features)
        return list(self.feature_names_)

    def save(self, filepath: Union[str, Path]) -> None:
        """Serialize fitted preprocessor to disk using joblib."""
        if not self.is_fitted:
            raise RuntimeError("Cannot save unfitted preprocessor.")
        target_path = Path(filepath)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self, target_path)
        logger.info(f"SensorPreprocessor saved successfully to {target_path}")

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "SensorPreprocessor":
        """Load serialized preprocessor from disk."""
        target_path = Path(filepath)
        if not target_path.exists():
            raise FileNotFoundError(f"Preprocessor file not found at: {target_path}")
        preprocessor = joblib.load(target_path)
        if not isinstance(preprocessor, cls):
            raise TypeError(
                f"Loaded object is not an instance of {cls.__name__}, got {type(preprocessor)}"
            )
        return preprocessor
