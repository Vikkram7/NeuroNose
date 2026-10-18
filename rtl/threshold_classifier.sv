// ============================================================================
// File: rtl/threshold_classifier.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Multi-class threshold classifier supporting up to 8 classes.
//              Compares an 8-channel feature vector against per-class bounding
//              thresholds, evaluates match scores, and identifies the best match
//              with deterministic lowest-class-ID tie-breaking.
// Synthesizable: YES
// Latency: 1 cycle
// ============================================================================

`default_nettype none

module threshold_classifier #(
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8,
  parameter int NUM_CLASSES  = 8
) (
  input  logic clk,
  input  logic rst,

  // Upstream Feature Handshake
  input  logic signed [DATA_WIDTH-1:0] feat_vector [NUM_CHANNELS-1:0],
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Classification Result Handshake
  output logic [2:0]                   class_id,
  output logic [7:0]                   match_score,
  output logic                         classification_valid,
  input  logic                         out_ready,

  // Configuration Interface
  input  logic                         reg_thresh_wr_en,
  input  logic [2:0]                   reg_class_sel,
  input  logic [2:0]                   reg_ch_sel,
  input  logic                         reg_is_max,      // 0: Min threshold, 1: Max threshold
  input  logic signed [DATA_WIDTH-1:0] reg_thresh_wdata,
  input  logic [NUM_CLASSES-1:0]       reg_class_enables,
  input  logic [3:0]                   reg_min_match_score // Minimum matching channels required
);

  import neuronose_pkg::*;

  // Per-class per-channel thresholds
  logic signed [DATA_WIDTH-1:0] thresh_min [NUM_CLASSES-1:0][NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] thresh_max [NUM_CLASSES-1:0][NUM_CHANNELS-1:0];
  logic [NUM_CLASSES-1:0]       class_enables;
  logic [3:0]                   min_score;

  // Registered classification outputs
  logic [2:0] reg_class_id;
  logic [7:0] reg_match_score;
  logic       reg_valid;

  // Combinational Match Evaluation
  logic [3:0] class_scores [NUM_CLASSES-1:0];

  always_comb begin
    for (int c = 0; c < NUM_CLASSES; c = c + 1) begin
      class_scores[c] = 4'd0;
      if (class_enables[c]) begin
        for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
          if ((feat_vector[ch] >= thresh_min[c][ch]) &&
              (feat_vector[ch] <= thresh_max[c][ch])) begin
            class_scores[c] = class_scores[c] + 1'b1;
          end
        end
      end
    end
  end

  // Tie-breaking: Find class with highest score, lowest class ID wins
  logic [3:0] best_score;
  logic [2:0] best_class;
  logic       match_found;

  always_comb begin
    best_score  = 4'd0;
    best_class  = 3'd0;
    match_found = 1'b0;

    for (int c = 0; c < NUM_CLASSES; c = c + 1) begin
      if (class_enables[c] && (class_scores[c] >= min_score)) begin
        if (!match_found || (class_scores[c] > best_score)) begin
          best_score  = class_scores[c];
          best_class  = c[2:0];
          match_found = 1'b1;
        end
      end
    end
  end

  // Ready when downstream is ready or output register is empty
  assign in_ready = (!reg_valid) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      reg_valid       <= 1'b0;
      reg_class_id    <= 3'd0;
      reg_match_score <= 8'd0;
      class_enables   <= 8'hFF; // Enable all classes by default
      min_score       <= 4'd1;  // At least 1 channel match required

      for (int c = 0; c < NUM_CLASSES; c = c + 1) begin
        for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
          thresh_min[c][ch] <= 16'sh0000;
          thresh_max[c][ch] <= 16'sh7FFF;
        end
      end
    end else begin
      // Register threshold write updates
      if (reg_thresh_wr_en) begin
        if (reg_is_max) begin
          thresh_max[reg_class_sel][reg_ch_sel] <= reg_thresh_wdata;
        end else begin
          thresh_min[reg_class_sel][reg_ch_sel] <= reg_thresh_wdata;
        end
      end

      // Update control parameters if changed
      class_enables <= reg_class_enables;
      if (reg_min_match_score != 4'd0) begin
        min_score <= reg_min_match_score;
      end

      // Downstream consumption
      if (reg_valid && out_ready) begin
        reg_valid <= 1'b0;
      end

      // Classify incoming feature vector
      if (in_valid && in_ready) begin
        reg_valid       <= 1'b1;
        reg_class_id    <= best_class;
        reg_match_score <= {4'd0, best_score};
      end
    end
  end

  assign class_id             = reg_class_id;
  assign match_score          = reg_match_score;
  assign classification_valid = reg_valid;

endmodule

`default_nettype wire
