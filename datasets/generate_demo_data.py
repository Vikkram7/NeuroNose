"""Generate reference demo datasets and RTL verification test vectors for NeuroNose.

Outputs:
1. datasets/sensor_data_demo.csv (1200 samples across 6 classes with 8 channels + temp + hum)
2. verification/test_vectors.csv (120 samples with golden RTL filter/baseline/classifier values)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Add project root and python-ml to Python search path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
PYTHON_ML_DIR = PROJECT_ROOT / "python-ml"
sys.path.insert(0, str(PYTHON_ML_DIR))

from config import DEFAULT_DATASET_PATH, DEFAULT_TEST_VECTORS_PATH, RANDOM_SEED
from rtl_reference import generate_rtl_test_vectors
from sensor_data_generator import generate_dataset


def main():
    parser = argparse.ArgumentParser(description="Generate demo dataset and RTL test vectors.")
    parser.add_argument(
        "--samples-per-class",
        type=int,
        default=200,
        help="Number of synthetic samples per odor class (default: 200)",
    )
    parser.add_argument(
        "--output-dataset",
        type=str,
        default=str(DEFAULT_DATASET_PATH),
        help=f"Target path for sensor dataset CSV (default: {DEFAULT_DATASET_PATH})",
    )
    parser.add_argument(
        "--output-vectors",
        type=str,
        default=str(DEFAULT_TEST_VECTORS_PATH),
        help=f"Target path for RTL test vectors CSV (default: {DEFAULT_TEST_VECTORS_PATH})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=RANDOM_SEED,
        help=f"Reproducible random seed (default: {RANDOM_SEED})",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("NeuroNose Dataset and RTL Verification Vector Generator")
    print("=" * 70)

    # 1. Generate Synthetic Sensor Dataset
    dataset_path = Path(args.output_dataset)
    dataset_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"[1/2] Generating synthetic multi-channel dataset (n={args.samples_per_class} / class, seed={args.seed})...")
    df = generate_dataset(
        n_samples_per_class=args.samples_per_class,
        noise_level=0.10,
        drift_rate=0.005,
        outlier_probability=0.01,
        missing_value_probability=0.01,
        seed=args.seed,
    )

    df.to_csv(dataset_path, index=False)
    print(f"[SUCCESS] Wrote {len(df)} samples to {dataset_path}")
    print("\nClass breakdown:")
    for lbl, count in df["label"].value_counts().items():
        print(f"  - {lbl:15s}: {count:4d} samples")

    # 2. Generate RTL Verification Vectors
    vectors_path = Path(args.output_vectors)
    vectors_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"\n[2/2] Generating golden RTL verification test vectors...")
    vec_df = generate_rtl_test_vectors(output_path=vectors_path, n_samples=120)
    print(f"[SUCCESS] Wrote {len(vec_df)} golden test vectors to {vectors_path}")

    print("\n" + "=" * 70)
    print("Generation complete! All synthetic datasets ready for pipeline training & verification.")
    print("=" * 70)


if __name__ == "__main__":
    main()
