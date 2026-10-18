"""Unit tests for preprocessing.py."""

import numpy as np
import pandas as pd
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from preprocessing import SensorPreprocessor


def test_scaler_fits_on_train_only():
    """Verify that transformation parameters are strictly derived from train data."""
    X_train = np.array([
        [1.0, 10.0],
        [2.0, 20.0],
        [3.0, 30.0],
    ])
    X_test = np.array([
        [10.0, 100.0],
    ])

    preprocessor = SensorPreprocessor()
    preprocessor.fit(X_train)

    # Expected train mean before clipping: [2.0, 20.0]
    # Check that preprocessor scaler center matches training distribution
    assert preprocessor.scaler_ is not None
    np.testing.assert_allclose(preprocessor.scaler_.mean_, [2.0, 20.0], atol=1e-2)

    # Transforming test data should use train mean (2.0) and train std
    X_test_scaled = preprocessor.transform(X_test)
    assert X_test_scaled.shape == (1, 2)
    # Since 10.0 > train max, it should be clipped to train upper bound and standardized
    assert X_test_scaled[0, 0] > 0.0


def test_missing_value_handling():
    """Verify that missing values (NaNs) are imputed without crashing or returning NaNs."""
    X_train = np.array([
        [1.0, 5.0],
        [np.nan, 5.0],
        [3.0, np.nan],
        [2.0, 5.0],
    ])
    preprocessor = SensorPreprocessor()
    X_scaled = preprocessor.fit_transform(X_train)

    assert not np.isnan(X_scaled).any()
    assert X_scaled.shape == (4, 2)


def test_output_shapes_and_save_load(tmp_path):
    """Verify output shapes with DataFrame input and test persistence round-trip."""
    df_train = pd.DataFrame({
        "s0": [1.0, 2.0, 3.0, 4.0, 5.0],
        "s1": [10.0, 20.0, 30.0, 40.0, 50.0],
        "s2": [0.5, 0.6, 0.7, 0.8, 0.9],
    })

    preprocessor = SensorPreprocessor()
    train_trans = preprocessor.fit_transform(df_train)

    assert train_trans.shape == (5, 3)

    # Save and reload
    save_file = tmp_path / "preprocessor.joblib"
    preprocessor.save(save_file)
    reloaded = SensorPreprocessor.load(save_file)

    assert reloaded.is_fitted is True
    test_sample = np.array([[3.0, 30.0, 0.7]])
    orig_res = preprocessor.transform(test_sample)
    reloaded_res = reloaded.transform(test_sample)
    np.testing.assert_allclose(orig_res, reloaded_res)


def test_unfitted_transform_raises():
    """Verify that calling transform before fit raises RuntimeError."""
    preprocessor = SensorPreprocessor()
    with pytest.raises(RuntimeError):
        preprocessor.transform(np.array([[1.0, 2.0]]))
