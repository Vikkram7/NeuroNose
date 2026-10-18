"""Model evaluation script for the NeuroNose ML Pipeline.

Computes comprehensive classification metrics (accuracy, macro/per-class precision,
recall, F1), renders publication-quality confusion matrix and feature importance
plots, and exports structured evaluation summaries.

Explicitly documents evaluation limitations and synthetic dataset notices.
"""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional, Union
import joblib
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless environments
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

try:
    from config import (
        ALL_SENSOR_CHANNELS,
        CLASS_LABELS,
        DEFAULT_DATASET_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_PREPROCESSOR_PATH,
        EVAL_DIR,
        RANDOM_SEED,
    )
    from dataset_loader import load_and_validate_dataset, split_by_session
    from preprocessing import SensorPreprocessor
except ImportError:
    from .config import (
        ALL_SENSOR_CHANNELS,
        CLASS_LABELS,
        DEFAULT_DATASET_PATH,
        DEFAULT_MODEL_PATH,
        DEFAULT_PREPROCESSOR_PATH,
        EVAL_DIR,
        RANDOM_SEED,
    )
    from .dataset_loader import load_and_validate_dataset, split_by_session
    from .preprocessing import SensorPreprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SYNTHETIC_DATA_WARNING = (
    "Evaluated on SYNTHETIC data - not validated on real sensor measurements"
)


def plot_confusion_matrix(
    cm: np.ndarray,
    labels: list[str],
    output_path: Path,
    title: str = "NeuroNose Confusion Matrix",
) -> None:
    """Render and save confusion matrix heatmap."""
    fig, ax = plt.subplots(figsize=(8, 7))
    im = ax.imshow(cm, interpolation="nearest", cmap=plt.cm.Blues)
    ax.figure.colorbar(im, ax=ax, fraction=0.046, pad=0.04)

    ax.set(
        xticks=np.arange(cm.shape[1]),
        yticks=np.arange(cm.shape[0]),
        xticklabels=labels,
        yticklabels=labels,
        title=f"{title}\n({SYNTHETIC_DATA_WARNING})",
        ylabel="True Label",
        xlabel="Predicted Label",
    )

    plt.setp(ax.get_xticklabels(), rotation=35, ha="right", rotation_mode="anchor")

    # Annotate counts inside cells
    thresh = cm.max() / 2.0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            val = cm[i, j]
            ax.text(
                j,
                i,
                f"{val:d}",
                ha="center",
                va="center",
                color="white" if val > thresh else "black",
                fontweight="bold" if i == j else "normal",
            )

    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved confusion matrix plot: {output_path}")


