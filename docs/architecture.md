# NeuroNose Architecture Document

## System Overview

NeuroNose is a full-stack electronic nose platform combining FPGA-accelerated signal processing, machine learning classification, and a live monitoring dashboard. The system follows a **simulation-first** methodology — all functionality is verified in simulation before any physical hardware deployment.

## Component Architecture

```mermaid
graph TD
    subgraph "Data Sources"
        SIM[Python Sensor Simulator]
        HW[Physical Sensors - Optional]
    end

    subgraph "FPGA Pipeline"
        SSI[Sensor Stream Interface]
        PV[Packet Validator]
        FPF[Fixed-Point Filter]
        BC[Baseline Corrector]
        FE[Feature Extractor]
        TC[Threshold Classifier]
        AF[Anomaly Flagger]
        SHM[Sensor Health Monitor]
        RI[Register Interface]
        UT[UART TX/RX]
    end

    subgraph "ML Pipeline"
        PP[Preprocessing]
        FEng[Feature Engineering]
        RF[Random Forest Classifier]
        ND[Novelty Detector]
        DD[Drift Detector]
    end

    subgraph "Backend"
        API[Spring Boot REST API]
        DB[(PostgreSQL)]
    end

    subgraph "Frontend"
        DASH[React Dashboard]
    end

    SIM --> SSI
    HW --> SSI
    SSI --> PV --> FPF --> BC --> FE --> TC
    FE --> AF
    FE --> SHM
    BC --> RI
    TC --> UT --> API
    SIM --> PP --> FEng --> RF
    RF --> API
    ND --> API
    DD --> API
    API --> DB
    API --> DASH
```

## Data Flow

### Simulation Mode (Default)
1. `sensor_data_generator.py` creates deterministic synthetic sensor readings
2. Data is fed to either:
   - RTL pipeline via testbench or simulation interface
   - Python ML pipeline directly
3. Results are posted to the Java backend via REST API
4. Frontend polls backend for display

### Hardware Mode (When Available)
1. Physical sensors → ADC → FPGA input pins
2. RTL pipeline processes data in real-time
3. UART transmits packets to host
4. Host software parses packets and forwards to backend
5. Frontend displays live data

## Fixed-Point Format: Q8.8

All RTL arithmetic uses **Q8.8 signed fixed-point**:
- 16 bits total: 1 sign + 7 integer + 8 fractional
- Range: -128.0 to +127.99609375
- Resolution: 1/256 ≈ 0.00390625
- Overflow handling: Saturation (clamp to min/max)

## Register Map

| Address | Name | R/W | Description |
|---------|------|-----|-------------|
| 0x0000 | CTRL | R/W | Control register (enable, reset, mode) |
| 0x0004 | STATUS | R | Status register (health, errors) |
| 0x0008 | SAMPLE_RATE | R/W | Sampling rate divisor |
| 0x000C | FILTER_COEFF | R/W | Filter coefficient (Q8.8) |
| 0x0010-0x002F | BASELINE[0-7] | R/W | Per-channel baselines (Q8.8) |
| 0x0030-0x004F | THRESH_LO[0-7] | R/W | Per-channel low thresholds |
| 0x0050-0x006F | THRESH_HI[0-7] | R/W | Per-channel high thresholds |
| 0x0070-0x00AF | CLASS_THRESH[0-7][0-4] | R/W | Classification thresholds |
| 0x00B0 | HEALTH_FLAGS | R | Channel health flags |
| 0x00B4 | ANOMALY_FLAGS | R | Anomaly detection flags |
| 0x00B8 | SEQ_COUNT | R | Packet sequence counter |
| 0x00BC | ERROR_COUNT | R | Error counter |

## Database Schema (ERD)

```mermaid
erDiagram
    DEVICE ||--o{ SENSOR_SAMPLE : has
    DEVICE ||--o{ ALERT : triggers
    DEVICE ||--o{ CALIBRATION_RECORD : calibrated_by
    SENSOR_SAMPLE ||--o| PREDICTION : analyzed_by
    
    DEVICE {
        uuid id PK
        string name
        string description
        string location
        int channel_count
        string status
        timestamp last_seen_at
        timestamp created_at
    }
    
    SENSOR_SAMPLE {
        uuid id PK
        uuid device_id FK
        string channel_readings
        double temperature
        double humidity
        string session_id
        string data_source
        timestamp timestamp
    }
    
    PREDICTION {
        uuid id PK
        uuid sample_id FK
        string predicted_class
        double confidence
        string model_version
        boolean is_novel
        double novelty_score
        timestamp created_at
    }
    
    ALERT {
        uuid id PK
        uuid device_id FK
        string severity
        string alert_type
        string message
        boolean acknowledged
        timestamp created_at
    }
    
    CALIBRATION_RECORD {
        uuid id PK
        uuid device_id FK
        string version
        string baseline_values
        string notes
        timestamp calibrated_at
    }
    
    MODEL_VERSION {
        uuid id PK
        string version
        string algorithm
        double accuracy
        double f1_score
        boolean is_active
        timestamp trained_at
    }
```

## API Design Principles

1. **REST conventions**: Proper HTTP methods and status codes
2. **Pagination**: `page`, `size`, `sort` parameters for list endpoints
3. **Filtering**: Query parameters for date ranges, status, device
4. **Validation**: Bean Validation on all inputs
5. **Error format**: Consistent `{timestamp, status, error, message}` structure
6. **Timestamps**: UTC in storage, ISO 8601 in API responses
7. **CORS**: Configured for development origins only

## Security Model

- Development mode: No authentication required (clearly documented)
- Production mode: Spring Security with BCrypt-hashed passwords (template provided)
- CORS restricted to configured origins
- Environment variables for all secrets
- No secrets in version control
