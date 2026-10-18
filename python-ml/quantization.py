"""Fixed-point quantization module for the NeuroNose ML Pipeline.

Implements bit-accurate Q8.8 (16-bit signed: 1 sign bit, 7 integer bits, 8 fractional bits)
arithmetic, hardware threshold scaling, overflow saturation clamping, and formal
quantization error analysis.
"""

from __future__ import annotations

import argparse
import json
import logging
from typing import Any, Dict, List, Tuple, Union
import numpy as np

try:
    from config import (
        Q88_FLOAT_MAX,
        Q88_FLOAT_MIN,
        Q88_FRAC_BITS,
        Q88_INT_BITS,
        Q88_RAW_MAX,
        Q88_RAW_MIN,
        Q88_SCALE,
        Q88_STEP,
    )
except ImportError:
    from .config import (
        Q88_FLOAT_MAX,
        Q88_FLOAT_MIN,
        Q88_FRAC_BITS,
        Q88_INT_BITS,
        Q88_RAW_MAX,
        Q88_RAW_MIN,
        Q88_SCALE,
        Q88_STEP,
    )

logger = logging.getLogger(__name__)


def float_to_q88(
    x: Union[float, int, np.ndarray, List[float]]
) -> Union[int, np.ndarray]:
    """Convert floating-point value(s) to signed 16-bit Q8.8 fixed-point integer(s).

    Arithmetic:
        raw = round(x * 256.0)
        saturates at [-32768, 32767]

    Args:
        x: Float or array of floats in range [-128.0, 127.99609375].

    Returns:
        Signed 16-bit integer or int16 numpy array.
    """
    if isinstance(x, (int, float)):
        scaled = int(round(float(x) * Q88_SCALE))
        # Saturating clamping (standard hardware arithmetic)
        if scaled > Q88_RAW_MAX:
            return Q88_RAW_MAX
        if scaled < Q88_RAW_MIN:
            return Q88_RAW_MIN
        return int(scaled)

    arr = np.asarray(x, dtype=np.float64)
    scaled = np.round(arr * Q88_SCALE)
    clamped = np.clip(scaled, Q88_RAW_MIN, Q88_RAW_MAX).astype(np.int16)
    return clamped


def q88_to_float(
    x: Union[int, np.int16, np.ndarray, List[int]]
) -> Union[float, np.ndarray]:
    """Convert signed 16-bit Q8.8 integer(s) back to floating-point value(s).

    Arithmetic:
        float_val = raw / 256.0

    Args:
        x: Signed integer or numpy int16 array in range [-32768, 32767].

    Returns:
        Float or float64 numpy array.
    """
    if isinstance(x, (int, np.integer)):
        raw = int(x)
        # Ensure signed 16-bit range interpretation
        if raw > Q88_RAW_MAX:
            raw = Q88_RAW_MAX
        elif raw < Q88_RAW_MIN:
            raw = Q88_RAW_MIN
        return float(raw) / Q88_SCALE

    arr = np.asarray(x, dtype=np.float64)
    return arr / Q88_SCALE


def quantize_array(
    arr: Union[np.ndarray, List[float]]
) -> np.ndarray:
    """Emulate hardware fixed-point quantization on a floating-point array.

    Performs full round-trip conversion (float -> Q8.8 int16 -> float),
    introducing exact hardware truncation and precision loss.

    Args:
        arr: Input floating-point array.

    Returns:
        Quantized floating-point array with 1/256 resolution.
    """
    raw_q88 = float_to_q88(arr)
    return q88_to_float(raw_q88)


