"""Unit tests for sensor_data_generator.py."""

import numpy as np
import pandas as pd
import pytest
import sys
from pathlib import Path

# Add python-ml directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import CHANNEL_NAMES, CLASS_LABELS
from sensor_data_generator import generate_dataset, generate_streaming_sample


def test_reproducibility():
    """Verify that using the same seed produces bit-identical DataFrame outputs."""
    df1 = generate_dataset(n_samples_per_class=30, seed=123)
    df2 = generate_dataset(n_samples_per_class=30, seed=123)
    pd.testing.assert_frame_equal(df1, df2)


def test_different_seeds():
    """Verify that different seeds produce different outputs."""
    df1 = generate_dataset(n_samples_per_class=20, seed=42)
    df2 = generate_dataset(n_samples_per_class=20, seed=999)
    assert not df1[CHANNEL_NAMES].equals(df2[CHANNEL_NAMES])


def test_sample_counts_and_classes():
    """Verify sample counts per class and that all classes are present."""
    n_per_class = 25
    df = generate_dataset(n_samples_per_class=n_per_class, seed=42)

    assert len(df) == n_per_class * len(CLASS_LABELS)
    counts = df["label"].value_counts()
    for cls in CLASS_LABELS:
        assert cls in counts
        assert counts[cls] == n_per_class


def test_value_ranges():
    """Verify that physical sensor channels and aux readings stay within physical bounds."""
    df = generate_dataset(n_samples_per_class=40, seed=42)

    # Sensor voltages should be strictly positive and realistic (e.g. 0.0 to 10.0 V)
    for ch in CHANNEL_NAMES:
        valid_vals = df[ch].dropna()
        assert (valid_vals >= 0.0).all()
        assert (valid_vals <= 10.0).all()

    # Temperature and humidity
    assert (df["temperature"] >= -10.0).all()
    assert (df["temperature"] <= 60.0).all()
    assert (df["humidity"] >= 5.0).all()
    assert (df["humidity"] <= 100.0).all()


def test_synthetic_metadata():
    """Verify that synthetic data is explicitly tagged in metadata attribute."""
    df = generate_dataset(n_samples_per_class=10, seed=42)
    assert df.attrs.get("is_synthetic") is True


def test_streaming_sample():
    """Verify single streaming sample generation."""
    sample = generate_streaming_sample("coffee_aroma", noise=0.01, seed=42)
    assert sample["is_synthetic"] is True
    assert sample["label"] == "coffee_aroma"
    assert "temperature" in sample
    assert "humidity" in sample
    for ch in CHANNEL_NAMES:
        assert ch in sample
        assert sample[ch] > 0.0

    with pytest.raises(ValueError):
        generate_streaming_sample("invalid_class_xyz")
