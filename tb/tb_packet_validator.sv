// ============================================================================
// File: tb/tb_packet_validator.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Self-checking testbench for packet_validator module.
//              Tests valid frames, corrupted CRC-8, invalid length fields,
//              corrupted footer delimiter, and sequence number gaps.
//              Reports PASS/FAIL.
// Simulation-Only: YES
// ============================================================================

`timescale 1ns/1ps

module tb_packet_validator;

  import neuronose_pkg::*;

  parameter int DATA_WIDTH   = 16;
  parameter int NUM_CHANNELS = 8;
  parameter int CLK_PERIOD   = 20;

  logic clk;
  logic rst;

  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0];
  logic [7:0]                   in_seq_num;
  logic [7:0]                   in_length;
  logic [7:0]                   in_crc;
  logic [7:0]                   in_footer;
  logic                         in_valid;
  wire                          in_ready;

  wire signed [DATA_WIDTH-1:0]  out_channel_data [NUM_CHANNELS-1:0];
  wire [7:0]                    out_seq_num;
  wire                          packet_valid;
  wire                          packet_error;
  wire [3:0]                    error_code;
  logic                         out_ready;

  int error_count;
  int test_count;

  // DUT instantiation
  packet_validator #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS)
  ) dut (
    .clk              (clk),
    .rst              (rst),
    .in_channel_data  (in_channel_data),
    .in_seq_num       (in_seq_num),
    .in_length        (in_length),
    .in_crc           (in_crc),
    .in_footer        (in_footer),
    .in_valid         (in_valid),
    .in_ready         (in_ready),
    .out_channel_data (out_channel_data),
    .out_seq_num      (out_seq_num),
    .packet_valid     (packet_valid),
    .packet_error     (packet_error),
    .error_code       (error_code),
    .out_ready        (out_ready)
  );

  // Clock generation
  always #(CLK_PERIOD / 2) clk = ~clk;

  // Helper task to compute CRC in testbench
  function automatic logic [7:0] tb_compute_crc(
    input logic [7:0] seq,
    input logic [7:0] len,
    input logic signed [DATA_WIDTH-1:0] chs [NUM_CHANNELS-1:0]
  );
    logic [7:0] c;
    begin
      c = 8'h00;
      c = crc8_byte(seq, c);
      c = crc8_byte(len, c);
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        c = crc8_byte(chs[i][15:8], c);
        c = crc8_byte(chs[i][7:0], c);
      end
      return c;
    end
  endfunction

  // Send packet task
  task automatic send_packet(
    input logic [7:0] seq,
    input logic [7:0] len,
    input logic [7:0] crc_override,
    input logic       use_crc_override,
    input logic [7:0] footer,
    input logic       exp_valid,
    input logic       exp_error,
    input logic [3:0] exp_err_code,
    input string      test_name
  );
    logic [7:0] final_crc;
    begin
      @(posedge clk);
      final_crc = use_crc_override ? crc_override : tb_compute_crc(seq, len, in_channel_data);

      in_seq_num <= seq;
      in_length  <= len;
      in_crc     <= final_crc;
      in_footer  <= footer;
      in_valid   <= 1'b1;
      out_ready  <= 1'b1;

      while (!in_ready) @(posedge clk);
      @(posedge clk);
      in_valid <= 1'b0;

      // Wait for output response
      while (!packet_valid && !packet_error) @(posedge clk);

      test_count = test_count + 1;
      if (packet_valid !== exp_valid || packet_error !== exp_error || error_code !== exp_err_code) begin
        $display("[FAIL] %s: Expected (valid=%b, err=%b, code=0x%01h), Got (valid=%b, err=%b, code=0x%01h)",
                 test_name, exp_valid, exp_error, exp_err_code, packet_valid, packet_error, error_code);
        error_count = error_count + 1;
      end else begin
        $display("[PASS] %s: Result valid=%b, error=%b, code=0x%01h",
                 test_name, packet_valid, packet_error, error_code);
      end
      @(posedge clk);
    end
  endtask

  initial begin
    $display("==================================================================");
    $display("Starting tb_packet_validator Simulation Verification");
    $display("==================================================================");

    clk         = 1'b0;
    rst         = 1'b1;
    in_valid    = 1'b0;
    out_ready   = 1'b1;
    error_count = 0;
    test_count  = 0;

    for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
      in_channel_data[i] = 16'h0100 * (i + 1);
    end

    // Apply Reset
    repeat (5) @(posedge clk);
    rst = 1'b0;
    repeat (2) @(posedge clk);

    // TEST 1: Initial valid packet (Seq 0)
    $display("\n--- Test 1: Valid Packet (Seq 0) ---");
    send_packet(8'd0, 8'd16, 8'd0, 1'b0, TAIL_BYTE, 1'b1, 1'b0, ERR_NONE, "Valid Packet Seq 0");

    // TEST 2: Consecutive valid packet (Seq 1)
    $display("\n--- Test 2: Valid Packet (Seq 1) ---");
    send_packet(8'd1, 8'd16, 8'd0, 1'b0, TAIL_BYTE, 1'b1, 1'b0, ERR_NONE, "Valid Packet Seq 1");

    // TEST 3: Corrupted CRC
    $display("\n--- Test 3: Corrupted CRC ---");
    send_packet(8'd2, 8'd16, 8'hFF, 1'b1, TAIL_BYTE, 1'b0, 1'b1, ERR_BAD_CRC, "Corrupted CRC");

    // TEST 4: Invalid Length (15 instead of 16)
    $display("\n--- Test 4: Invalid Length ---");
    send_packet(8'd2, 8'd15, 8'd0, 1'b0, TAIL_BYTE, 1'b0, 1'b1, ERR_BAD_LENGTH, "Invalid Length 15");

    // TEST 5: Bad Footer (0x00 instead of 0x5A)
    $display("\n--- Test 5: Bad Footer ---");
    send_packet(8'd2, 8'd16, 8'd0, 1'b0, 8'h00, 1'b0, 1'b1, ERR_BAD_FOOTER, "Bad Footer 0x00");

    // TEST 6: Sequence Number Gap (Expected Seq 2, sent Seq 5)
    $display("\n--- Test 6: Sequence Gap ---");
    send_packet(8'd5, 8'd16, 8'd0, 1'b0, TAIL_BYTE, 1'b0, 1'b1, ERR_SEQ_GAP, "Sequence Gap (Seq 5 vs 2)");

    // TEST 7: Recovery with Next Expected Sequence (Seq 6)
    $display("\n--- Test 7: Post-Gap Recovery ---");
    send_packet(8'd6, 8'd16, 8'd0, 1'b0, TAIL_BYTE, 1'b1, 1'b0, ERR_NONE, "Valid Packet Post-Recovery (Seq 6)");

    // Final Report
    $display("==================================================================");
    if (error_count == 0) begin
      $display("RESULT: PASS - All %0d Packet Validator Tests Passed!", test_count);
    end else begin
      $display("RESULT: FAIL - %0d of %0d Tests Failed!", error_count, test_count);
    end
    $display("==================================================================");

    $finish;
  end

endmodule
