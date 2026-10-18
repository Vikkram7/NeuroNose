# NeuroNose RTL Verification & Architecture Guide

## Overview
NeuroNose features a synthesizable SystemVerilog hardware pipeline tailored for FPGA edge-inference and sensor preprocessing. All digital signal processing is executed in signed **Q8.8 fixed-point format** (1 sign bit, 7 integer bits, 8 fractional bits), providing bit-exact equivalence with our Python golden reference model.

## Numerical Representation: Q8.8
- **Word Length**: 16 bits signed (`logic signed [15:0]`)
- **Format**: `s7.8` (1 sign bit, 7 magnitude bits, 8 fractional bits)
- **Scale Factor**: $2^8 = 256$
- **Dynamic Range**: $[-128.0000, +127.9961]$
- **Resolution**: $1/256 \approx 0.00390625$
- **Overflow / Saturation**: Saturating arithmetic clamps at `0x7FFF` (+127.996) and `0x8000` (-128.000).

## Module Summary & Latency

| Module | Synthesizable | Function | Pipeline Latency |
| :--- | :--- | :--- | :--- |
| `sensor_stream_interface.sv` | Yes | Serial byte-stream deserializer with frame sync & timeout | 1 cycle / byte |
| `packet_validator.sv` | Yes | CRC-8 (polynomial 0x31), sequence counter, length verification | 2 clock cycles |
| `fixed_point_filter.sv` | Yes | 1st-order IIR digital low-pass with saturating arithmetic | 2 clock cycles |
| `baseline_corrector.sv` | Yes | Background drift subtraction with auto-tare & floor clamping | 1 clock cycle |
| `feature_extractor.sv` | Yes | Rolling statistical window (Min, Max, Mean, Energy, Variance) | Window size ($N$ samples) |
| `threshold_classifier.sv` | Yes | Fixed-point multivariate bounding-box classifier | 2 clock cycles |
| `anomaly_flagger.sv` | Yes | Upper/lower bound violations, stuck-at, rate-of-change check | 1 clock cycle |
| `sensor_health_monitor.sv` | Yes | Heartbeat watchdog, consecutive error tracker, degradation flags | 1 clock cycle |
| `register_interface.sv` | Yes | Memory-mapped 32-bit register bank for host MCU/SoC | 1 clock cycle R/W |
| `uart_tx.sv` / `uart_rx.sv` | Yes | 115200 baud UART physical transceivers with 16x oversampling | Bit-time based |
| `neuronose_top.sv` | Yes | Top-level integration wiring all blocks with valid/ready handshakes | Synchronous pipelined |

## Simulation with Icarus Verilog
To run testbenches locally:
```bash
cd verification
bash run_tests.sh
```

Or individual simulation:
```bash
iverilog -g2012 -I ../rtl -o tb_fixed_point_filter.vvp ../rtl/neuronose_pkg.sv ../rtl/*.sv ../tb/tb_fixed_point_filter.sv
vvp tb_fixed_point_filter.vvp
```

Waveforms can be inspected with GTKWave:
```bash
gtkwave tb_fixed_point_filter.vcd
```

## Golden Reference Equivalence
For systems without Icarus Verilog installed, bit-exact equivalence is guaranteed by `python-ml/rtl_reference.py`, which is verified via pytest against `verification/test_vectors.csv`.
Run:
```bash
pytest python-ml/tests/test_pipeline.py -k test_rtl_reference_bit_exact -v
```