def plot_feature_importances(
    importances: np.ndarray,
    feature_names: list[str],
    output_path: Path,
    title: str = "Random Forest Feature Importances",
) -> None:
    """Render and save feature importance horizontal bar chart."""
    indices = np.argsort(importances)

    fig, ax = plt.subplots(figsize=(8, 6))
    ax.barh(range(len(indices)), importances[indices], color="#2b5c8f", align="center")
    ax.set_yticks(range(len(indices)))
    ax.set_yticklabels([feature_names[i] for i in indices])
    ax.set_xlabel("Relative Importance (Gini Impurity Reduction)")
    ax.set_title(f"{title}\n({SYNTHETIC_DATA_WARNING})")
    ax.grid(axis="x", linestyle="--", alpha=0.6)

    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.savefig(output_path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    logger.info(f"Saved feature importance plot: {output_path}")


def evaluate(
    model_path: Path = DEFAULT_MODEL_PATH,
    preprocessor_path: Path = DEFAULT_PREPROCESSOR_PATH,
    data_path: Path = DEFAULT_DATASET_PATH,
    output_dir: Path = EVAL_DIR,
    test_size: float = 0.20,
    seed: int = RANDOM_SEED,
) -> Dict[str, Any]:
    """Execute model evaluation on the held-out session-aware test partition."""
    logger.info(f"Loading model from: {model_path}")
    if not Path(model_path).exists():
        raise FileNotFoundError(f"Model file not found: {model_path}")
    model = joblib.load(model_path)

    logger.info(f"Loading preprocessor from: {preprocessor_path}")
    preprocessor = SensorPreprocessor.load(preprocessor_path)

    logger.info(f"Loading test data from: {data_path}")
    df = load_and_validate_dataset(data_path)

    # Use exact same session-aware partition logic
    _, X_test_df, _, y_test_series, split_meta = split_by_session(
        df=df,
        test_size=test_size,
        random_state=seed,
        feature_cols=ALL_SENSOR_CHANNELS,
        target_col="label",
    )

    X_test_scaled = preprocessor.transform(X_test_df)
    y_test = y_test_series.to_numpy()

    # Predictions
    y_pred = model.predict(X_test_scaled)

    # Class labels present in test set
    labels_present = sorted(list(set(y_test) | set(y_pred)))
    target_names = [str(lbl) for lbl in labels_present]

    acc = float(accuracy_score(y_test, y_pred))
    p_macro = float(precision_score(y_test, y_pred, average="macro", zero_division=0))
    r_macro = float(recall_score(y_test, y_pred, average="macro", zero_division=0))
    f1_macro = float(f1_score(y_test, y_pred, average="macro", zero_division=0))

    p_per_class = precision_score(y_test, y_pred, average=None, labels=labels_present, zero_division=0)
    r_per_class = recall_score(y_test, y_pred, average=None, labels=labels_present, zero_division=0)
    f1_per_class = f1_score(y_test, y_pred, average=None, labels=labels_present, zero_division=0)

    per_class_metrics: Dict[str, Dict[str, float]] = {}
    for i, lbl in enumerate(labels_present):
        per_class_metrics[lbl] = {
            "precision": round(float(p_per_class[i]), 4),
            "recall": round(float(r_per_class[i]), 4),
            "f1_score": round(float(f1_per_class[i]), 4),
            "support": int(np.sum(y_test == lbl)),
        }

    cm = confusion_matrix(y_test, y_pred, labels=labels_present)
    clf_report_str = classification_report(y_test, y_pred, labels=labels_present, zero_division=0)

    print("\n" + "=" * 70)
    print("NeuroNose Model Evaluation Report")
    print(f"NOTICE: {SYNTHETIC_DATA_WARNING}")
    print("=" * 70)
    print(f"Total Test Samples: {len(y_test)}")
    print(f"Overall Accuracy:   {acc:.4f}")
    print(f"Macro Precision:    {p_macro:.4f}")
    print(f"Macro Recall:       {r_macro:.4f}")
    print(f"Macro F1 Score:     {f1_macro:.4f}")
    print("-" * 70)
    print(clf_report_str)
    print("=" * 70)

    # Output directory
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Confusion Matrix plot
    cm_path = output_dir / "confusion_matrix.png"
    plot_confusion_matrix(cm, labels_present, cm_path)

    # 2. Feature Importances plot (if available)
    fi_path = output_dir / "feature_importances.png"
    feature_importances_dict = {}
    if hasattr(model, "feature_importances_"):
        plot_feature_importances(
            model.feature_importances_,
            ALL_SENSOR_CHANNELS,
            fi_path,
        )
        for name, imp in zip(ALL_SENSOR_CHANNELS, model.feature_importances_):
            feature_importances_dict[name] = round(float(imp), 4)

    # 3. Export JSON report
    eval_results = {
        "evaluation_timestamp": datetime.now().isoformat(),
        "disclaimer": SYNTHETIC_DATA_WARNING,
        "n_test_samples": len(y_test),
        "test_sessions": split_meta["test_sessions"],
        "overall_metrics": {
            "accuracy": round(acc, 4),
            "precision_macro": round(p_macro, 4),
            "recall_macro": round(r_macro, 4),
            "f1_macro": round(f1_macro, 4),
        },
        "per_class_metrics": per_class_metrics,
        "confusion_matrix": cm.tolist(),
        "labels": labels_present,
        "feature_importances": feature_importances_dict if feature_importances_dict else None,
        "limitations": [
            "Evaluated strictly on synthetic e-nose sensor profiles.",
            "Real hardware exhibits non-linear temperature/humidity cross-sensitivity.",
            "Real sensors undergo complex chemical poisoning and irreversible drift not modeled here."
        ],
    }

    results_json_path = output_dir / "evaluation_results.json"
    with open(results_json_path, "w") as f:
        json.dump(eval_results, f, indent=2)
    logger.info(f"Saved evaluation results JSON: {results_json_path}")

    return eval_results


def main():
    parser = argparse.ArgumentParser(description="Evaluate NeuroNose Classifier.")
    parser.add_argument("--model", type=str, default=str(DEFAULT_MODEL_PATH), help="Trained model path")
    parser.add_argument("--preprocessor", type=str, default=str(DEFAULT_PREPROCESSOR_PATH), help="Preprocessor path")
    parser.add_argument("--data", type=str, default=str(DEFAULT_DATASET_PATH), help="Test dataset path")
    parser.add_argument("--output-dir", type=str, default=str(EVAL_DIR), help="Output directory")
    args = parser.parse_args()

    evaluate(
        model_path=Path(args.model),
        preprocessor_path=Path(args.preprocessor),
        data_path=Path(args.data),
        output_dir=Path(args.output_dir),
    )


if __name__ == "__main__":
    main()
