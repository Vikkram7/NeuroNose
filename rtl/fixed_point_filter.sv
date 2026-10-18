// ============================================================================
// File: rtl/fixed_point_filter.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Configurable fixed-point digital low-pass filter supporting both
//              1st-order IIR (exponential moving average) and 4-tap moving average.
//              Implements Q8.8 fixed-point arithmetic with symmetric rounding,
//              saturation handling (clamping, no wrapping), and bypass mode.
// Synthesizable: YES
// Latency: 1 cycle
// ============================================================================

`default_nettype none

module fixed_point_filter #(
  parameter int DATA_WIDTH   = 16, // Q8.8 signed format
  parameter int COEFF_WIDTH  = 16, // Q8.8 signed format
  parameter int FILTER_ORDER = 4
) (
  input  logic clk,
  input  logic rst,

  // Configuration Ports
  input  logic signed [COEFF_WIDTH-1:0] coeff_alpha, // Alpha for IIR (1.0 = 16'h0100)
  input  logic                         filter_mode, // 0: IIR, 1: 4-Tap Moving Average
  input  logic                         bypass,      // 1: Pass raw data unchanged

  // Upstream Data Handshake
  input  logic signed [DATA_WIDTH-1:0] in_data,
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Data Handshake
  output logic signed [DATA_WIDTH-1:0] out_data,
  output logic                         out_valid,
  input  logic                         out_ready
);

  import neuronose_pkg::*;

  // State registers for IIR history and MA delay line
  logic signed [DATA_WIDTH-1:0] y_prev;
  logic signed [DATA_WIDTH-1:0] ma_taps [FILTER_ORDER-1:0];

  // Pipeline output registers
  logic signed [DATA_WIDTH-1:0] reg_out_data;
  logic                         reg_out_valid;

  // Symmetric Rounding and Saturation function for 34-bit accumulator (Q16.16 -> Q8.8)
  function automatic logic signed [DATA_WIDTH-1:0] round_and_sat_q8_8(
    input logic signed [33:0] val_q16_16
  );
    logic signed [33:0] rounded;
    logic signed [33:0] shifted;
    begin
      // Symmetric rounding: add +128 for non-negative, -128 for negative
      if (val_q16_16 >= 0) begin
        rounded = val_q16_16 + 34'sd128;
      end else begin
        rounded = val_q16_16 - 34'sd128;
      end

      shifted = rounded >>> FRAC_BITS; // Shift off fractional bits

      // Saturation to 16-bit signed range [-32768, +32767]
      if (shifted > 34'sd32767) begin
        return 16'sh7FFF;
      end else if (shifted < -34'sd32768) begin
        return -16'sh8000;
      end else begin
        return shifted[15:0];
      end
    end
  endfunction

  // Round and Saturate for Moving Average sum (Sum of 4 Q8.8 samples / 4)
  function automatic logic signed [DATA_WIDTH-1:0] round_and_sat_ma(
    input logic signed [19:0] sum_val
  );
    logic signed [19:0] rounded;
    logic signed [19:0] shifted;
    begin
      // Divide by 4: shift right 2 with symmetric rounding (+2 for >=0, -2 for <0)
      if (sum_val >= 0) begin
        rounded = sum_val + 20'sd2;
      end else begin
        rounded = sum_val - 20'sd2;
      end

      shifted = rounded >>> 2;

      if (shifted > 20'sd32767) begin
        return 16'sh7FFF;
      end else if (shifted < -20'sd32768) begin
        return -16'sh8000;
      end else begin
        return shifted[15:0];
      end
    end
  endfunction

  // Combinational calculation
  logic signed [33:0] p_x;
  logic signed [33:0] p_y;
  logic signed [33:0] sum_iir;
  logic signed [COEFF_WIDTH-1:0] coeff_beta;
  logic signed [DATA_WIDTH-1:0] filtered_iir;

  logic signed [19:0] sum_ma;
  logic signed [DATA_WIDTH-1:0] filtered_ma;
  logic signed [DATA_WIDTH-1:0] result_comb;

  always_comb begin
    // Beta = 1.0 - Alpha (in Q8.8, 1.0 is 16'sh0100)
    coeff_beta = 16'sh0100 - coeff_alpha;

    // IIR Products: Alpha * X[n] + Beta * Y[n-1]
    p_x = in_data * coeff_alpha;
    p_y = y_prev * coeff_beta;
    sum_iir = p_x + p_y;
    filtered_iir = round_and_sat_q8_8(sum_iir);

    // 4-Tap Moving Average: (X[n] + X[n-1] + X[n-2] + X[n-3]) / 4
    sum_ma = in_data + ma_taps[0] + ma_taps[1] + ma_taps[2];
    filtered_ma = round_and_sat_ma(sum_ma);

    // Mode selection
    if (bypass) begin
      result_comb = in_data;
    end else if (filter_mode == 1'b1) begin
      result_comb = filtered_ma;
    end else begin
      result_comb = filtered_iir;
    end
  end

  // Handshake: ready if output is not stalled
  assign in_ready = (!reg_out_valid) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      y_prev        <= '0;
      reg_out_data  <= '0;
      reg_out_valid <= 1'b0;
      for (int i = 0; i < FILTER_ORDER; i = i + 1) begin
        ma_taps[i] <= '0;
      end
    end else begin
      // Downstream consumption
      if (reg_out_valid && out_ready) begin
        reg_out_valid <= 1'b0;
      end

      // Upstream sample acceptance
      if (in_valid && in_ready) begin
        reg_out_data  <= result_comb;
        reg_out_valid <= 1'b1;

        // Update filter state history
        y_prev <= result_comb;

        // Shift moving average delay line
        ma_taps[0] <= in_data;
        ma_taps[1] <= ma_taps[0];
        ma_taps[2] <= ma_taps[1];
        ma_taps[3] <= ma_taps[2];
      end
    end
  end

  assign out_data  = reg_out_data;
  assign out_valid = reg_out_valid;

endmodule

`default_nettype wire
