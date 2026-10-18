// ============================================================================
// File: tb/tb_threshold_classifier.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Self-checking testbench for threshold_classifier module.
//              Tests multi-class feature classification, boundary value inclusion,
//              below-threshold rejection, and lowest-class-ID tie breaking.
//              Reports PASS/FAIL.
// Simulation-Only: YES
// ============================================================================

`timescale 1ns/1ps

module tb_threshold_classifier;

  parameter int DATA_WIDTH   = 16;
  parameter int NUM_CHANNELS = 8;
  parameter int NUM_CLASSES  = 8;
  parameter int CLK_PERIOD   = 20;

  logic clk;
  logic rst;

  logic signed [DATA_WIDTH-1:0] feat_vector [NUM_CHANNELS-1:0];
  logic                         in_valid;
  wire                          in_ready;

  wire [2:0]                    class_id;
  wire [7:0]                    match_score;
  wire                          classification_valid;
  logic                         out_ready;

  logic                         reg_thresh_wr_en;
  logic [2:0]                   reg_class_sel;
  logic [2:0]                   reg_ch_sel;
  logic                         reg_is_max;
  logic signed [DATA_WIDTH-1:0] reg_thresh_wdata;
  logic [NUM_CLASSES-1:0]       reg_class_enables;
  logic [3:0]                   reg_min_match_score;

  int error_count;
  int test_count;

  // DUT instantiation
  threshold_classifier #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS),
    .NUM_CLASSES  (NUM_CLASSES)
  ) dut (
    .clk                  (clk),
    .rst                  (rst),
    .feat_vector          (feat_vector),
    .in_valid             (in_valid),
    .in_ready             (in_ready),
    .class_id             (class_id),
    .match_score          (match_score),
    .classification_valid (classification_valid),
    .out_ready            (out_ready),
    .reg_thresh_wr_en     (reg_thresh_wr_en),
    .reg_class_sel        (reg_class_sel),
    .reg_ch_sel           (reg_ch_sel),
    .reg_is_max           (reg_is_max),
    .reg_thresh_wdata     (reg_thresh_wdata),
    .reg_class_enables    (reg_class_enables),
    .reg_min_match_score  (reg_min_match_score)
  );

  always #(CLK_PERIOD / 2) clk = ~clk;

  // Helper task to write a threshold
  task automatic set_threshold(
    input logic [2:0] c,
    input logic [2:0] ch,
    input logic is_max,
    input logic signed [DATA_WIDTH-1:0] val
  );
    begin
      @(posedge clk);
      reg_thresh_wr_en <= 1'b1;
      reg_class_sel    <= c;
      reg_ch_sel       <= ch;
      reg_is_max       <= is_max;
      reg_thresh_wdata <= val;
      @(posedge clk);
      reg_thresh_wr_en <= 1'b0;
    end
  endtask

  // Helper task to classify and check
  task automatic classify_and_check(
    input logic [2:0] exp_class,
    input logic [7:0] exp_score,
    input string      test_name
  );
    begin
      @(posedge clk);
      in_valid  <= 1'b1;
      out_ready <= 1'b1;

      while (!in_ready) @(posedge clk);
      @(posedge clk);
      in_valid <= 1'b0;

      while (!classification_valid) @(posedge clk);

      test_count = test_count + 1;
      if (class_id !== exp_class || match_score !== exp_score) begin
        $display("[FAIL] %s: Expected (class=%0d, score=%0d), Got (class=%0d, score=%0d)",
                 test_name, exp_class, exp_score, class_id, match_score);
        error_count = error_count + 1;
      end else begin
        $display("[PASS] %s: Classified as Class %0d with Score %0d",
                 test_name, class_id, match_score);
      end
      @(posedge clk);
    end
  endtask

  initial begin
    $display("==================================================================");
    $display("Starting tb_threshold_classifier Simulation Verification");
    $display("==================================================================");

    clk                 = 1'b0;
    rst                 = 1'b1;
    in_valid            = 1'b0;
    out_ready           = 1'b1;
    reg_thresh_wr_en    = 1'b0;
    reg_class_sel       = 3'd0;
    reg_ch_sel          = 3'd0;
    reg_is_max          = 1'b0;
    reg_thresh_wdata    = '0;
    reg_class_enables   = 8'hFF;
    reg_min_match_score = 4'd1;
    error_count         = 0;
    test_count          = 0;

    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      feat_vector[i] = '0;
    end

    // Apply Reset
    repeat (5) @(posedge clk);
    rst = 1'b0;
    repeat (2) @(posedge clk);

    // ------------------------------------------------------------------------
    // SETUP CLASS PROFILES
    // Class 0: [0x0100 to 0x0500] (1.0 to 5.0) across all channels
    // Class 1: [0x0600 to 0x0A00] (6.0 to 10.0) across all channels
    // Class 2: [0x0B00 to 0x0F00] (11.0 to 15.0) across all channels
    // ------------------------------------------------------------------------
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
      set_threshold(3'd0, ch[2:0], 1'b0, 16'sh0100);
      set_threshold(3'd0, ch[2:0], 1'b1, 16'sh0500);

      set_threshold(3'd1, ch[2:0], 1'b0, 16'sh0600);
      set_threshold(3'd1, ch[2:0], 1'b1, 16'sh0A00);

      set_threshold(3'd2, ch[2:0], 1'b0, 16'sh0B00);
      set_threshold(3'd2, ch[2:0], 1'b1, 16'sh0F00);
    end

    // ------------------------------------------------------------------------
    // TEST 1: Full Match for Class 0 (Vector = 0x0300)
    // ------------------------------------------------------------------------
    $display("\n--- Test 1: Class 0 Identification ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) feat_vector[ch] = 16'sh0300;
    classify_and_check(3'd0, 8'd8, "Class 0 Signature");

    // ------------------------------------------------------------------------
    // TEST 2: Full Match for Class 1 (Vector = 0x0800)
    // ------------------------------------------------------------------------
    $display("\n--- Test 2: Class 1 Identification ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) feat_vector[ch] = 16'sh0800;
    classify_and_check(3'd1, 8'd8, "Class 1 Signature");

    // ------------------------------------------------------------------------
    // TEST 3: Full Match for Class 2 (Vector = 0x0D00)
    // ------------------------------------------------------------------------
    $display("\n--- Test 3: Class 2 Identification ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) feat_vector[ch] = 16'sh0D00;
    classify_and_check(3'd2, 8'd8, "Class 2 Signature");

    // ------------------------------------------------------------------------
    // TEST 4: Boundary Value Inclusivity (Min = 0x0100, Max = 0x0500)
    // ------------------------------------------------------------------------
    $display("\n--- Test 4: Boundary Values ---");
    for (int ch = 0; ch < 4; ch = ch + 1) feat_vector[ch] = 16'sh0100; // Exact lower bound
    for (int ch = 4; ch < 8; ch = ch + 1) feat_vector[ch] = 16'sh0500; // Exact upper bound
    classify_and_check(3'd0, 8'd8, "Exact Threshold Boundaries");

    // ------------------------------------------------------------------------
    // TEST 5: All Channels Below Threshold
    // ------------------------------------------------------------------------
    $display("\n--- Test 5: Rejection / Below Threshold ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) feat_vector[ch] = 16'sh0050; // Below 0x0100
    classify_and_check(3'd0, 8'd0, "All Features Below Threshold");

    // ------------------------------------------------------------------------
    // TEST 6: Tie-Breaking: Lowest Class ID Wins
    // Set up Class 1 and Class 4 to both score 4 matches
    // ------------------------------------------------------------------------
    $display("\n--- Test 6: Tie Breaking (Class 1 vs Class 4) ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
      // Class 4 matches channels 0..3 with [0x0600..0x0A00]
      set_threshold(3'd4, ch[2:0], 1'b0, 16'sh0600);
      set_threshold(3'd4, ch[2:0], 1'b1, 16'sh0A00);
    end
    // Feature vector: 4 channels in [0x0600..0x0A00], 4 channels out of range (0x2000)
    for (int ch = 0; ch < 4; ch = ch + 1) feat_vector[ch] = 16'sh0700;
    for (int ch = 4; ch < 8; ch = ch + 1) feat_vector[ch] = 16'sh2000;
    // Both Class 1 and Class 4 have score = 4. Class 1 should win!
    classify_and_check(3'd1, 8'd4, "Tie Break: Class 1 wins over Class 4");

    // Final Report
    $display("==================================================================");
    if (error_count == 0) begin
      $display("RESULT: PASS - All %0d Threshold Classifier Tests Passed!", test_count);
    end else begin
      $display("RESULT: FAIL - %0d of %0d Tests Failed!", error_count, test_count);
    end
    $display("==================================================================");

    $finish;
  end

endmodule
