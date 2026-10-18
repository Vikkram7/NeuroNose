# NeuroNose

**FPGA-Accelerated Intelligent Electronic Nose for Volatile Pattern Classification, Anomaly Detection, and Sensor Health Monitoring**

> [!NOTE]
> This is a simulation-first project. All sensor data is synthetic unless explicitly connected to physical hardware. Results labeled "SIMULATED" are generated from deterministic models and should not be interpreted as real sensor measurements.

## Architecture Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
│  Sensor Sim  │────▶│  RTL Pipeline │────▶│  Java Backend  │────▶│  Dashboard   │
│  (Python)    │     │  (Verilog)    │     │  (Spring Boot) │     │  (React/TS)  │
└─────────────┘     └──────────────┘     └────────────────┘     └──────────────┘
       │                    │                     │                      │
       ▼                    ▼                     ▼                      ▼
  Synthetic Data    Fixed-Point DSP      PostgreSQL + REST       Real-Time Charts
  ML Training       Feature Extract      Predictions API         Fingerprints
  Quantization      Classification       Device Management       Alerts & Reports
```

### Data Pipeline
1. **Sensor Acquisition** → Synthetic generator or physical sensor array (8 channels + temp/humidity)
2. **RTL Processing** → Packet validation → IIR filtering → Baseline correction → Feature extraction → Threshold classification → Anomaly flagging → Health monitoring
3. **ML Classification** → Random Forest / SVM classifier with novelty detection and drift analysis
4. **Backend API** → REST endpoints for samples, predictions, devices, alerts, calibration, analytics
5. **Live Dashboard** → Real-time charts, fingerprint comparison, ML analytics, RTL validation

## Prerequisites

| Tool | Version | Required |
|------|---------|----------|
| Java JDK | 21+ | ✅ |
| Maven | 3.9+ | ✅ |
| Node.js | 20+ | ✅ |
| npm | 10+ | ✅ |
| Python | 3.10+ | ✅ |
| Docker & Docker Compose | Latest | ✅ (for PostgreSQL) |
| Git | 2.x | ✅ |
| Icarus Verilog | 12+ | Optional (for RTL simulation) |
| GTKWave | 3.x | Optional (for waveform viewing) |

## Quick Start

### 1. Clone and Configure
```bash
git clone <repo-url> neuronose
cd neuronose
cp .env.example .env
# Edit .env if needed (defaults work for development)
```

### 2. Start Database
```bash
docker compose up -d
```

### 3. Generate Synthetic Dataset
```bash
cd python-ml
pip install -r requirements.txt
python -m datasets.generate_demo_data
python train_model.py
python evaluate_model.py
```

### 4. Start Java Backend
```bash
cd java-backend
mvn spring-boot:run -Dspring-boot.run.profiles=dev
# API available at http://localhost:8080
# Swagger UI at http://localhost:8080/swagger-ui.html
```

### 5. Start Frontend
```bash
cd frontend
npm install
npm run dev
# Dashboard at http://localhost:5173
```

### 6. (Optional) RTL Simulation
```bash
# Requires Icarus Verilog installation
cd verification
bash run_tests.sh
# Or on Windows: see verification/README.md
```

## Project Structure

```
neuronose/
├── rtl/                    # Synthesizable Verilog/SystemVerilog
│   ├── neuronose_pkg.sv    # Package with parameters and types
│   ├── sensor_stream_interface.sv
│   ├── packet_validator.sv
│   ├── fixed_point_filter.sv
│   ├── baseline_corrector.sv
│   ├── feature_extractor.sv
│   ├── threshold_classifier.sv
│   ├── anomaly_flagger.sv
│   ├── sensor_health_monitor.sv
│   ├── uart_tx.sv
│   ├── uart_rx.sv
│   ├── register_interface.sv
│   └── neuronose_top.sv
├── tb/                     # Simulation testbenches (non-synthesizable)
│   ├── tb_fixed_point_filter.sv
│   ├── tb_packet_validator.sv
│   ├── tb_threshold_classifier.sv
│   ├── tb_anomaly_flagger.sv
│   └── tb_neuronose_top.sv
├── verification/           # Test vectors and verification scripts
│   ├── test_vectors.csv
│   ├── run_tests.sh
│   └── README.md
├── python-ml/              # Machine learning pipeline
│   ├── config.py
│   ├── sensor_data_generator.py
│   ├── dataset_loader.py
│   ├── preprocessing.py
│   ├── feature_engineering.py
│   ├── train_model.py
│   ├── evaluate_model.py
│   ├── predict.py
│   ├── novelty_detector.py
│   ├── drift_detector.py
│   ├── quantization.py
│   ├── rtl_reference.py
│   ├── api.py
│   ├── requirements.txt
│   └── tests/
├── java-backend/           # Spring Boot REST API
│   ├── pom.xml
│   └── src/
├── frontend/               # React/TypeScript dashboard
│   ├── package.json
│   └── src/
├── datasets/               # Synthetic and benchmark datasets
├── scripts/                # Utility and setup scripts
├── docs/                   # Documentation and reports
├── hardware/               # FPGA board-specific files
├── docker-compose.yml      # PostgreSQL setup
├── .env.example            # Environment template
├── .gitignore
└── README.md               # This file
```

## Technology Stack

| Layer | Technology |
|-------|-----------|
| RTL | Verilog/SystemVerilog (Q8.8 fixed-point) |
| Simulation | Icarus Verilog + GTKWave |
| ML | Python, scikit-learn, NumPy, pandas |
| Backend | Java 21, Spring Boot 3.3, Maven |
| Database | PostgreSQL 16, H2 (tests) |
| Frontend | React 18, TypeScript, Vite, Recharts, Tailwind CSS |
| Infrastructure | Docker Compose |

## RTL Pipeline

All RTL uses **Q8.8 signed fixed-point** format (16-bit: 8 integer + 8 fractional bits).

| Module | Function | Latency |
|--------|----------|---------|
| sensor_stream_interface | Deserialize channel data | 1 cycle/byte |
| packet_validator | CRC-8, length, sequence check | 2 cycles |
| fixed_point_filter | IIR low-pass filter | 3 cycles |
| baseline_corrector | Subtract per-channel baselines | 1 cycle |
| feature_extractor | Min/max/mean/variance/energy per window | Window size |
| threshold_classifier | Compare features vs class thresholds | 2 cycles |
| anomaly_flagger | Bounds, rate, stuck-at detection | 1 cycle |
| sensor_health_monitor | Per-channel health tracking | 1 cycle |

## ML Pipeline

| Module | Function |
|--------|----------|
| sensor_data_generator | Deterministic synthetic data with configurable noise |
| preprocessing | StandardScaler, imputation, outlier clipping |
| feature_engineering | Statistical and cross-channel features |
| train_model | Random Forest + SVM baseline training |
| evaluate_model | Confusion matrix, precision/recall/F1 |
| novelty_detector | Isolation Forest unknown-pattern rejection |
| drift_detector | Distribution shift detection per channel |
| quantization | Float ↔ Q8.8 conversion and error analysis |
| rtl_reference | Bit-accurate Python model of RTL pipeline |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Service health check |
| GET/POST | /api/devices | List/register devices |
| GET | /api/devices/{id} | Device details |
| GET/POST | /api/samples | List/record sensor samples |
| GET | /api/samples/{id} | Sample details |
| GET/POST | /api/predictions | List/create predictions |
| GET | /api/alerts | List alerts |
| PATCH | /api/alerts/{id}/acknowledge | Acknowledge alert |
| GET/POST | /api/calibrations | List/create calibration records |
| GET | /api/models | List ML model versions |
| GET | /api/analytics/summary | Analytics dashboard data |
| GET | /api/reports/export | Export data as CSV |

Full API documentation available at `/swagger-ui.html` when the backend is running.

## Use Cases

| Profile | Description |
|---------|-------------|
| Food Freshness | Pattern classification of fresh vs. spoiled food samples |
| VOC Monitoring | Environmental volatile organic compound anomaly detection |
| Aroma Fingerprinting | Coffee, tea, spice aroma comparison and matching |
| Drift Monitoring | Sensor baseline drift tracking and calibration |
| Unknown Rejection | Identify and reject unfamiliar/novel patterns |
| Multi-Device | Multiple device storage and fleet monitoring |

> [!WARNING]
> This system is for research and screening purposes only. It does not provide certified chemical identification, food safety analysis, medical diagnostics, or toxicological assessments.

## Testing

```bash
# Python tests
cd python-ml && pytest tests/ -v

# Java tests
cd java-backend && mvn test

# RTL simulation (requires Icarus Verilog)
cd verification && bash run_tests.sh

# Frontend type checking
cd frontend && npx tsc --noEmit
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| POSTGRES_HOST | localhost | Database host |
| POSTGRES_PORT | 5432 | Database port |
| POSTGRES_DB | neuronose | Database name |
| POSTGRES_USER | neuronose | Database user |
| POSTGRES_PASSWORD | changeme_dev_only | Database password |
| SERVER_PORT | 8080 | Backend API port |
| NEURONOSE_DEMO_MODE | true | Enable synthetic demo data |
| ML_SERVICE_PORT | 5000 | Python ML service port |

## Limitations

- **No physical hardware tested**: All data is synthetic unless explicitly connected to real sensors
- **RTL simulation only**: No FPGA synthesis results without a specific target board and toolchain
- **Synthetic ML evaluation**: Model metrics are from synthetic data and may not reflect real-world performance
- **No certified measurements**: Not suitable for regulatory, safety, or medical applications
- **Icarus Verilog required**: RTL simulation needs iverilog installation (optional)

## License

This project is an academic/research project. See LICENSE file for details.

## Contributing

This is a final-year engineering project. For academic collaboration, contact the project team.