def quantize_thresholds(
    thresholds: Union[List[float], np.ndarray, Dict[str, float]]
) -> Dict[str, Any]:
    """Quantize decision tree or classifier threshold boundaries for RTL deployment.

    Args:
        thresholds: List, array, or dictionary of floating-point decision thresholds.

    Returns:
        Dictionary containing raw Q8.8 hex/integers, reconstructed floats, and quantization delta.
    """
    if isinstance(thresholds, dict):
        results = {}
        for k, v in thresholds.items():
            raw = int(float_to_q88(v))
            reconstructed = float(q88_to_float(raw))
            results[k] = {
                "float_original": round(float(v), 6),
                "q88_raw_int": raw,
                "q88_hex": f"16'h{raw & 0xFFFF:04X}",
                "reconstructed_float": round(reconstructed, 6),
                "error": round(abs(v - reconstructed), 6),
            }
        return results

    arr = np.asarray(thresholds, dtype=np.float64)
    raw = float_to_q88(arr)
    rec = q88_to_float(raw)
    err = np.abs(arr - rec)

    return {
        "float_original": arr.tolist(),
        "q88_raw_int": [int(v) for v in np.asarray(raw).ravel()],
        "q88_hex": [f"16'h{int(v) & 0xFFFF:04X}" for v in np.asarray(raw).ravel()],
        "reconstructed_float": rec.tolist(),
        "max_error": float(np.max(err)),
        "mean_error": float(np.mean(err)),
    }


def compute_quantization_error(data: Union[np.ndarray, List[float]]) -> Dict[str, float]:
    """Analyze signal degradation, error bounds, and SQNR from Q8.8 quantization.

    Args:
        data: Continuous floating-point sensor dataset.

    Returns:
        Dictionary with max absolute error, MSE, RMSE, and SQNR (dB).
    """
    orig = np.asarray(data, dtype=np.float64)
    quant = quantize_array(orig)
    residual = orig - quant

    abs_err = np.abs(residual)
    max_err = float(np.max(abs_err))
    mae = float(np.mean(abs_err))
    mse = float(np.mean(residual ** 2))
    rmse = float(np.sqrt(mse))

    # Signal power vs noise power
    sig_power = float(np.mean(orig ** 2))
    if mse > 1e-12 and sig_power > 1e-12:
        sqnr_db = float(10.0 * np.log10(sig_power / mse))
    else:
        sqnr_db = float("inf")

    # Saturation / clipping count
    clipped_high = int(np.sum(orig > Q88_FLOAT_MAX))
    clipped_low = int(np.sum(orig < Q88_FLOAT_MIN))

    return {
        "step_size": Q88_STEP,
        "theoretical_max_error": Q88_STEP / 2.0,  # 0.001953125
        "empirical_max_error": round(max_err, 6),
        "mean_absolute_error": round(mae, 6),
        "root_mean_squared_error": round(rmse, 6),
        "sqnr_db": round(sqnr_db, 2),
        "clipped_samples_high": clipped_high,
        "clipped_samples_low": clipped_low,
    }


def main():
    parser = argparse.ArgumentParser(description="Q8.8 Fixed-Point Quantization Tool.")
    parser.add_argument("--test-values", nargs="+", type=float, default=[0.0, 1.0, -1.0, 3.14159, 0.00390625, 127.5])
    args = parser.parse_args()

    print("=" * 60)
    print("NeuroNose Q8.8 Fixed-Point Quantizer")
    print(f"Format: Signed 16-bit (8 integer, 8 fractional)")
    print(f"Range: [{Q88_FLOAT_MIN}, {Q88_FLOAT_MAX}] | LSB Resolution: {Q88_STEP:.6f}")
    print("=" * 60)

    for val in args.test_values:
        raw = float_to_q88(val)
        rec = q88_to_float(raw)
        err = abs(val - rec)
        hex_str = f"16'h{raw & 0xFFFF:04X}"
        print(f"Float: {val:10.5f} -> Q8.8 Raw: {raw:6d} ({hex_str}) -> Reconstructed: {rec:10.5f} | Residual: {err:.6f}")

    # Quantization error analysis on synthetic signal
    synthetic_signal = np.sin(np.linspace(0, 10, 1000)) * 5.0 + 2.5
    err_report = compute_quantization_error(synthetic_signal)
    print("\nQuantization Error Analysis (Synthetic Signal):")
    print(json.dumps(err_report, indent=2))


if __name__ == "__main__":
    main()
