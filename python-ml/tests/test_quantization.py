"""Unit tests for quantization.py."""

import numpy as np
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import Q88_RAW_MAX, Q88_RAW_MIN, Q88_STEP
from quantization import (
    compute_quantization_error,
    float_to_q88,
    q88_to_float,
    quantize_array,
    quantize_thresholds,
)


def test_known_float_to_q88():
    """Verify exact analytical values for known float to Q8.8 conversions."""
    # 0.0 -> 0
    assert float_to_q88(0.0) == 0
    assert q88_to_float(0) == 0.0

    # 1.0 -> 256
    assert float_to_q88(1.0) == 256
    assert q88_to_float(256) == 1.0

    # -1.0 -> -256
    assert float_to_q88(-1.0) == -256
    assert q88_to_float(-256) == -1.0

    # 0.5 -> 128
    assert float_to_q88(0.5) == 128
    assert q88_to_float(128) == 0.5

    # 0.00390625 (1/256 = LSB) -> 1
    assert float_to_q88(0.00390625) == 1
    assert q88_to_float(1) == 0.00390625

    # -0.00390625 -> -1
    assert float_to_q88(-0.00390625) == -1


def test_overflow_and_underflow_clamping():
    """Verify hardware saturating arithmetic on extreme values."""
    # Values above 127.99609375 must clamp to Q88_RAW_MAX (32767)
    assert float_to_q88(150.0) == Q88_RAW_MAX
    assert float_to_q88(1000.0) == Q88_RAW_MAX

    # Values below -128.0 must clamp to Q88_RAW_MIN (-32768)
    assert float_to_q88(-150.0) == Q88_RAW_MIN
    assert float_to_q88(-9999.0) == Q88_RAW_MIN

    # Array clamping
    arr = np.array([-200.0, -128.0, 0.0, 127.99, 500.0])
    raw_arr = float_to_q88(arr)
    assert raw_arr[0] == Q88_RAW_MIN
    assert raw_arr[-1] == Q88_RAW_MAX


def test_round_trip_accuracy():
    """Verify that quantization error never exceeds half an LSB (1/512 = 0.001953125) within range."""
    rng = np.random.default_rng(42)
    # 500 random values within safe Q8.8 range
    test_vals = rng.uniform(-100.0, 100.0, size=500)
    quantized = quantize_array(test_vals)

    errors = np.abs(test_vals - quantized)
    max_error = np.max(errors)

    # Half LSB = 0.5 * (1/256) = 0.001953125
    half_lsb = Q88_STEP / 2.0
    assert max_error <= half_lsb + 1e-9


def test_quantize_thresholds_dict():
    """Verify dictionary threshold quantization."""
    thresh = {"th1": 1.25, "th2": 3.75}
    q_dict = quantize_thresholds(thresh)
    assert "th1" in q_dict
    assert q_dict["th1"]["q88_raw_int"] == 320
    assert q_dict["th2"]["q88_raw_int"] == 960


def test_quantization_error_metrics():
    """Verify error analysis report."""
    data = np.linspace(-10.0, 10.0, 200)
    report = compute_quantization_error(data)
    assert "step_size" in report
    assert "sqnr_db" in report
    assert report["empirical_max_error"] <= (Q88_STEP / 2.0 + 1e-5)
    assert report["clipped_samples_high"] == 0
