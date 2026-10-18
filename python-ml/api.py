"""Flask REST API for the NeuroNose ML Pipeline.

Provides production-ready inference, batch processing, out-of-distribution (novelty)
rejection, and sensor drift detection endpoints with full schema validation and CORS.
"""

from __future__ import annotations

from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from flask import Flask, jsonify, request
from flask_cors import CORS
import numpy as np
import pandas as pd

try:
    from config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        CLASS_LABELS,
        DEFAULT_METADATA_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_NOVELTY_PATH,
        DEFAULT_PREPROCESSOR_PATH,
    )
    from drift_detector import DriftDetector
    from novelty_detector import NoveltyDetector
    from predict import Predictor
except ImportError:
    from .config import (
        ALL_SENSOR_CHANNELS,
        CHANNEL_NAMES,
        CLASS_LABELS,
        DEFAULT_METADATA_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_NOVELTY_PATH,
        DEFAULT_PREPROCESSOR_PATH,
    )
    from .drift_detector import DriftDetector
    from .novelty_detector import NoveltyDetector
    from .predict import Predictor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask("neuronose_api")
CORS(app)  # Enable Cross-Origin Resource Sharing for frontend web applications

# Service state
_predictor: Optional[Predictor] = None
_novelty_detector: Optional[NoveltyDetector] = None
_drift_detector: Optional[DriftDetector] = None
_training_metadata: Optional[Dict[str, Any]] = None


def get_predictor() -> Predictor:
    """Lazy-load and cache Predictor instance."""
    global _predictor
    if _predictor is None:
        logger.info("Initializing Predictor instance...")
        _predictor = Predictor(
            model_path=DEFAULT_MODEL_PATH,
            preprocessor_path=DEFAULT_PREPROCESSOR_PATH,
        )
    return _predictor


def get_novelty_detector() -> NoveltyDetector:
    """Lazy-load and cache NoveltyDetector instance."""
    global _novelty_detector
    if _novelty_detector is None:
        logger.info("Initializing NoveltyDetector instance...")
        _novelty_detector = NoveltyDetector.load(DEFAULT_NOVELTY_PATH)
    return _novelty_detector


def get_drift_detector() -> DriftDetector:
    """Lazy-load and cache DriftDetector instance."""
    global _drift_detector
    if _drift_detector is None:
        logger.info("Initializing DriftDetector instance with reference data...")
        from config import DEFAULT_DATASET_PATH
        from dataset_loader import load_and_validate_dataset
        df = load_and_validate_dataset(DEFAULT_DATASET_PATH)
        # Use initial ambient / normal samples as baseline
        ref_df = df[df["label"] == "ambient_air"]
        if ref_df.empty or len(ref_df) < 10:
            ref_df = df.iloc[:100]
        detector = DriftDetector()
        detector.fit_reference(ref_df)
        _drift_detector = detector
    return _drift_detector


def get_metadata() -> Dict[str, Any]:
    """Load cached model metadata."""
    global _training_metadata
    if _training_metadata is None:
        if DEFAULT_METADATA_PATH.exists():
            with open(DEFAULT_METADATA_PATH, "r") as f:
                _training_metadata = json.load(f)
        else:
            _training_metadata = {
                "status": "No persisted training metadata found",
                "classes": CLASS_LABELS,
                "channels": ALL_SENSOR_CHANNELS,
            }
    return _training_metadata


# -----------------------------------------------------------------------------
# Error Handlers
# -----------------------------------------------------------------------------
@app.errorhandler(400)
def bad_request(error):
    return jsonify({"error": "Bad Request", "message": str(error)}), 400


@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not Found", "message": str(error)}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal Server Error", "message": str(error)}), 500


# -----------------------------------------------------------------------------
# API Endpoints
# -----------------------------------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    """Service health and component availability status."""
    return jsonify({
        "status": "healthy",
        "service": "neuronose-ml-api",
        "timestamp": datetime.now().isoformat(),
        "model_exists": DEFAULT_MODEL_PATH.exists(),
        "preprocessor_exists": DEFAULT_PREPROCESSOR_PATH.exists(),
        "novelty_exists": DEFAULT_NOVELTY_PATH.exists(),
    }), 200


