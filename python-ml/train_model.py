"""Model training script for the NeuroNose ML Pipeline.

Trains Random Forest (baseline) and Support Vector Machine (RBF kernel)
classifiers using session-aware cross-validation to prevent data leakage.
Serializes trained models, preprocessors, and detailed training metadata.
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import GroupKFold
from sklearn.svm import SVC

try:
    from config import (
        ALL_SENSOR_CHANNELS,
        CLASS_LABELS,
        DEFAULT_DATASET_PATH,
        DEFAULT_METADATA_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_NOVELTY_PATH,
        DEFAULT_PREPROCESSOR_PATH,
        MODELS_DIR,
        RANDOM_SEED,
    )
    from dataset_loader import get_dataset_summary, load_and_validate_dataset, split_by_session
    from preprocessing import SensorPreprocessor
except ImportError:
    from .config import (
        ALL_SENSOR_CHANNELS,
        CLASS_LABELS,
        DEFAULT_DATASET_PATH,
        DEFAULT_METADATA_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_NOVELTY_PATH,
        DEFAULT_PREPROCESSOR_PATH,
        MODELS_DIR,
        RANDOM_SEED,
    )
    from .dataset_loader import get_dataset_summary, load_and_validate_dataset, split_by_session
    from .preprocessing import SensorPreprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def build_classifier(model_type: str = "rf", random_state: int = RANDOM_SEED):
    """Instantiate a classifier with reproducible settings."""
    model_type = model_type.lower()
    if model_type in ["rf", "random_forest"]:
        return RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            min_samples_split=3,
            min_samples_leaf=1,
            class_weight="balanced",
            random_state=random_state,
            n_jobs=-1,
        )
    elif model_type in ["svm", "svc"]:
        return SVC(
            kernel="rbf",
            C=5.0,
            gamma="scale",
            probability=True,
            class_weight="balanced",
            random_state=random_state,
        )
    else:
        raise ValueError(f"Unsupported model_type: '{model_type}'. Choose 'rf' or 'svm'.")


def evaluate_cv(
    model,
    X: np.ndarray,
    y: np.ndarray,
    groups: np.ndarray,
    n_splits: int = 4,
) -> Dict[str, float]:
    """Perform group-aware cross-validation on the training set."""
    unique_groups = len(np.unique(groups))
    actual_splits = min(n_splits, unique_groups)
    if actual_splits < 2:
        logger.warning(
            f"Not enough groups for GroupKFold ({unique_groups} unique groups). Skipping CV."
        )
        return {"cv_accuracy_mean": 0.0, "cv_accuracy_std": 0.0, "cv_f1_macro_mean": 0.0, "cv_f1_macro_std": 0.0}

    gkf = GroupKFold(n_splits=actual_splits)
    acc_scores = []
    f1_scores = []

    for train_idx, val_idx in gkf.split(X, y, groups):
        X_tr, X_val = X[train_idx], X[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]

        model.fit(X_tr, y_tr)
        preds = model.predict(X_val)

        acc_scores.append(accuracy_score(y_val, preds))
        f1_scores.append(f1_score(y_val, preds, average="macro", zero_division=0))

    return {
        "cv_accuracy_mean": round(float(np.mean(acc_scores)), 4),
        "cv_accuracy_std": round(float(np.std(acc_scores)), 4),
        "cv_f1_macro_mean": round(float(np.mean(f1_scores)), 4),
        "cv_f1_macro_std": round(float(np.std(f1_scores)), 4),
        "cv_splits": actual_splits,
    }


def train_pipeline(
    data_path: Path = DEFAULT_DATASET_PATH,
    model_type: str = "rf",
    test_size: float = 0.20,
    model_save_path: Path = DEFAULT_MODEL_PATH,
    preprocessor_save_path: Path = DEFAULT_PREPROCESSOR_PATH,
    novelty_save_path: Path = DEFAULT_NOVELTY_PATH,
    metadata_save_path: Path = DEFAULT_METADATA_PATH,
    random_seed: int = RANDOM_SEED,
) -> Dict[str, Any]:
    """Execute end-to-end training pipeline.

    1. Loads dataset and verifies schema
    2. Performs session-aware partitioning into train and test splits
    3. Fits SensorPreprocessor strictly on X_train (zero data leakage)
    4. Evaluates primary classifier and comparative classifier using GroupKFold
    5. Fits final classifier on full training partition
    6. Fits IsolationForest novelty detector on training partition
    7. Persists artifacts and training metadata
    """
    logger.info(f"Loading dataset from: {data_path}")
    df = load_and_validate_dataset(data_path)
    summary = get_dataset_summary(df)

    logger.info(f"Splitting dataset by session (test_size={test_size})...")
    X_train_df, X_test_df, y_train_series, y_test_series, split_meta = split_by_session(
        df=df,
        test_size=test_size,
        random_state=random_seed,
        feature_cols=ALL_SENSOR_CHANNELS,
        target_col="label",
    )

    # Extract groups (session IDs) for training cross-validation
    train_sessions = df.loc[X_train_df.index, "session_id"].to_numpy()

    # Preprocessing: Fit on training data ONLY
    logger.info("Fitting SensorPreprocessor on training data...")
    preprocessor = SensorPreprocessor()
    X_train_scaled = preprocessor.fit_transform(X_train_df)

    y_train = y_train_series.to_numpy()

    # Cross-validation on primary model
    logger.info(f"Performing GroupKFold CV on primary model '{model_type}'...")
    primary_cv_model = build_classifier(model_type, random_state=random_seed)
    primary_cv_scores = evaluate_cv(primary_cv_model, X_train_scaled, y_train, train_sessions)
    logger.info(f"Primary ({model_type}) CV Results: {primary_cv_scores}")

    # Cross-validation on comparative model
    alt_type = "svm" if model_type.lower() in ["rf", "random_forest"] else "rf"
    logger.info(f"Performing GroupKFold CV on comparison model '{alt_type}'...")
    alt_cv_model = build_classifier(alt_type, random_state=random_seed)
    alt_cv_scores = evaluate_cv(alt_cv_model, X_train_scaled, y_train, train_sessions)
    logger.info(f"Comparison ({alt_type}) CV Results: {alt_cv_scores}")

    # Train final model on entire training split
    logger.info(f"Training final {model_type} classifier on {len(X_train_scaled)} samples...")
    final_model = build_classifier(model_type, random_state=random_seed)
    final_model.fit(X_train_scaled, y_train)

    # Train Isolation Forest novelty detector
    logger.info("Training IsolationForest novelty detector on training distribution...")
    novelty_detector = IsolationForest(
        contamination=0.03,
        random_state=random_seed,
        n_estimators=100,
    )
    novelty_detector.fit(X_train_scaled)

    # Persist model and preprocessor artifacts
    model_save_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(final_model, model_save_path)
    logger.info(f"Classifier saved to: {model_save_path}")

    preprocessor.save(preprocessor_save_path)
    joblib.dump(novelty_detector, novelty_save_path)
    logger.info(f"Novelty detector saved to: {novelty_save_path}")

    # Compile comprehensive training metadata
    training_metadata = {
        "training_timestamp": datetime.now().isoformat(),
        "random_seed": random_seed,
        "model_type": model_type,
        "model_save_path": str(model_save_path),
        "preprocessor_save_path": str(preprocessor_save_path),
        "novelty_save_path": str(novelty_save_path),
        "feature_names": ALL_SENSOR_CHANNELS,
        "classes": CLASS_LABELS,
        "dataset_statistics": {
            "total_samples": summary["total_samples"],
            "num_sessions": summary["num_sessions"],
            "class_counts": summary["class_counts"],
            "imbalance_ratio": summary["imbalance_ratio"],
            "missing_value_percentage": summary["missing_value_percentage"],
        },
        "split_metadata": split_meta,
        "cross_validation": {
            "primary_model": {
                "type": model_type,
                "scores": primary_cv_scores,
            },
            "comparison_model": {
                "type": alt_type,
                "scores": alt_cv_scores,
            },
        },
        "synthetic_data_disclaimer": (
            "NOTICE: Trained on SYNTHETIC sensor data generated by deterministic simulation. "
            "These models are designed for pipeline verification and hardware architectural testing, "
            "and have NOT been validated against physical chemical sensor hardware."
        ),
    }

    with open(metadata_save_path, "w") as f:
        json.dump(training_metadata, f, indent=2)
    logger.info(f"Training metadata saved to: {metadata_save_path}")

    return {
        "model": final_model,
        "preprocessor": preprocessor,
        "novelty_detector": novelty_detector,
        "metadata": training_metadata,
        "X_test": X_test_df,
        "y_test": y_test_series,
    }


def main():
    parser = argparse.ArgumentParser(description="Train NeuroNose Classifier Pipeline.")
    parser.add_argument(
        "--data",
        type=str,
        default=str(DEFAULT_DATASET_PATH),
        help=f"Path to input CSV dataset (default: {DEFAULT_DATASET_PATH})",
    )
    parser.add_argument(
        "--model",
        type=str,
        choices=["rf", "svm"],
        default="rf",
        help="Classifier type: 'rf' (Random Forest) or 'svm' (Support Vector Machine)",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.20,
        help="Proportion of sessions reserved for test split (default: 0.20)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=RANDOM_SEED,
        help=f"Deterministic random seed (default: {RANDOM_SEED})",
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(MODELS_DIR),
        help=f"Directory to save models and metadata (default: {MODELS_DIR})",
    )

    args = parser.parse_args()
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    model_path = out_dir / f"neuronose_{args.model}_model.joblib"
    prep_path = out_dir / "sensor_preprocessor.joblib"
    novel_path = out_dir / "novelty_detector.joblib"
    meta_path = out_dir / "training_metadata.json"

    train_pipeline(
        data_path=Path(args.data),
        model_type=args.model,
        test_size=args.test_size,
        model_save_path=model_path,
        preprocessor_save_path=prep_path,
        novelty_save_path=novel_path,
        metadata_save_path=meta_path,
        random_seed=args.seed,
    )


if __name__ == "__main__":
    main()
