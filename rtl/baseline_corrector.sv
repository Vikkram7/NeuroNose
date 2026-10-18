// ============================================================================
// File: rtl/baseline_corrector.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Subtracts per-channel baseline reference values from raw sensor
//              readings. Features clamped subtraction to avoid negative wrapping,
//              auto-baseline capture, and register-file read/write accessibility.
// Synthesizable: YES
// Latency: 1 cycle
// ============================================================================

`default_nettype none

module baseline_corrector #(
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8
) (
  input  logic clk,
  input  logic rst,

  // Upstream Handshake
  input  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0],
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Handshake
  output logic signed [DATA_WIDTH-1:0] out_channel_data [NUM_CHANNELS-1:0],
  output logic                         out_valid,
  input  logic                         out_ready,

  // Register Configuration / Baseline Management Interface
  input  logic                         auto_baseline_trigger,
  input  logic                         reg_baseline_wr_en,
  input  logic [2:0]                   reg_baseline_ch_sel,
  input  logic signed [DATA_WIDTH-1:0] reg_baseline_wdata,
  output logic signed [DATA_WIDTH-1:0] reg_baselines [NUM_CHANNELS-1:0]
);

  import neuronose_pkg::*;

  // Per-channel baseline memory
  logic signed [DATA_WIDTH-1:0] baseline_regs [NUM_CHANNELS-1:0];

  // Registered pipeline outputs
  logic signed [DATA_WIDTH-1:0] reg_out_channels [NUM_CHANNELS-1:0];
  logic                         reg_out_valid;

  // Subtraction and Clamping logic (extended to 17 bits for signed overflow protection)
  function automatic logic signed [DATA_WIDTH-1:0] clamp_sub(
    input logic signed [DATA_WIDTH-1:0] raw_val,
    input logic signed [DATA_WIDTH-1:0] base_val
  );
    logic signed [17:0] diff;
    begin
      diff = raw_val - base_val;
      // Clamped to positive range [0, 32767]
      if (diff < 18'sd0) begin
        return 16'sh0000;
      end else if (diff > 18'sd32767) begin
        return 16'sh7FFF;
      end else begin
        return diff[15:0];
      end
    end
  endfunction

  // Combinational subtracted outputs
  logic signed [DATA_WIDTH-1:0] comb_corrected [NUM_CHANNELS-1:0];
  always_comb begin
    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      comb_corrected[i] = clamp_sub(in_channel_data[i], baseline_regs[i]);
    end
  end

  // Ready when output register is empty or downstream accepts current output
  assign in_ready = (!reg_out_valid) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      reg_out_valid <= 1'b0;
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        baseline_regs[i]    <= '0;
        reg_out_channels[i] <= '0;
      end
    end else begin
      // Baseline register configuration updates
      if (reg_baseline_wr_en) begin
        baseline_regs[reg_baseline_ch_sel] <= reg_baseline_wdata;
      end else if (auto_baseline_trigger && in_valid) begin
        // Automatic baseline snapshot of current input samples
        for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
          baseline_regs[i] <= in_channel_data[i];
        end
      end

      // Downstream consumption
      if (reg_out_valid && out_ready) begin
        reg_out_valid <= 1'b0;
      end

      // Upstream sample ingestion
      if (in_valid && in_ready) begin
        reg_out_valid <= 1'b1;
        for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
          reg_out_channels[i] <= comb_corrected[i];
        end
      end
    end
  end

  assign out_valid = reg_out_valid;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_bc_outputs
      assign out_channel_data[ch] = reg_out_channels[ch];
      assign reg_baselines[ch]    = baseline_regs[ch];
    end
  endgenerate

endmodule

`default_nettype wire
