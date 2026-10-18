# NeuroNose: Final-Year Engineering Project Report — Outline

## Chapter 1: Introduction
### 1.1 Background and Motivation
- Electronic nose technology overview
- Gap analysis: need for FPGA-accelerated pattern classification
- Simulation-first development methodology

### 1.2 Problem Statement
- Real-time volatile pattern classification challenges
- Sensor drift and reliability issues
- Need for edge computing in sensor systems

### 1.3 Objectives
- Design FPGA-accelerated sensor processing pipeline
- Implement ML-based pattern classification with novelty detection
- Build full-stack monitoring and analytics platform
- Demonstrate simulation-first verification methodology

### 1.4 Scope and Limitations
- Simulation-first: no physical hardware measurements without explicit verification
- Research application, not certified analytical instrument
- Synthetic data evaluation only unless stated otherwise

## Chapter 2: Literature Review
### 2.1 Electronic Nose Systems
### 2.2 FPGA-Based Signal Processing
### 2.3 Machine Learning for Gas Classification
### 2.4 Sensor Drift Compensation
### 2.5 Fixed-Point Arithmetic for Edge Inference

## Chapter 3: System Architecture
### 3.1 Overall Architecture
### 3.2 RTL Processing Pipeline
### 3.3 UART Communication Protocol
### 3.4 ML Classification Pipeline
### 3.5 Backend API Design
### 3.6 Frontend Dashboard Design
### 3.7 Data Flow and Integration

## Chapter 4: RTL Design and Verification
### 4.1 Fixed-Point Arithmetic (Q8.8)
### 4.2 Sensor Stream Interface
### 4.3 Packet Validation
### 4.4 Digital Filtering
### 4.5 Baseline Correction
### 4.6 Feature Extraction
### 4.7 Threshold Classification
### 4.8 Anomaly Detection
### 4.9 Sensor Health Monitoring
### 4.10 Testbench Methodology and Results
- NOTE: All results from simulation only. Report simulation tool, version, and methodology.

## Chapter 5: Machine Learning Pipeline
### 5.1 Synthetic Data Generation
### 5.2 Feature Engineering
### 5.3 Model Selection and Training
### 5.4 Evaluation Metrics
- NOTE: All metrics from synthetic data. Clearly label as such.
### 5.5 Novelty Detection
### 5.6 Drift Detection
### 5.7 Quantization Analysis

## Chapter 6: Software Implementation
### 6.1 Java Backend Architecture
### 6.2 Database Design
### 6.3 REST API Design
### 6.4 Frontend Dashboard
### 6.5 Real-Time Data Pipeline

## Chapter 7: Results and Analysis
### 7.1 RTL Simulation Results
- NOTE: From Icarus Verilog simulation or Python reference model
### 7.2 ML Classification Performance
- NOTE: On synthetic data only
### 7.3 RTL vs Python Reference Comparison
### 7.4 System Integration Testing
### 7.5 Quantization Error Analysis

## Chapter 8: Discussion
### 8.1 Achievements
### 8.2 Limitations
### 8.3 Simulation vs Physical Measurement
### 8.4 Potential Improvements

## Chapter 9: Conclusion and Future Work
### 9.1 Summary of Contributions
### 9.2 Future Hardware Integration
### 9.3 Advanced ML Models
### 9.4 Deployment Considerations

## Appendices
### A. UART Protocol Specification
### B. Register Map
### C. API Documentation
### D. Dataset Schema
### E. Test Vector Format
### F. Setup and Installation Guide
