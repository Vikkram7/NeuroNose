# NeuroNose Hardware Integration Guide

## Overview

This guide covers connecting the NeuroNose FPGA design to physical hardware. The system is designed to be **simulation-first** — all functionality can be verified without any physical hardware.

> [!WARNING]
> No physical hardware has been tested with this design. All claims about hardware behavior are based on simulation and RTL analysis only.

## Supported FPGA Targets (Planned)

| Board | FPGA | Status |
|-------|------|--------|
| Digilent Basys 3 | Xilinx Artix-7 XC7A35T | RTL compatible, not tested |
| Terasic DE10-Lite | Intel MAX 10 10M50DAF | RTL compatible, not tested |
| Lattice iCE40-HX8K | iCE40 HX8K | RTL compatible, not tested |

## Sensor Hardware

### Recommended Sensor Array

The system is designed for metal-oxide (MOX) gas sensor arrays. Suggested sensors:

| Sensor | Target Gas | Interface |
|--------|-----------|-----------|
| MQ-2 | Combustible gas, smoke | Analog (ADC required) |
| MQ-3 | Alcohol vapor | Analog |
| MQ-4 | Methane, natural gas | Analog |
| MQ-5 | LPG, natural gas | Analog |
| MQ-6 | LPG, butane | Analog |
| MQ-7 | Carbon monoxide | Analog |
| MQ-8 | Hydrogen | Analog |
| MQ-135 | Air quality (NH3, benzene) | Analog |
| DHT22 | Temperature + Humidity | Digital (1-wire) |

> [!CAUTION]
> - Do NOT test with toxic, flammable, or hazardous gases
> - Use only safe samples: coffee, tea, fruit, ambient air
> - Work in well-ventilated areas
> - Follow all sensor datasheet safety guidelines

### ADC Requirements

- Resolution: 12-bit minimum (recommended 16-bit)
- Channels: 8+ analog inputs
- Sample rate: 10–100 Hz per channel
- Interface: SPI recommended

Suggested ADCs:
- ADS1115 (16-bit, 4-channel, I2C)
- MCP3008 (10-bit, 8-channel, SPI)
- ADS7950 (12-bit, 8-channel, SPI)

## Pin Assignments

Pin assignments must be created for each target board. Template:

```
# Basys 3 example (XDC format)
# set_property PACKAGE_PIN <pin> [get_ports clk]
# set_property IOSTANDARD LVCMOS33 [get_ports clk]
# ... (create for your specific board)
```

Place board-specific constraint files in `hardware/<board_name>/`.

## FPGA Synthesis

### Vivado (Xilinx)

```bash
# 1. Create project
vivado -mode batch -source scripts/create_vivado_project.tcl

# 2. Run synthesis
vivado -mode batch -source scripts/run_synthesis.tcl

# 3. Generate bitstream
vivado -mode batch -source scripts/generate_bitstream.tcl
```

### Quartus (Intel/Altera)

```bash
# 1. Create project
quartus_sh --script scripts/create_quartus_project.tcl

# 2. Compile
quartus_sh --flow compile neuronose
```

> [!NOTE]
> Synthesis scripts are templates. Actual resource utilization, timing closure, and power consumption can only be determined by running synthesis on a specific target.

## UART Connection

1. Connect FPGA UART TX pin to USB-UART adapter RX
2. Connect FPGA UART RX pin to USB-UART adapter TX
3. Connect GND
4. Configure: 115200 baud, 8N1

## Calibration Procedure

1. Power up system in ambient air for 30 minutes (sensor warm-up)
2. Start baseline capture via configuration register
3. Expose sensors to known reference samples
4. Record baseline values
5. Update calibration record via API

## Hardware Checklist

- [ ] FPGA board selected and powered
- [ ] Constraint file created for target board
- [ ] Synthesis completed without critical warnings
- [ ] Timing closure achieved
- [ ] UART connection tested with loopback
- [ ] ADC connected and reading analog channels
- [ ] Sensor array connected to ADC inputs
- [ ] Temperature/humidity sensor connected
- [ ] Baseline calibration performed
- [ ] End-to-end data flow verified

## Troubleshooting

| Issue | Possible Cause | Solution |
|-------|---------------|----------|
| No UART data | Wrong baud rate | Verify CLK_FREQ parameter matches actual clock |
| Corrupted packets | Signal integrity | Add series resistors, check ground connection |
| Stuck readings | Sensor warm-up | Wait 5+ minutes after power-on |
| All zeros | ADC not connected | Check SPI/I2C wiring |
| Overflow values | Sensor out of range | Check input voltage range vs ADC reference |
