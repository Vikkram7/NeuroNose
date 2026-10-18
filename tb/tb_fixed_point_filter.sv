// ============================================================================
// File: tb/tb_fixed_point_filter.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Self-checking testbench for fixed_point_filter module.
//              Applies Step, Ramp, Impulse, and Sinusoid waveforms. Verifies
//              fixed-point Q8.8 arithmetic, symmetric rounding, saturation
//              clamping, reset behavior, and bypass functionality against
//              pre-computed golden reference vectors. Reports PASS/FAIL.
// Simulation-Only: YES
// ============================================================================

`timescale 1ns/1ps

module tb_fixed_point_filter;

  parameter int DATA_WIDTH  = 16;
  parameter int COEFF_WIDTH = 16;
  parameter int CLK_PERIOD  = 20; // 50 MHz clock

  logic clk;
  logic rst;

  logic signed [COEFF_WIDTH-1:0] coeff_alpha;
  logic                         filter_mode;
  logic                         bypass;

  logic signed [DATA_WIDTH-1:0] in_data;
  logic                         in_valid;
  wire                          in_ready;

  wire signed [DATA_WIDTH-1:0]  out_data;
  wire                          out_valid;
  logic                         out_ready;

  int error_count;
  int test_count;

  // Instantiate Device Under Test (DUT)
  fixed_point_filter #(
    .DATA_WIDTH   (DATA_WIDTH),
    .COEFF_WIDTH  (COEFF_WIDTH),
    .FILTER_ORDER (4)
  ) dut (
    .clk         (clk),
    .rst         (rst),
    .coeff_alpha (coeff_alpha),
    .filter_mode (filter_mode),
    .bypass      (bypass),
    .in_data     (in_data),
    .in_valid    (in_valid),
    .in_ready    (in_ready),
    .out_data    (out_data),
    .out_valid   (out_valid),
    .out_ready   (out_ready)
  );

  // Clock Generation (50 MHz)
  always #(CLK_PERIOD / 2) clk = ~clk;

  // Task to send a sample and verify result
  task automatic send_and_check(
    input logic signed [DATA_WIDTH-1:0] sample_in,
    input logic signed [DATA_WIDTH-1:0] expected_out,
    input string msg
  );
    begin
      @(posedge clk);
      in_data   <= sample_in;
      in_valid  <= 1'b1;
      out_ready <= 1'b1;

      // Wait until DUT accepts sample
      while (!in_ready) @(posedge clk);
      @(posedge clk);
      in_valid <= 1'b0;

      // Wait for valid output
      while (!out_valid) @(posedge clk);

      test_count = test_count + 1;
      if (out_data !== expected_out) begin
        $display("[FAIL] %s: In=0x%04h (%d), Got=0x%04h (%d), Expected=0x%04h (%d)", 
                 msg, sample_in, sample_in, out_data, out_data, expected_out, expected_out);
        error_count = error_count + 1;
      end else begin
        $display("[PASS] %s: In=%d, Out=%d", msg, sample_in, out_data);
      end
      @(posedge clk);
    end
  endtask

  // Testbench Stimulus
  initial begin
    $display("==================================================================");
    $display("Starting tb_fixed_point_filter Simulation Verification");
    $display("==================================================================");

    clk         = 1'b0;
    rst         = 1'b1;
    coeff_alpha = 16'sh0080; // Alpha = 0.5 (128 / 256)
    filter_mode = 1'b0;      // 1st order IIR
    bypass      = 1'b0;
    in_data     = '0;
    in_valid    = 1'b0;
    out_ready   = 1'b1;
    error_count = 0;
    test_count  = 0;

    // Apply Reset
    repeat (5) @(posedge clk);
    rst = 1'b0;
    repeat (2) @(posedge clk);

    // ------------------------------------------------------------------------
    // TEST 1: Step Response (Alpha = 0.25 -> 16'h0040)
    // ------------------------------------------------------------------------
    $display("\n--- Test 1: Step Response (Alpha = 0.25) ---");
    coeff_alpha = 16'sh0040;
    // Step inputs of 2560 (10.0 in Q8.8)
    send_and_check(16'sd0,    16'sd0,    "Step Sample 0");
    send_and_check(16'sd2560, 16'sd640,  "Step Sample 1");
    send_and_check(16'sd2560, 16'sd1120, "Step Sample 2");
    send_and_check(16'sd2560, 16'sd1480, "Step Sample 3");
    send_and_check(16'sd2560, 16'sd1750, "Step Sample 4");

    // ------------------------------------------------------------------------
    // TEST 2: Reset Behavior
    // ------------------------------------------------------------------------
    $display("\n--- Test 2: Synchronous Reset ---");
    rst = 1'b1;
    repeat (3) @(posedge clk);
    rst = 1'b0;
    repeat (2) @(posedge clk);
    coeff_alpha = 16'sh0080; // Alpha = 0.5

    // ------------------------------------------------------------------------
    // TEST 3: Impulse Response (Alpha = 0.5)
    // ------------------------------------------------------------------------
    $display("\n--- Test 3: Impulse Response (Alpha = 0.5) ---");
    send_and_check(16'sd2560, 16'sd1280, "Impulse Sample 0");
    send_and_check(16'sd0,    16'sd640,  "Impulse Sample 1");
    send_and_check(16'sd0,    16'sd320,  "Impulse Sample 2");
    send_and_check(16'sd0,    16'sd160,  "Impulse Sample 3");
    send_and_check(16'sd0,    16'sd80,   "Impulse Sample 4");

    // ------------------------------------------------------------------------
    // TEST 4: Ramp Response (Alpha = 0.5)
    // ------------------------------------------------------------------------
    $display("\n--- Test 4: Ramp Response (Alpha = 0.5) ---");
    rst = 1'b1; @(posedge clk); rst = 1'b0; @(posedge clk);
    send_and_check(16'sd0,    16'sd0,   "Ramp Sample 0");
    send_and_check(16'sd256,  16'sd128, "Ramp Sample 1");
    send_and_check(16'sd512,  16'sd320, "Ramp Sample 2");
    send_and_check(16'sd768,  16'sd544, "Ramp Sample 3");
    send_and_check(16'sd1024, 16'sd784, "Ramp Sample 4");

    // ------------------------------------------------------------------------
    // TEST 5: Sinusoid Waveform Filtering (Alpha = 0.5)
    // ------------------------------------------------------------------------
    $display("\n--- Test 5: Sinusoid Filtering (Alpha = 0.5) ---");
    rst = 1'b1; @(posedge clk); rst = 1'b0; @(posedge clk);
    send_and_check(16'sd0,     16'sd0,     "Sinusoid 0");
    send_and_check(16'sd1810,  16'sd905,   "Sinusoid 1");
    send_and_check(16'sd2560,  16'sd1733,  "Sinusoid 2");
    send_and_check(16'sd1810,  16'sd1772,  "Sinusoid 3");
    send_and_check(16'sd0,     16'sd886,   "Sinusoid 4");
    send_and_check(-16'sd1810, -16'sd463,  "Sinusoid 5");
    send_and_check(-16'sd2560, -16'sd1512, "Sinusoid 6");
    send_and_check(-16'sd1810, -16'sd1662, "Sinusoid 7");

    // ------------------------------------------------------------------------
    // TEST 6: Saturation Clamping (Positive and Negative Extrema)
    // ------------------------------------------------------------------------
    $display("\n--- Test 6: Saturation Clamping ---");
    coeff_alpha = 16'sh0100; // Alpha = 1.0
    send_and_check(16'sh7FFF, 16'sh7FFF, "Max Positive Saturation");
    send_and_check(-16'sh8000, -16'sh8000, "Max Negative Saturation");

    // ------------------------------------------------------------------------
    // TEST 7: Bypass Mode
    // ------------------------------------------------------------------------
    $display("\n--- Test 7: Bypass Mode ---");
    bypass = 1'b1;
    coeff_alpha = 16'sh0040;
    send_and_check(16'sd1234, 16'sd1234, "Bypass Value 1234");
    send_and_check(-16'sd4321, -16'sd4321, "Bypass Value -4321");
    bypass = 1'b0;

    // ------------------------------------------------------------------------
    // Final Results Reporting
    // ------------------------------------------------------------------------
    $display("==================================================================");
    if (error_count == 0) begin
      $display("RESULT: PASS - All %0d Filter Tests Completed Successfully!", test_count);
    end else begin
      $display("RESULT: FAIL - %0d of %0d Tests Failed!", error_count, test_count);
    end
    $display("==================================================================");

    $finish;
  end

endmodule
