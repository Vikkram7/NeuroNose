// ============================================================================
// File: tb/tb_anomaly_flagger.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Self-checking testbench for anomaly_flagger module.
//              Tests normal operational data, out-of-bounds violations (upper/lower),
//              rate-of-change spikes, stuck-at sensor faults, and missing-data timeouts.
//              Reports PASS/FAIL.
// Simulation-Only: YES
// ============================================================================

`timescale 1ns/1ps

module tb_anomaly_flagger;

  import neuronose_pkg::*;

  parameter int DATA_WIDTH   = 16;
  parameter int NUM_CHANNELS = 8;
  parameter int CLK_PERIOD   = 20;

  logic clk;
  logic rst;

  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0];
  logic                         in_valid;
  wire                          in_ready;

  wire [NUM_CHANNELS-1:0]       anomaly_flags;
  wire [2:0]                    anomaly_type;
  wire                          anomaly_valid;
  logic                         out_ready;

  logic signed [DATA_WIDTH-1:0] cfg_upper_bound [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] cfg_lower_bound [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] cfg_max_rate    [NUM_CHANNELS-1:0];
  logic [7:0]                   cfg_stuck_threshold;
  logic [15:0]                  cfg_missing_threshold;

  int error_count;
  int test_count;

  // DUT instantiation
  anomaly_flagger #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS)
  ) dut (
    .clk                   (clk),
    .rst                   (rst),
    .in_channel_data       (in_channel_data),
    .in_valid              (in_valid),
    .in_ready              (in_ready),
    .anomaly_flags         (anomaly_flags),
    .anomaly_type          (anomaly_type),
    .anomaly_valid         (anomaly_valid),
    .out_ready             (out_ready),
    .cfg_upper_bound       (cfg_upper_bound),
    .cfg_lower_bound       (cfg_lower_bound),
    .cfg_max_rate          (cfg_max_rate),
    .cfg_stuck_threshold   (cfg_stuck_threshold),
    .cfg_missing_threshold (cfg_missing_threshold)
  );

  always #(CLK_PERIOD / 2) clk = ~clk;

  // Task to send a sample vector and check anomaly status
  task automatic send_and_check(
    input logic [NUM_CHANNELS-1:0] exp_flags,
    input logic [2:0]              exp_type,
    input string                   test_name
  );
    begin
      @(posedge clk);
      in_valid  <= 1'b1;
      out_ready <= 1'b1;

      while (!in_ready) @(posedge clk);
      @(posedge clk);
      in_valid <= 1'b0;

      while (!anomaly_valid) @(posedge clk);

      test_count = test_count + 1;
      if ((anomaly_flags !== exp_flags) || (anomaly_type !== exp_type)) begin
        $display("[FAIL] %s: Expected (flags=0x%02h, type=%0d), Got (flags=0x%02h, type=%0d)",
                 test_name, exp_flags, exp_type, anomaly_flags, anomaly_type);
        error_count = error_count + 1;
      end else begin
        $display("[PASS] %s: Flags=0x%02h, Type=%0d", test_name, anomaly_flags, anomaly_type);
      end
      @(posedge clk);
    end
  endtask

  initial begin
    $display("==================================================================");
    $display("Starting tb_anomaly_flagger Simulation Verification");
    $display("==================================================================");

    clk                   = 1'b0;
    rst                   = 1'b1;
    in_valid              = 1'b0;
    out_ready             = 1'b1;
    cfg_stuck_threshold   = 8'd4;   // 4 identical samples -> stuck
    cfg_missing_threshold = 16'd20; // 20 cycles -> missing
    error_count           = 0;
    test_count            = 0;

    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      cfg_upper_bound[i] = 16'sh6400; // +100.0 Q8.8
      cfg_lower_bound[i] = 16'sh0100; // +1.0 Q8.8
      cfg_max_rate[i]    = 16'sh0A00; // 10.0 Q8.8
      in_channel_data[i] = 16'sh0500;
    end

    // Apply Reset
    repeat (5) @(posedge clk);
    rst = 1'b0;
    repeat (2) @(posedge clk);

    // ------------------------------------------------------------------------
    // TEST 1: Normal In-Bounds Operation
    // ------------------------------------------------------------------------
    $display("\n--- Test 1: Normal In-Bounds Operation ---");
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) in_channel_data[ch] = 16'sh0500 + ch;
    send_and_check(8'h00, ANOMALY_NONE, "Normal Baseline Sample 1");

    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) in_channel_data[ch] = 16'sh0510 + ch;
    send_and_check(8'h00, ANOMALY_NONE, "Normal Baseline Sample 2");

    // ------------------------------------------------------------------------
    // TEST 2: Upper Bound Exceedance (Channel 3 = 0x7000 > 0x6400)
    // ------------------------------------------------------------------------
    $display("\n--- Test 2: Upper Bound Exceedance ---");
    in_channel_data[3] = 16'sh7000;
    send_and_check(8'b0000_1000, ANOMALY_OUT_OF_BOUNDS, "Channel 3 High Anomaly");
    in_channel_data[3] = 16'sh0520; // restore

    // ------------------------------------------------------------------------
    // TEST 3: Lower Bound Violation (Channel 6 = 0x0050 < 0x0100)
    // ------------------------------------------------------------------------
    $display("\n--- Test 3: Lower Bound Violation ---");
    in_channel_data[6] = 16'sh0050;
    send_and_check(8'b0100_0000, ANOMALY_OUT_OF_BOUNDS, "Channel 6 Low Anomaly");
    in_channel_data[6] = 16'sh0520; // restore

    // ------------------------------------------------------------------------
    // TEST 4: Rate of Change Spike (Channel 1 jumps from ~0x0520 to 0x2000, diff > 0x0A00)
    // ------------------------------------------------------------------------
    $display("\n--- Test 4: Rate-of-Change Spike ---");
    in_channel_data[1] = 16'sh2000;
    send_and_check(8'b0000_0010, ANOMALY_RATE_OF_CHANGE, "Channel 1 Rate Spike");
    in_channel_data[1] = 16'sh2010; // normal next rate

    // ------------------------------------------------------------------------
    // TEST 5: Stuck-At Sensor Detection (Send exact same value 4+ times)
    // ------------------------------------------------------------------------
    $display("\n--- Test 5: Stuck-At Fault Detection ---");
    // Samples 1..3 with identical values
    send_and_check(8'h00, ANOMALY_NONE, "Stuck test sample 1");
    send_and_check(8'h00, ANOMALY_NONE, "Stuck test sample 2");
    send_and_check(8'h00, ANOMALY_NONE, "Stuck test sample 3");
    // Sample 4 reaches stuck threshold of 4
    send_and_check(8'hFF, ANOMALY_STUCK_AT, "All Channels Stuck At 4th Identical Sample");

    // ------------------------------------------------------------------------
    // TEST 6: Missing-Data Watchdog Timeout (Pause streaming for > 20 cycles)
    // ------------------------------------------------------------------------
    $display("\n--- Test 6: Missing-Data Watchdog Timeout ---");
    in_valid <= 1'b0;
    // Wait for watchdog to trigger (20 cycles threshold)
    repeat (25) @(posedge clk);

    test_count = test_count + 1;
    if (anomaly_valid && (anomaly_type == ANOMALY_MISSING_DATA)) begin
      $display("[PASS] Missing-Data Watchdog Timeout Triggered: Type=%0d", anomaly_type);
    end else begin
      $display("[FAIL] Missing-Data Watchdog Timeout Not Triggered! Valid=%b, Type=%0d",
               anomaly_valid, anomaly_type);
      error_count = error_count + 1;
    end

    // Final Report
    $display("==================================================================");
    if (error_count == 0) begin
      $display("RESULT: PASS - All %0d Anomaly Flagger Tests Passed!", test_count);
    end else begin
      $display("RESULT: FAIL - %0d of %0d Tests Failed!", error_count, test_count);
    end
    $display("==================================================================");

    $finish;
  end

endmodule