@app.route("/model/info", methods=["GET"])
def model_info():
    """Retrieve model metadata, training configuration, and evaluation statistics."""
    meta = get_metadata()
    return jsonify(meta), 200


@app.route("/predict", methods=["POST"])
def predict():
    """Single sample classification inference.

    Payload format:
    {
        "ch0": 1.15, "ch1": 3.55, "ch2": 1.45, "ch3": 3.85,
        "ch4": 2.95, "ch5": 1.25, "ch6": 2.05, "ch7": 1.65,
        "temperature": 27.5, "humidity": 62.0
    }
    """
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify({"error": "JSON body must be an object/dict"}), 400

    # Validate sensor channels
    missing = [ch for ch in CHANNEL_NAMES if ch not in data]
    if missing:
        return jsonify({
            "error": "Validation Error",
            "message": f"Missing required sensor channels: {missing}",
        }), 400

    try:
        predictor = get_predictor()
        result = predictor.predict_single(data)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error during inference: {e}", exc_info=True)
        return jsonify({"error": "Inference failure", "details": str(e)}), 500


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """Batch classification inference.

    Payload format:
    {
        "samples": [
            {"ch0": 1.1, ..., "ch7": 1.5},
            {"ch0": 2.8, ..., "ch7": 2.7}
        ]
    }
    """
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    body = request.get_json()
    samples = body.get("samples") if isinstance(body, dict) else body

    if not isinstance(samples, list) or len(samples) == 0:
        return jsonify({"error": "Input must contain a non-empty 'samples' array"}), 400

    try:
        predictor = get_predictor()
        results = predictor.predict_batch(samples)
        return jsonify({
            "count": len(results),
            "predictions": results,
        }), 200
    except Exception as e:
        logger.error(f"Error during batch inference: {e}", exc_info=True)
        return jsonify({"error": "Batch inference failure", "details": str(e)}), 500


@app.route("/novelty", methods=["POST"])
def novelty():
    """Evaluate sample(s) for out-of-distribution (novelty) status.

    Payload format:
    {
        "sample": {"ch0": 1.1, ..., "temperature": 24.0, "humidity": 50.0}
    }
    or
    {
        "samples": [ ... ]
    }
    """
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    body = request.get_json()
    try:
        predictor = get_predictor()
        detector = get_novelty_detector()

        if "samples" in body:
            samples = body["samples"]
            raw_mat = np.vstack([predictor._format_input(s) for s in samples])
            scaled_mat = predictor.preprocessor.transform(raw_mat)
            results = detector.evaluate_batch(scaled_mat)
            return jsonify({"results": results}), 200
        else:
            sample = body.get("sample", body)
            raw_mat = predictor._format_input(sample)
            scaled_mat = predictor.preprocessor.transform(raw_mat)
            res = detector.evaluate_sample(scaled_mat[0])
            return jsonify(res), 200
    except Exception as e:
        logger.error(f"Error during novelty evaluation: {e}", exc_info=True)
        return jsonify({"error": "Novelty evaluation failure", "details": str(e)}), 500


@app.route("/drift", methods=["POST"])
def drift():
    """Check sensor array for baseline and statistical distribution drift.

    Payload format:
    {
        "samples": [
            {"ch0": ..., "ch1": ..., ...}, ... (minimum 5 samples)
        ]
    }
    """
    if not request.is_json:
        return jsonify({"error": "Request body must be JSON"}), 400

    body = request.get_json()
    samples = body.get("samples")

    if not isinstance(samples, list) or len(samples) < 5:
        return jsonify({
            "error": "Drift detection requires a 'samples' array containing at least 5 consecutive measurements"
        }), 400

    try:
        drift_det = get_drift_detector()
        # Convert list of dicts to DataFrame or array
        sample_rows = []
        for s in samples:
            row = [float(s[ch]) for ch in CHANNEL_NAMES]
            sample_rows.append(row)

        curr_data = np.array(sample_rows, dtype=np.float64)
        result = drift_det.check_drift(curr_data)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error during drift detection: {e}", exc_info=True)
        return jsonify({"error": "Drift detection failure", "details": str(e)}), 500


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Start NeuroNose Flask API server.")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=5000, help="Port (default: 5000)")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    logger.info(f"Starting NeuroNose REST API on http://{args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
