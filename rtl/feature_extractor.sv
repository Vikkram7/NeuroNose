// ============================================================================
// File: rtl/feature_extractor.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Computes per-channel statistical features over a configurable
//              power-of-2 sliding window: Min, Max, Mean, Energy (mean square),
//              and Variance (E[x^2] - (E[x])^2). Operates strictly in Q8.8 fixed point.
// Synthesizable: YES
// Latency: Window size cycles + 1 cycle
// ============================================================================

`default_nettype none

module feature_extractor #(
  parameter int DATA_WIDTH        = 16,
  parameter int NUM_CHANNELS      = 8,
  parameter int DEFAULT_WIN_SHIFT = 4   // Default N = 2^4 = 16 samples
) (
  input  logic clk,
  input  logic rst,

  // Configuration (Window Size = 1 << cfg_window_shift)
  input  logic [3:0] cfg_window_shift, // Valid 1 to 6 (N = 2 to 64)

  // Upstream Handshake
  input  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0],
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Feature Outputs
  output logic signed [DATA_WIDTH-1:0] feat_min      [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] feat_max      [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] feat_mean     [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] feat_variance [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] feat_energy   [NUM_CHANNELS-1:0],
  output logic                         window_complete,
  output logic                         out_valid,
  input  logic                         out_ready
);

  import neuronose_pkg::*;

  // Active window length computation
  wire [6:0] win_length = 7'd1 << cfg_window_shift;
  logic [6:0] sample_cnt;

  // Per-channel accumulators
  logic signed [DATA_WIDTH-1:0] acc_min    [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] acc_max    [NUM_CHANNELS-1:0];
  logic signed [23:0]           acc_sum    [NUM_CHANNELS-1:0];
  logic signed [41:0]           acc_energy [NUM_CHANNELS-1:0];

  // Pipeline output registers
  logic signed [DATA_WIDTH-1:0] reg_feat_min      [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_feat_max      [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_feat_mean     [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_feat_variance [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_feat_energy   [NUM_CHANNELS-1:0];
  logic                         reg_out_valid;
  logic                         reg_win_complete;

  // Arithmetic clamping helpers
  function automatic logic signed [DATA_WIDTH-1:0] sat_q8_8(input logic signed [23:0] val);
    begin
      if (val > 24'sd32767) begin
        return 16'sh7FFF;
      end else if (val < -24'sd32768) begin
        return -16'sh8000;
      end else begin
        return val[15:0];
      end
    end
  endfunction

  function automatic logic signed [DATA_WIDTH-1:0] sat_pos_q8_8(input logic signed [31:0] val);
    begin
      if (val > 32'sd32767) begin
        return 16'sh7FFF;
      end else if (val < 32'sd0) begin
        return 16'sh0000;
      end else begin
        return val[15:0];
      end
    end
  endfunction

  // Combinational Feature Calculations for completion cycle
  logic signed [DATA_WIDTH-1:0] calc_mean     [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] calc_energy   [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] calc_variance [NUM_CHANNELS-1:0];

  always_comb begin
    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      // Current cumulative sum including incoming sample
      logic signed [23:0] total_sum;
      logic signed [41:0] total_energy;
      logic signed [31:0] sample_sq;
      logic signed [23:0] mean_extended;
      logic signed [41:0] energy_norm;
      logic signed [31:0] mean_sq;
      logic signed [31:0] var_diff;

      sample_sq    = in_channel_data[i] * in_channel_data[i];
      total_sum    = (sample_cnt == 0) ? in_channel_data[i] : (acc_sum[i] + in_channel_data[i]);
      total_energy = (sample_cnt == 0) ? sample_sq          : (acc_energy[i] + sample_sq);

      // Mean = total_sum >> cfg_window_shift
      mean_extended = total_sum >>> cfg_window_shift;
      calc_mean[i]  = sat_q8_8(mean_extended);

      // Energy = total_energy / N in Q8.8 format
      // Note: sample_sq is Q16.16. Divide by N (shift window_shift) and shift 8 for Q8.8
      energy_norm    = total_energy >>> (cfg_window_shift + FRAC_BITS);
      calc_energy[i] = sat_pos_q8_8(energy_norm[31:0]);

      // Variance = Energy - (Mean^2)
      mean_sq        = (calc_mean[i] * calc_mean[i]) >>> FRAC_BITS;
      var_diff       = calc_energy[i] - mean_sq[15:0];
      calc_variance[i] = sat_pos_q8_8(var_diff);
    end
  end

  // Ready when output is not holding an unconsumed window result
  assign in_ready = (!reg_out_valid) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      sample_cnt       <= '0;
      reg_out_valid    <= 1'b0;
      reg_win_complete <= 1'b0;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        acc_min[i]           <= '0;
        acc_max[i]           <= '0;
        acc_sum[i]           <= '0;
        acc_energy[i]        <= '0;
        reg_feat_min[i]      <= '0;
        reg_feat_max[i]      <= '0;
        reg_feat_mean[i]     <= '0;
        reg_feat_variance[i] <= '0;
        reg_feat_energy[i]   <= '0;
      end
    end else begin
      // Reset single-cycle window complete flag
      reg_win_complete <= 1'b0;

      // Downstream consumption
      if (reg_out_valid && out_ready) begin
        reg_out_valid <= 1'b0;
      end

      // Ingest incoming sample
      if (in_valid && in_ready) begin
        logic is_last_sample;
        is_last_sample = (sample_cnt == (win_length - 1'b1));

        if (sample_cnt == 0) begin
          // Window starting: initialize min/max and accumulators
          for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
            acc_min[i]    <= in_channel_data[i];
            acc_max[i]    <= in_channel_data[i];
            acc_sum[i]    <= in_channel_data[i];
            acc_energy[i] <= in_channel_data[i] * in_channel_data[i];
          end
        end else begin
          // Intermediate sample accumulation
          for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
            if (in_channel_data[i] < acc_min[i]) begin
              acc_min[i] <= in_channel_data[i];
            end
            if (in_channel_data[i] > acc_max[i]) begin
              acc_max[i] <= in_channel_data[i];
            end
            acc_sum[i]    <= acc_sum[i] + in_channel_data[i];
            acc_energy[i] <= acc_energy[i] + (in_channel_data[i] * in_channel_data[i]);
          end
        end

        // Check if window is completed
        if (is_last_sample) begin
          sample_cnt       <= '0;
          reg_out_valid    <= 1'b1;
          reg_win_complete <= 1'b1;

          for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
            reg_feat_min[i]      <= (sample_cnt == 0) ? in_channel_data[i] : 
                                    ((in_channel_data[i] < acc_min[i]) ? in_channel_data[i] : acc_min[i]);
            reg_feat_max[i]      <= (sample_cnt == 0) ? in_channel_data[i] : 
                                    ((in_channel_data[i] > acc_max[i]) ? in_channel_data[i] : acc_max[i]);
            reg_feat_mean[i]     <= calc_mean[i];
            reg_feat_energy[i]   <= calc_energy[i];
            reg_feat_variance[i] <= calc_variance[i];
          end
        end else begin
          sample_cnt <= sample_cnt + 1'b1;
        end
      end
    end
  end

  assign window_complete = reg_win_complete;
  assign out_valid       = reg_out_valid;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_feat_outputs
      assign feat_min[ch]      = reg_feat_min[ch];
      assign feat_max[ch]      = reg_feat_max[ch];
      assign feat_mean[ch]     = reg_feat_mean[ch];
      assign feat_variance[ch] = reg_feat_variance[ch];
      assign feat_energy[ch]   = reg_feat_energy[ch];
    end
  endgenerate

endmodule

`default_nettype wire
