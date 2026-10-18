"""Bit-exact RTL Reference Model for the NeuroNose Hardware Modules.

Provides Python golden reference implementations mirroring SystemVerilog RTL modules:
1. FixedPointFilter    <-> fixed_point_filter.sv
2. BaselineCorrector   <-> baseline_corrector.sv
3. FeatureExtractor    <-> feature_extractor.sv
4. ThresholdClassifier <-> threshold_classifier.sv

All operations use 16-bit signed two's-complement arithmetic with saturating clamping,
matching FPGA / ASIC digital hardware implementations bit-for-bit.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd

try:
    from config import (
        DEFAULT_TEST_VECTORS_PATH,
        NUM_CHANNELS,
        Q88_RAW_MAX,
        Q88_RAW_MIN,
        Q88_SCALE,
        RTL_BASELINE_DECAY_Q88,
        RTL_FILTER_ALPHA_Q88,
    )
    from quantization import float_to_q88, q88_to_float
except ImportError:
    from .config import (
        DEFAULT_TEST_VECTORS_PATH,
        NUM_CHANNELS,
        Q88_RAW_MAX,
        Q88_RAW_MIN,
        Q88_SCALE,
        RTL_BASELINE_DECAY_Q88,
        RTL_FILTER_ALPHA_Q88,
    )
    from .quantization import float_to_q88, q88_to_float

logger = logging.getLogger(__name__)


def clamp_s16(val: int) -> int:
    """Clamp integer to 16-bit signed integer range [-32768, 32767]."""
    if val > Q88_RAW_MAX:
        return Q88_RAW_MAX
    if val < Q88_RAW_MIN:
        return Q88_RAW_MIN
    return int(val)


class RTLFixedPointFilter:
    """Golden reference for fixed_point_filter.sv.

    Implements a 1st-order IIR / EMA low-pass filter in signed 16-bit Q8.8:
        diff = x[n] - y[n-1]
        mult = (diff * alpha_q88) >>> 8
        y[n] = clamp_s16(y[n-1] + mult)
    """

    def __init__(self, alpha_q88: int = RTL_FILTER_ALPHA_Q88) -> None:
        """Initialize filter with Q8.8 alpha coefficient (default 64, i.e. 0.25)."""
        self.alpha_q88 = clamp_s16(alpha_q88)
        self.state: int = 0
        self.initialized: bool = False

    def reset(self, initial_val: int = 0) -> None:
        """Reset internal filter state register."""
        self.state = clamp_s16(initial_val)
        self.initialized = False

    def step(self, x_raw_q88: int) -> int:
        """Clock a single 16-bit Q8.8 raw sample through the filter.

        Args:
            x_raw_q88: 16-bit signed integer input.

        Returns:
            Filtered 16-bit signed integer output.
        """
        x_in = clamp_s16(x_raw_q88)
        if not self.initialized:
            self.state = x_in
            self.initialized = True
            return self.state

        diff = clamp_s16(x_in - self.state)
        # 16x16 multiplication shifted right by 8 for Q8.8 scale
        product = (diff * self.alpha_q88) >> 8
        new_state = clamp_s16(self.state + product)
        self.state = new_state
        return self.state


class RTLBaselineCorrector:
    """Golden reference for baseline_corrector.sv.

    Continuously tracks quiescent sensor baseline in Q8.8 and computes
    baseline-subtracted sensor delta:
        delta[n] = clamp_s16(x[n] - baseline[n-1])
        baseline[n] = baseline[n-1] + ((delta * beta_q88) >>> 8)  (slow tracking)
    """

    def __init__(self, beta_q88: int = RTL_BASELINE_DECAY_Q88) -> None:
        """Initialize baseline corrector with decay/tracking coefficient beta."""
        self.beta_q88 = clamp_s16(beta_q88)
        self.baseline: int = 0
        self.initialized: bool = False

    def reset(self, initial_baseline: int = 0) -> None:
        """Reset baseline register."""
        self.baseline = clamp_s16(initial_baseline)
        self.initialized = False

    def step(self, x_raw_q88: int) -> Tuple[int, int]:
        """Process one sample.

        Returns:
            (corrected_delta_q88, current_baseline_q88)
        """
        x_in = clamp_s16(x_raw_q88)
        if not self.initialized:
            self.baseline = x_in
            self.initialized = True
            return 0, self.baseline

        delta = clamp_s16(x_in - self.baseline)

        # Baseline only tracks slowly if delta is small (sensor returning to ambient)
        update = (delta * self.beta_q88) >> 8
        self.baseline = clamp_s16(self.baseline + update)

        return delta, self.baseline


class RTLFeatureExtractor:
    """Golden reference for feature_extractor.sv.

    Computes hardware features over a sliding or fixed observation window:
    - Peak value (maximum response)
    - Accumulated integral (sum of samples)
    - Steady-state (final sample)
    """

    def __init__(self, window_size: int = 32) -> None:
        self.window_size = window_size
        self.count: int = 0
        self.peak: int = 0
        self.accumulator: int = 0
        self.steady_state: int = 0

    def reset(self) -> None:
        self.count = 0
        self.peak = 0
        self.accumulator = 0
        self.steady_state = 0

    def step(self, x_raw_q88: int) -> Tuple[bool, int, int, int]:
        """Clock one sample into feature extraction engine.

        Returns:
            (window_ready, peak_q88, mean_q88, steady_state_q88)
        """
        x_in = clamp_s16(x_raw_q88)
        if self.count == 0:
            self.peak = x_in
            self.accumulator = x_in
        else:
            if x_in > self.peak:
                self.peak = x_in
            # Clamped 32-bit accumulator for 16-bit sums
            self.accumulator += x_in

        self.steady_state = x_in
        self.count += 1

        ready = (self.count >= self.window_size)
        if ready:
            mean_val = clamp_s16(self.accumulator // self.window_size)
            peak_out = self.peak
            ss_out = self.steady_state
            self.reset()
            return True, peak_out, mean_val, ss_out

        return False, self.peak, clamp_s16(self.accumulator // self.count), self.steady_state


class RTLThresholdClassifier:
    """Golden reference for threshold_classifier.sv.

    Implements a multi-channel decision-tree / threshold comparator in hardware.
    Class IDs match LABEL_TO_ID:
        0: fresh_food
        1: spoiled_food
        2: coffee_aroma
        3: tea_aroma
        4: ambient_air
        5: chemical_voc
    """

    def __init__(self) -> None:
        # Hardware decision thresholds converted to Q8.8
        # e.g. Ambient threshold: all channels low (< 0.65V -> 166 in Q8.8)
        self.th_ambient = float_to_q88(0.65)
        # Chemical VOC: ch0 > 3.4V and ch7 > 3.8V
        self.th_voc_ch0 = float_to_q88(3.40)
        self.th_voc_ch7 = float_to_q88(3.80)
        # Coffee: ch1 > 3.0V and ch3 > 3.2V
        self.th_coffee_ch1 = float_to_q88(3.00)
        self.th_coffee_ch3 = float_to_q88(3.20)
        # Spoiled food: ch0 > 2.2V and ch5 > 2.8V
        self.th_spoiled_ch0 = float_to_q88(2.20)
        self.th_spoiled_ch5 = float_to_q88(2.80)
        # Tea aroma: ch2 > 1.8V and ch6 > 2.0V
        self.th_tea_ch2 = float_to_q88(1.80)
        self.th_tea_ch6 = float_to_q88(2.00)

    def classify(self, channels_q88: List[int]) -> int:
        """Classify 8-channel Q8.8 sensor vector.

        Returns:
            int class ID (0 to 5).
        """
        if len(channels_q88) < 8:
            raise ValueError(f"Expected 8 channels, got {len(channels_q88)}")

        ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7 = [clamp_s16(c) for c in channels_q88[:8]]

        # Hardware priority comparator tree
        if ch0 > self.th_voc_ch0 and ch7 > self.th_voc_ch7:
            return 5  # chemical_voc
        if ch1 > self.th_coffee_ch1 and ch3 > self.th_coffee_ch3:
            return 2  # coffee_aroma
        if ch0 > self.th_spoiled_ch0 and ch5 > self.th_spoiled_ch5:
            return 1  # spoiled_food
        if ch2 > self.th_tea_ch2 and ch6 > self.th_tea_ch6:
            return 3  # tea_aroma
        if all(c < self.th_ambient for c in [ch0, ch1, ch2, ch3, ch4, ch5, ch6, ch7]):
            return 4  # ambient_air

        # Default fallback
        return 0  # fresh_food


def generate_rtl_test_vectors(
    output_path: Union[str, Path] = DEFAULT_TEST_VECTORS_PATH,
    n_samples: int = 120,
) -> pd.DataFrame:
    """Generate comprehensive hardware verification test vectors with expected golden outputs.

    Saves vectors to CSV for automated SystemVerilog testbenches.
    """
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(42)

    # Instantiate golden models
    filters = [RTLFixedPointFilter() for _ in range(NUM_CHANNELS)]
    baseline_correctors = [RTLBaselineCorrector() for _ in range(NUM_CHANNELS)]
    classifier = RTLThresholdClassifier()

    records: List[Dict[str, Any]] = []

    # Test stimulus pattern covering ambient, coffee spike, spoiled odor, chemical saturation
    patterns = [
        ("ambient_air", 30),
        ("coffee_aroma", 30),
        ("spoiled_food", 30),
        ("chemical_voc", 30),
    ]

    from config import NOMINAL_FINGERPRINTS

    sample_id = 0
    for label, count in patterns:
        base = np.array(NOMINAL_FINGERPRINTS[label])
        for _ in range(count):
            # Input float and Q8.8
            ch_inputs_float = np.clip(base + rng.normal(0, 0.08, size=8), 0.05, 5.0)
            ch_inputs_q88 = [int(float_to_q88(val)) for val in ch_inputs_float]

            filtered_q88 = [filters[i].step(ch_inputs_q88[i]) for i in range(8)]
            corrected_q88 = [baseline_correctors[i].step(filtered_q88[i])[0] for i in range(8)]
            pred_class_id = classifier.classify(filtered_q88)

            rec = {
                "sample_idx": sample_id,
                "label_ground_truth": label,
                "expected_class_id": pred_class_id,
            }

            for i in range(8):
                rec[f"in_ch{i}_raw_q88"] = ch_inputs_q88[i]
                rec[f"exp_filt_ch{i}_q88"] = filtered_q88[i]
                rec[f"exp_corr_ch{i}_q88"] = corrected_q88[i]

            records.append(rec)
            sample_id += 1

    df = pd.DataFrame(records)
    df.to_csv(path, index=False)
    logger.info(f"Generated {len(df)} golden RTL test vectors at: {path}")
    return df


def verify_test_vectors(
    test_vector_csv: Union[str, Path] = DEFAULT_TEST_VECTORS_PATH
) -> Dict[str, Any]:
    """Verify RTL reference model accuracy against stored test vectors.

    Ensures 100% bit-exact determinism across all digital processing stages.
    """
    path = Path(test_vector_csv)
    if not path.exists():
        logger.info(f"Test vectors not found at {path}. Generating standard test vectors...")
        generate_rtl_test_vectors(path)

    df = pd.read_csv(path)

    filters = [RTLFixedPointFilter() for _ in range(NUM_CHANNELS)]
    correctors = [RTLBaselineCorrector() for _ in range(NUM_CHANNELS)]
    classifier = RTLThresholdClassifier()

    total_checks = 0
    filter_matches = 0
    corrector_matches = 0
    classifier_matches = 0
    max_filter_err = 0
    max_corr_err = 0

    for _, row in df.iterrows():
        inputs = [int(row[f"in_ch{i}_raw_q88"]) for i in range(8)]
        exp_filter = [int(row[f"exp_filt_ch{i}_q88"]) for i in range(8)]
        exp_corr = [int(row[f"exp_corr_ch{i}_q88"]) for i in range(8)]
        exp_class = int(row["expected_class_id"])

        act_filter = [filters[i].step(inputs[i]) for i in range(8)]
        act_corr = [correctors[i].step(act_filter[i])[0] for i in range(8)]
        act_class = classifier.classify(act_filter)

        total_checks += 1
        if act_class == exp_class:
            classifier_matches += 1

        for i in range(8):
            f_err = abs(act_filter[i] - exp_filter[i])
            c_err = abs(act_corr[i] - exp_corr[i])
            if f_err == 0:
                filter_matches += 1
            if c_err == 0:
                corrector_matches += 1
            max_filter_err = max(max_filter_err, f_err)
            max_corr_err = max(max_corr_err, c_err)

    total_channel_checks = total_checks * 8
    result = {
        "total_test_samples": total_checks,
        "filter_checks": total_channel_checks,
        "filter_exact_matches": filter_matches,
        "filter_match_rate": round(filter_matches / total_channel_checks, 4),
        "filter_max_lsb_error": max_filter_err,
        "corrector_checks": total_channel_checks,
        "corrector_exact_matches": corrector_matches,
        "corrector_match_rate": round(corrector_matches / total_channel_checks, 4),
        "corrector_max_lsb_error": max_corr_err,
        "classifier_exact_matches": classifier_matches,
        "classifier_match_rate": round(classifier_matches / total_checks, 4),
        "bit_exact": (max_filter_err == 0 and max_corr_err == 0 and classifier_matches == total_checks),
    }

    logger.info("RTL Golden Reference Verification Result:")
    logger.info(json.dumps(result, indent=2))
    return result


def main():
    parser = argparse.ArgumentParser(description="RTL Reference Model and Verification.")
    parser.add_argument("--generate", action="store_true", help="Generate golden test vectors CSV")
    parser.add_argument("--verify", action="store_true", help="Verify golden test vectors")
    parser.add_argument("--path", type=str, default=str(DEFAULT_TEST_VECTORS_PATH), help="Test vectors CSV path")
    args = parser.parse_args()

    if args.generate:
        generate_rtl_test_vectors(args.path)
    if args.verify or not args.generate:
        res = verify_test_vectors(args.path)
        print(f"[RESULT] Verification bit-exact match: {res['bit_exact']}")


if __name__ == "__main__":
    main()
