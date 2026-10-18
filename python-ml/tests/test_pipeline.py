"""Integration tests for the complete NeuroNose ML Pipeline."""

import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import ALL_SENSOR_CHANNELS, CHANNEL_NAMES, CLASS_LABELS
from dataset_loader import split_by_session
from drift_detector import DriftDetector
from novelty_detector import NoveltyDetector
from predict import Predictor
from preprocessing import SensorPreprocessor
from rtl_reference import generate_rtl_test_vectors, verify_test_vectors
from sensor_data_generator import generate_dataset
from train_model import build_classifier, train_pipeline


def test_full_pipeline_flow(tmp_path):
    """Integration test: Generate data -> preprocess -> train -> predict."""
    # 1. Generate small dataset
    csv_path = tmp_path / "test_sensor_data.csv"
    df = generate_dataset(n_samples_per_class=35, noise_level=0.08, seed=42)
    df.to_csv(csv_path, index=False)

    model_path = tmp_path / "rf_model.joblib"
    prep_path = tmp_path / "preprocessor.joblib"
    novel_path = tmp_path / "novelty.joblib"
    meta_path = tmp_path / "metadata.json"

    # 2. Train pipeline
    res = train_pipeline(
        data_path=csv_path,
        model_type="rf",
        test_size=0.25,
        model_save_path=model_path,
        preprocessor_save_path=prep_path,
        novelty_save_path=novel_path,
        metadata_save_path=meta_path,
        random_seed=42,
    )

    assert model_path.exists()
    assert prep_path.exists()
    assert meta_path.exists()

    # 3. Predictor inference
    predictor = Predictor(model_path=model_path, preprocessor_path=prep_path)

    # Test single prediction
    sample_dict = {
        "ch0": 1.15, "ch1": 3.55, "ch2": 1.45, "ch3": 3.85,
        "ch4": 2.95, "ch5": 1.25, "ch6": 2.05, "ch7": 1.65,
        "temperature": 27.0, "humidity": 60.0,
    }
    single_out = predictor.predict_single(sample_dict)

    assert "predicted_class" in single_out
    assert single_out["predicted_class"] == "coffee_aroma"
    assert "confidence" in single_out
    assert single_out["confidence"] > 0.5
    assert "probabilities" in single_out
    assert len(single_out["probabilities"]) == len(CLASS_LABELS)

    # Test batch prediction
    batch_out = predictor.predict_batch([sample_dict, sample_dict])
    assert len(batch_out) == 2
    assert batch_out[0]["predicted_class"] == "coffee_aroma"


def test_novelty_detector_flow():
    """Integration test: Verify novelty detector accepts known samples and rejects OOD patterns."""
    X_train = np.random.default_rng(42).normal(loc=0.0, scale=1.0, size=(100, 10))
    detector = NoveltyDetector(contamination=0.02, threshold=0.0, random_state=42)
    detector.fit(X_train)

    # In-distribution sample
    in_dist = np.zeros(10)
    in_res = detector.evaluate_sample(in_dist)
    assert in_res["is_known"] is True

    # Extreme Out-Of-Distribution (OOD) sample
    ood_sample = np.ones(10) * 50.0
    ood_res = detector.evaluate_sample(ood_sample)
    assert ood_res["is_known"] is False
    assert ood_res["status"] == "novel_unknown_odor"


def test_drift_detector_flow():
    """Integration test: Verify drift detector flags significant distribution shifts."""
    rng = np.random.default_rng(42)
    ref_data = rng.normal(loc=1.0, scale=0.1, size=(50, 8))

    drift_detector = DriftDetector(channel_names=CHANNEL_NAMES)
    drift_detector.fit_reference(ref_data)

    # Similar data window -> No drift
    stable_window = rng.normal(loc=1.0, scale=0.1, size=(30, 8))
    stable_res = drift_detector.check_drift(stable_window)
    assert stable_res["drift_detected"] is False

    # Shifted data window (severe drift on ch0)
    drifted_window = np.copy(stable_window)
    drifted_window[:, 0] += 2.5
    drift_res = drift_detector.check_drift(drifted_window)
    assert drift_res["drift_detected"] is True
    assert "ch0" in drift_res["drift_channels"]


def test_rtl_reference_bit_exact(tmp_path):
    """Integration test: RTL reference model and test vector verification."""
    vec_path = tmp_path / "test_vectors.csv"
    generate_rtl_test_vectors(vec_path, n_samples=40)
    res = verify_test_vectors(vec_path)

    assert res["bit_exact"] is True
    assert res["filter_match_rate"] == 1.0
    assert res["corrector_match_rate"] == 1.0
    assert res["classifier_match_rate"] == 1.0
