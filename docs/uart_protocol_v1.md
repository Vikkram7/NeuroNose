# NeuroNose UART Packet Protocol v1.0

## Overview

This document defines the serial communication protocol between the FPGA hardware and the host system. The protocol is designed for reliable, versioned data transfer over UART.

## Physical Layer

| Parameter | Value |
|-----------|-------|
| Baud Rate | 115200 (configurable) |
| Data Bits | 8 |
| Parity | None |
| Stop Bits | 1 |
| Flow Control | None |

## Packet Format

All multi-byte fields are **little-endian**.

```
┌──────┬─────────┬──────┬─────┬─────────────┬──────┬──────┐
│ SYNC │ VERSION │ TYPE │ LEN │   PAYLOAD   │ CRC8 │ TAIL │
│ 0xAA │  1 byte │1 byte│1 byte│ LEN bytes  │1 byte│ 0x55 │
└──────┴─────────┴──────┴─────┴─────────────┴──────┴──────┘
```

### Field Descriptions

| Field | Size | Description |
|-------|------|-------------|
| SYNC | 1 byte | Start-of-frame marker: `0xAA` |
| VERSION | 1 byte | Protocol version: `0x01` |
| TYPE | 1 byte | Packet type (see below) |
| LEN | 1 byte | Payload length in bytes (0–200) |
| PAYLOAD | LEN bytes | Type-dependent data |
| CRC8 | 1 byte | CRC-8/MAXIM over VERSION+TYPE+LEN+PAYLOAD |
| TAIL | 1 byte | End-of-frame marker: `0x55` |

### CRC-8 Specification

- **Polynomial**: 0x31 (x⁸ + x⁵ + x⁴ + 1)
- **Init**: 0x00
- **Reflect**: No
- **XOR Out**: 0x00
- **Check**: CRC8(0x31, "123456789") = 0xA1

## Packet Types

| Type | Value | Direction | Description |
|------|-------|-----------|-------------|
| SENSOR_DATA | 0x01 | FPGA → Host | Sensor channel readings |
| FEATURE_DATA | 0x02 | FPGA → Host | Extracted features |
| CLASSIFICATION | 0x03 | FPGA → Host | Classification result |
| HEALTH_STATUS | 0x04 | FPGA → Host | Sensor health report |
| ANOMALY_ALERT | 0x05 | FPGA → Host | Anomaly detection alert |
| CONFIG_WRITE | 0x10 | Host → FPGA | Write configuration register |
| CONFIG_READ | 0x11 | Host → FPGA | Read configuration register |
| CONFIG_RESP | 0x12 | FPGA → Host | Configuration read response |
| CALIBRATE_CMD | 0x20 | Host → FPGA | Calibration command |
| CALIBRATE_ACK | 0x21 | FPGA → Host | Calibration acknowledgment |
| STATUS_REQ | 0x30 | Host → FPGA | Request device status |
| STATUS_RESP | 0x31 | FPGA → Host | Device status response |
| RESET_CMD | 0xFF | Host → FPGA | System reset command |

## Payload Formats

### SENSOR_DATA (0x01)

```
┌───────┬────────┬──────────┬─────────────────────────────┬──────┬──────┐
│ SEQ   │ TIMESTAMP │ N_CH  │ CH[0]..CH[N-1] (Q8.8 each) │ TEMP │ HUM  │
│ 2 bytes│ 4 bytes  │ 1 byte│ N×2 bytes                   │2 bytes│2 bytes│
└───────┴────────┴──────────┴─────────────────────────────┴──────┴──────┘
```

- **SEQ**: 16-bit sequence number (wraps at 65535)
- **TIMESTAMP**: 32-bit millisecond counter since last reset
- **N_CH**: Number of sensor channels (1–8)
- **CH[i]**: Q8.8 signed fixed-point sensor reading
- **TEMP**: Q8.8 temperature in °C
- **HUM**: Q8.8 relative humidity in %

### FEATURE_DATA (0x02)

```
┌───────┬──────┬──────────────────────────────────────────┐
│ SEQ   │ N_CH │ For each channel: MIN MAX MEAN VAR ENERGY │
│ 2 bytes│1 byte│ N × 5 × 2 bytes (Q8.8 each)              │
└───────┴──────┴──────────────────────────────────────────┘
```

### CLASSIFICATION (0x03)

```
┌───────┬──────────┬───────┬────────────┐
│ SEQ   │ CLASS_ID │ SCORE │ N_CLASSES  │
│ 2 bytes│ 1 byte  │ 2 bytes│ 1 byte    │
└───────┴──────────┴───────┴────────────┘
```

- **CLASS_ID**: Predicted class index (0-based)
- **SCORE**: Q8.8 match score (higher = better match)

### HEALTH_STATUS (0x04)

```
┌───────┬──────┬──────────────────────────────┐
│ SEQ   │ N_CH │ For each channel: STATUS FLAGS│
│ 2 bytes│1 byte│ N × 2 bytes                  │
└───────┴──────┴──────────────────────────────┘
```

Channel STATUS byte:
- `0x00`: OK
- `0x01`: WARNING
- `0x02`: FAULT
- `0x03`: OFFLINE

Channel FLAGS byte:
- Bit 0: Out of range
- Bit 1: Stuck at value
- Bit 2: Excessive rate of change
- Bit 3: Missing data
- Bit 4: Drift detected
- Bits 5-7: Reserved

### ANOMALY_ALERT (0x05)

```
┌───────┬─────────┬──────────┬──────────┐
│ SEQ   │ CHANNEL │ ALERT_TYPE│ VALUE   │
│ 2 bytes│ 1 byte │ 1 byte   │ 2 bytes  │
└───────┴─────────┴──────────┴──────────┘
```

### CONFIG_WRITE (0x10)

```
┌───────┬──────────┬───────┐
│ ADDR  │  VALUE   │ MASK  │
│ 2 bytes│ 4 bytes │ 4 bytes│
└───────┴──────────┴───────┘
```

## Sequence Numbers

- Each packet type maintains its own sequence counter
- Host should detect gaps > 1 as potential packet loss
- Counter wraps from 0xFFFF to 0x0000

## Error Handling

- Invalid SYNC byte: discard, scan for next 0xAA
- CRC mismatch: discard packet, increment error counter
- Invalid TAIL: discard packet
- Timeout: if no complete packet received within 1 second, reset parser state
- Sequence gap: log warning, continue processing

## Timing

- Minimum inter-packet gap: 1 byte time (~87 µs at 115200 baud)
- Maximum packet size: 206 bytes (header + 200 payload + CRC + tail)
- Maximum transmission time per packet: ~18 ms at 115200 baud

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-01 | Initial protocol specification |
