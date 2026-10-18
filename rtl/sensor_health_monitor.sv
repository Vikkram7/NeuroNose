// ============================================================================
// File: rtl/sensor_health_monitor.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Multi-channel health tracker. Maintains per-channel health states
//              (OK, WARNING, FAULT, OFFLINE), consecutive fault counters,
//              last-valid timestamps, and generates a packed health summary.
// Synthesizable: YES
// ============================================================================

`default_nettype none

module sensor_health_monitor #(
  parameter int NUM_CHANNELS = 8
) (
  input  logic clk,
  input  logic rst,

  // Anomaly Event Inputs
  input  logic [NUM_CHANNELS-1:0] anomaly_flags,
  input  logic                   anomaly_valid,

  // Configuration Thresholds (from register interface)
  input  logic [7:0]             cfg_warn_threshold,
  input  logic [7:0]             cfg_fault_threshold,
  input  logic [31:0]            cfg_offline_timeout,

  // Health Status Outputs
  output logic [1:0]             channel_health [NUM_CHANNELS-1:0],
  output logic [15:0]            health_summary,
  output logic                   system_healthy,
  output logic [7:0]             consec_fault_cnt [NUM_CHANNELS-1:0],
  output logic [31:0]            last_valid_timestamp [NUM_CHANNELS-1:0]
);

  import neuronose_pkg::*;

  // Global timestamp counter
  logic [31:0] global_timer;

  // Internal registers per channel
  logic [1:0]  reg_health [NUM_CHANNELS-1:0];
  logic [7:0]  reg_consec_faults [NUM_CHANNELS-1:0];
  logic [31:0] reg_last_valid [NUM_CHANNELS-1:0];
  logic        channel_has_received [NUM_CHANNELS-1:0];

  always_ff @(posedge clk) begin
    if (rst) begin
      global_timer <= 32'd0;
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        reg_health[i]           <= HEALTH_OK;
        reg_consec_faults[i]    <= 8'd0;
        reg_last_valid[i]       <= 32'd0;
        channel_has_received[i] <= 1'b0;
      end
    end else begin
      global_timer <= global_timer + 1'b1;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        // Anomaly event updates
        if (anomaly_valid) begin
          channel_has_received[i] <= 1'b1;
          if (anomaly_flags[i]) begin
            if (reg_consec_faults[i] != 8'hFF) begin
              reg_consec_faults[i] <= reg_consec_faults[i] + 1'b1;
            end
          end else begin
            reg_consec_faults[i] <= 8'd0;
            reg_last_valid[i]    <= global_timer;
          end
        end

        // State evaluation logic
        if (channel_has_received[i] && (cfg_offline_timeout != 32'd0) &&
            ((global_timer - reg_last_valid[i]) > cfg_offline_timeout)) begin
          reg_health[i] <= HEALTH_OFFLINE;
        end else if ((cfg_fault_threshold != 8'd0) && (reg_consec_faults[i] >= cfg_fault_threshold)) begin
          reg_health[i] <= HEALTH_FAULT;
        end else if ((cfg_warn_threshold != 8'd0) && (reg_consec_faults[i] >= cfg_warn_threshold)) begin
          reg_health[i] <= HEALTH_WARNING;
        end else begin
          reg_health[i] <= HEALTH_OK;
        end
      end
    end
  end

  // Health summary packing: 2 bits per channel (Ch7 down to Ch0)
  assign health_summary = {
    reg_health[7], reg_health[6], reg_health[5], reg_health[4],
    reg_health[3], reg_health[2], reg_health[1], reg_health[0]
  };

  // System healthy if no channel is in FAULT or OFFLINE
  logic is_healthy_comb;
  always_comb begin
    is_healthy_comb = 1'b1;
    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      if ((reg_health[i] == HEALTH_FAULT) || (reg_health[i] == HEALTH_OFFLINE)) begin
        is_healthy_comb = 1'b0;
      end
    end
  end

  assign system_healthy = is_healthy_comb;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_health_outputs
      assign channel_health[ch]       = reg_health[ch];
      assign consec_fault_cnt[ch]     = reg_consec_faults[ch];
      assign last_valid_timestamp[ch] = reg_last_valid[ch];
    end
  endgenerate

endmodule

`default_nettype wire
