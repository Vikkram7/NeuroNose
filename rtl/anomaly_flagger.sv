// ============================================================================
// File: rtl/anomaly_flagger.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Multi-channel anomaly detection engine. Monitors per-channel
//              boundary violations, rate-of-change spikes, stuck-at conditions,
//              and stream-level missing data timeouts.
// Synthesizable: YES
// Latency: 1 cycle
// ============================================================================

`default_nettype none

module anomaly_flagger #(
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8
) (
  input  logic clk,
  input  logic rst,

  // Upstream Sample Handshake
  input  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0],
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Anomaly Handshake
  output logic [NUM_CHANNELS-1:0]      anomaly_flags,
  output logic [2:0]                   anomaly_type,
  output logic                         anomaly_valid,
  input  logic                         out_ready,

  // Configuration Thresholds (from register interface)
  input  logic signed [DATA_WIDTH-1:0] cfg_upper_bound [NUM_CHANNELS-1:0],
  input  logic signed [DATA_WIDTH-1:0] cfg_lower_bound [NUM_CHANNELS-1:0],
  input  logic signed [DATA_WIDTH-1:0] cfg_max_rate    [NUM_CHANNELS-1:0],
  input  logic [7:0]                   cfg_stuck_threshold,
  input  logic [15:0]                  cfg_missing_threshold
);

  import neuronose_pkg::*;

  // State history
  logic signed [DATA_WIDTH-1:0] prev_data   [NUM_CHANNELS-1:0];
  logic [7:0]                   stuck_cnt   [NUM_CHANNELS-1:0];
  logic [15:0]                  missing_cnt;
  logic                         first_sample_done;

  // Registered outputs
  logic [NUM_CHANNELS-1:0] reg_anomaly_flags;
  logic [2:0]              reg_anomaly_type;
  logic                    reg_anomaly_valid;

  // Ready when output register can accept next or downstream has consumed
  assign in_ready = (!reg_anomaly_valid) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      missing_cnt        <= 16'd0;
      first_sample_done  <= 1'b0;
      reg_anomaly_flags  <= '0;
      reg_anomaly_type   <= ANOMALY_NONE;
      reg_anomaly_valid  <= 1'b0;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        prev_data[i] <= '0;
        stuck_cnt[i] <= 8'd0;
      end
    end else begin
      // Downstream consumption
      if (reg_anomaly_valid && out_ready) begin
        reg_anomaly_valid <= 1'b0;
      end

      // Missing data watchdog monitoring
      if (in_valid && in_ready) begin
        missing_cnt <= 16'd0;
      end else if (first_sample_done && (cfg_missing_threshold != 16'd0)) begin
        if (missing_cnt >= cfg_missing_threshold) begin
          // Trigger missing data anomaly
          reg_anomaly_valid <= 1'b1;
          reg_anomaly_flags <= {NUM_CHANNELS{1'b1}};
          reg_anomaly_type  <= ANOMALY_MISSING_DATA;
          missing_cnt       <= 16'd0;
        end else begin
          missing_cnt <= missing_cnt + 1'b1;
        end
      end

      // Ingest and evaluate incoming sample
      if (in_valid && in_ready) begin
        logic [NUM_CHANNELS-1:0] flags_comb;
        logic [2:0]              type_comb;
        logic signed [DATA_WIDTH:0] diff_val;
        logic signed [DATA_WIDTH-1:0] abs_diff;

        flags_comb = '0;
        type_comb  = ANOMALY_NONE;

        for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
          // Absolute difference calculation for rate of change
          diff_val = in_channel_data[i] - prev_data[i];
          if (diff_val < 0) begin
            abs_diff = -diff_val[DATA_WIDTH-1:0];
          end else begin
            abs_diff = diff_val[DATA_WIDTH-1:0];
          end

          // Stuck counter tracking
          if (first_sample_done && (in_channel_data[i] == prev_data[i])) begin
            stuck_cnt[i] <= stuck_cnt[i] + 1'b1;
          end else begin
            stuck_cnt[i] <= 8'd0;
          end

          // Priority 1: Out of bounds check
          if ((in_channel_data[i] > cfg_upper_bound[i]) ||
              (in_channel_data[i] < cfg_lower_bound[i])) begin
            flags_comb[i] = 1'b1;
            if (type_comb == ANOMALY_NONE) begin
              type_comb = ANOMALY_OUT_OF_BOUNDS;
            end
          end
          // Priority 2: Rate of change spike
          else if (first_sample_done && (abs_diff > cfg_max_rate[i])) begin
            flags_comb[i] = 1'b1;
            if (type_comb == ANOMALY_NONE) begin
              type_comb = ANOMALY_RATE_OF_CHANGE;
            end
          end
          // Priority 3: Stuck-at detection
          else if (first_sample_done && (stuck_cnt[i] >= cfg_stuck_threshold) && (cfg_stuck_threshold != 8'd0)) begin
            flags_comb[i] = 1'b1;
            if (type_comb == ANOMALY_NONE) begin
              type_comb = ANOMALY_STUCK_AT;
            end
          end

          // Update previous data sample
          prev_data[i] <= in_channel_data[i];
        end

        first_sample_done <= 1'b1;
        reg_anomaly_flags <= flags_comb;
        reg_anomaly_type  <= type_comb;
        reg_anomaly_valid <= 1'b1;
      end
    end
  end

  assign anomaly_flags = reg_anomaly_flags;
  assign anomaly_type  = reg_anomaly_type;
  assign anomaly_valid = reg_anomaly_valid;

endmodule

`default_nettype wire
