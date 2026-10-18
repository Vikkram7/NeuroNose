"""Deterministic synthetic sensor data generator for the NeuroNose project.

================================================================================
CRITICAL NOTICE:
ALL DATA PRODUCED BY THIS GENERATOR IS SYNTHETIC / SIMULATED.
IT REPRESENTS EMULATED ELECTRONIC NOSE SENSOR PROFILES AND HAS NOT BEEN
VALIDATED ON REAL IN-VITRO OR FIELD PHYSICAL SENSOR READINGS.
================================================================================

Generates 8-channel metal-oxide (MOS) / electrochemical sensor response patterns
with auxiliary temperature and humidity readings, sensor baseline drift, realistic
Gaussian noise, occasional sensor dropouts (missing values), and outlier spikes.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

try:
    from config import (
        CHANNEL_NAMES,
        CLASS_LABELS,
        NOMINAL_FINGERPRINTS,
        RANDOM_SEED,
        SAMPLE_RATE,
    )
except ImportError:
    from .config import (
        CHANNEL_NAMES,
        CLASS_LABELS,
        NOMINAL_FINGERPRINTS,
        RANDOM_SEED,
        SAMPLE_RATE,
    )


def generate_streaming_sample(
    class_name: str,
    noise: float = 0.05,
    temperature_nominal: float = 23.5,
    humidity_nominal: float = 52.0,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    """Generate a single simulated sensor reading for online/streaming inference.

    Args:
        class_name: Target odor class name (must exist in CLASS_LABELS).
        noise: Standard deviation of Gaussian noise added to sensor channels.
        temperature_nominal: Nominal ambient temperature in Celsius.
        humidity_nominal: Nominal relative humidity in percent (%).
        seed: Optional deterministic random seed.

    Returns:
        Dict representing one timestamped sample with 8 sensor channels and
        auxiliary readings, marked clearly as synthetic.
    """
    if class_name not in NOMINAL_FINGERPRINTS:
        raise ValueError(
            f"Unknown class '{class_name}'. Must be one of: {list(NOMINAL_FINGERPRINTS.keys())}"
        )

    rng = np.random.default_rng(seed)
    base_response = np.array(NOMINAL_FINGERPRINTS[class_name], dtype=np.float64)

    # Class-specific environmental characteristics
    temp_offset = 0.0
    hum_offset = 0.0
    if class_name == "spoiled_food":
        temp_offset = 1.8
        hum_offset = 15.0  # Decaying organic matter releases moisture
    elif class_name == "coffee_aroma":
        temp_offset = 4.0  # Hot beverage vapor
        hum_offset = 10.0

    # Add Gaussian noise
    sensor_noise = rng.normal(loc=0.0, scale=noise, size=len(base_response))
    sample_values = np.clip(base_response + sensor_noise, 0.01, 10.0)

    # Environmental noise
    temp = float(np.clip(temperature_nominal + temp_offset + rng.normal(0, 0.4), -10.0, 60.0))
    hum = float(np.clip(humidity_nominal + hum_offset + rng.normal(0, 1.2), 5.0, 99.0))

    sample_dict: Dict[str, Any] = {
        "timestamp": datetime.now().isoformat(),
        "is_synthetic": True,
        "label": class_name,
        "temperature": round(temp, 2),
        "humidity": round(hum, 2),
    }

    for i, ch_name in enumerate(CHANNEL_NAMES):
        sample_dict[ch_name] = round(float(sample_values[i]), 4)

    return sample_dict


def generate_dataset(
    n_samples_per_class: int = 200,
    noise_level: float = 0.10,
    drift_rate: float = 0.005,
    outlier_probability: float = 0.01,
    missing_value_probability: float = 0.01,
    n_sessions_per_class: int = 5,
    seed: int = RANDOM_SEED,
) -> pd.DataFrame:
    """Generate a full deterministic synthetic dataset for e-nose training and validation.

    Generates structured multi-session sensor data ensuring that samples are grouped
    into realistic continuous measurement sessions. This enables proper session-aware
    splitting without train-test leakage.

    Args:
        n_samples_per_class: Number of samples generated for each class.
        noise_level: Relative Gaussian noise standard deviation.
        drift_rate: Baseline sensor drift accumulated over time.
        outlier_probability: Probability of random sensor spikes/outliers.
        missing_value_probability: Probability of sensor missing values (simulating I2C/ADC dropouts).
        n_sessions_per_class: Number of distinct measurement sessions per class.
        seed: Random seed for 100% deterministic reproducibility.

    Returns:
        DataFrame with columns:
        [timestamp, session_id, ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7, temperature, humidity, label]
    """
    if n_samples_per_class <= 0:
        raise ValueError("n_samples_per_class must be > 0")
    if n_sessions_per_class <= 0:
        raise ValueError("n_sessions_per_class must be > 0")

    rng = np.random.default_rng(seed)
    records: List[Dict[str, Any]] = []

    samples_per_session = int(np.ceil(n_samples_per_class / n_sessions_per_class))
    start_time = datetime(2026, 1, 1, 9, 0, 0)
    dt_delta = timedelta(seconds=1.0 / SAMPLE_RATE)

    global_session_counter = 0

    for class_name in CLASS_LABELS:
        fingerprint = np.array(NOMINAL_FINGERPRINTS[class_name], dtype=np.float64)

        for session_idx in range(n_sessions_per_class):
            session_id = f"sess_{global_session_counter:03d}_{class_name}"
            global_session_counter += 1

            # Session-level baseline offset (simulating sensor warm-up / ambient state)
            session_bias = rng.normal(0.0, 0.03, size=len(fingerprint))

            # Environmental baselines for this session
            base_temp = 22.0 + rng.uniform(-1.5, 2.0)
            base_hum = 50.0 + rng.uniform(-5.0, 8.0)

            if class_name == "spoiled_food":
                base_hum += 14.0
                base_temp += 1.2
            elif class_name == "coffee_aroma":
                base_temp += 3.5
                base_hum += 8.0

            # Session timestamps start offset
            session_start_time = start_time + timedelta(
                hours=global_session_counter * 2.5
            )

            current_time = session_start_time

            for s_idx in range(samples_per_session):
                # Check if we have fulfilled n_samples_per_class
                current_class_count = sum(1 for r in records if r["label"] == class_name)
                if current_class_count >= n_samples_per_class:
                    break

                # Linear baseline drift across the session
                drift_factor = drift_rate * (s_idx / max(samples_per_session, 1))
                drift_vector = drift_factor * np.ones_like(fingerprint)

                # High-frequency sensor noise
                noise = rng.normal(0.0, noise_level * fingerprint, size=len(fingerprint))

                sensor_values = fingerprint + session_bias + drift_vector + noise

                # Outlier injection (sensor spike)
                for ch_idx in range(len(fingerprint)):
                    if rng.random() < outlier_probability:
                        # Spike up or down
                        spike = rng.choice([-1.5, 2.0]) * fingerprint[ch_idx]
                        sensor_values[ch_idx] += spike

                # Physical clipping to realistic positive voltage
                sensor_values = np.clip(sensor_values, 0.01, 10.0)

                # Environmental channels with small noise
                temp = float(np.clip(base_temp + rng.normal(0, 0.15), -10.0, 60.0))
                hum = float(np.clip(base_hum + rng.normal(0, 0.4), 5.0, 99.0))

                record: Dict[str, Any] = {
                    "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "session_id": session_id,
                }

                # Channel values with potential missing values (NaN)
                for ch_idx, ch_name in enumerate(CHANNEL_NAMES):
                    if rng.random() < missing_value_probability:
                        record[ch_name] = np.nan
                    else:
                        record[ch_name] = float(np.round(sensor_values[ch_idx], 4))

                record["temperature"] = float(np.round(temp, 2))
                record["humidity"] = float(np.round(hum, 2))
                record["label"] = class_name

                records.append(record)
                current_time += dt_delta

    df = pd.DataFrame(records)

    # Attach explicit metadata tagging this as synthetic data
    df.attrs["is_synthetic"] = True
    df.attrs["description"] = (
        "Deterministic synthetic multi-channel e-nose sensor data. "
        "Intended exclusively for algorithmic verification, pipeline development, "
        "and hardware co-simulation."
    )

    return df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate deterministic synthetic e-nose sensor datasets."
    )
    parser.add_argument(
        "--samples-per-class",
        type=int,
        default=200,
        help="Number of samples per class (default: 200)",
    )
    parser.add_argument(
        "--noise",
        type=float,
        default=0.10,
        help="Noise level std dev factor (default: 0.10)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=RANDOM_SEED,
        help="Random seed for deterministic generation (default: 42)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output CSV path (optional)",
    )

    args = parser.parse_args()
    print(f"[INFO] Generating synthetic dataset (seed={args.seed}, n_per_class={args.samples_per_class})...")
    generated_df = generate_dataset(
        n_samples_per_class=args.samples_per_class,
        noise_level=args.noise,
        seed=args.seed,
    )
    print(f"[INFO] Generated {len(generated_df)} synthetic samples across {generated_df['label'].nunique()} classes.")
    print("[INFO] Class distribution:")
    print(generated_df["label"].value_counts())

    if args.output:
        generated_df.to_csv(args.output, index=False)
        print(f"[SUCCESS] Synthetic dataset saved to {args.output}")
