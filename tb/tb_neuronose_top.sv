// ============================================================================
// File: tb/tb_neuronose_top.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Full system integration testbench for neuronose_top.
//              Applies register configuration over the memory-mapped bus,
//              streams serialized 8-channel packets through the pipeline,
//              validates classification outputs, and tests health monitoring
//              and anomaly propagation. Reports PASS/FAIL.
// Simulation-Only: YES
// ============================================================================

`timescale 1ns/1ps

module tb_neuronose_top;

  import neuronose_pkg::*;

  parameter int CLK_FREQ     = 50_000_000;
  parameter int BAUD_RATE    = 115200;
  parameter int DATA_WIDTH   = 16;
  parameter int NUM_CHANNELS = 8;
  parameter int NUM_CLASSES  = 8;
  parameter int CLK_PERIOD   = 20;

  logic clk;
  logic rst;

  // Serial UART
  logic uart_rxd;
  wire  uart_txd;

  // Direct Parallel Byte Stream
  logic [7:0] direct_stream_data;
  logic       direct_stream_valid;
  wire        direct_stream_ready;
  logic       use_direct_stream;

  // Register Bus Interface
  logic [7:0]  reg_addr;
  logic [15:0] reg_wdata;
  logic        reg_wr_en;
  logic        reg_rd_en;
  wire [15:0]  reg_rdata;
  wire         reg_ack;

  // Classification Results
  wire [2:0]   class_id;
  wire [7:0]   match_score;
  wire         classification_valid;

  // Anomaly & Health Telemetry
  wire [NUM_CHANNELS-1:0] anomaly_flags;
  wire [2:0]              anomaly_type;
  wire                    anomaly_valid;
  wire [15:0]             health_summary;
  wire                    system_healthy;

  // Diagnostic LEDs
  wire [7:0]   led_status;

  int error_count;
  int test_count;

  // DUT instantiation
  neuronose_top #(
    .CLK_FREQ     (CLK_FREQ),
    .BAUD_RATE    (BAUD_RATE),
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS),
    .NUM_CLASSES  (NUM_CLASSES)
  ) dut (
    .clk                 (clk),
    .rst                 (rst),
    .uart_rxd            (uart_rxd),
    .uart_txd            (uart_txd),
    .direct_stream_data  (direct_stream_data),
    .direct_stream_valid (direct_stream_valid),
    .direct_stream_ready (direct_stream_ready),
    .use_direct_stream   (use_direct_stream),
    .reg_addr            (reg_addr),
    .reg_wdata           (reg_wdata),
    .reg_wr_en           (reg_wr_en),
    .reg_rd_en           (reg_rd_en),
    .reg_rdata           (reg_rdata),
    .reg_ack             (reg_ack),
    .class_id            (class_id),
    .match_score         (match_score),
    .classification_valid(classification_valid),
    .anomaly_flags       (anomaly_flags),
    .anomaly_type        (anomaly_type),
    .anomaly_valid       (anomaly_valid),
    .health_summary      (health_summary),
    .system_healthy      (system_healthy),
    .led_status          (led_status)
  );

  always #(CLK_PERIOD / 2) clk = ~clk;

  // Bus Register Write Task
  task automatic bus_write(
    input logic [7:0] addr,
    input logic [15:0] data
  );
    begin
      @(posedge clk);
      reg_addr  <= addr;
      reg_wdata <= data;
      reg_wr_en <= 1'b1;
      reg_rd_en <= 1'b0;
      @(posedge clk);
      while (!reg_ack) @(posedge clk);
      reg_wr_en <= 1'b0;
      @(posedge clk);
    end
  endtask

  // Bus Register Read Task
  task automatic bus_read(
    input  logic [7:0] addr,
    output logic [15:0] data
  );
    begin
      @(posedge clk);
      reg_addr  <= addr;
      reg_rd_en <= 1'b1;
      reg_wr_en <= 1'b0;
      @(posedge clk);
      while (!reg_ack) @(posedge clk);
      data = reg_rdata;
      reg_rd_en <= 1'b0;
      @(posedge clk);
    end
  endtask

  // Helper function to calculate frame CRC
  function automatic logic [7:0] calc_crc(
    input logic [7:0] seq,
    input logic [7:0] len,
    input logic signed [DATA_WIDTH-1:0] ch_vals [NUM_CHANNELS-1:0]
  );
    logic [7:0] c;
    begin
      c = 8'h00;
      c = crc8_byte(seq, c);
      c = crc8_byte(len, c);
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        c = crc8_byte(ch_vals[i][15:8], c);
        c = crc8_byte(ch_vals[i][7:0], c);
      end
      return c;
    end
  endfunction

  // Task to transmit a complete 22-byte sensor frame into direct stream
  task automatic send_frame(
    input logic [7:0] seq,
    input logic signed [DATA_WIDTH-1:0] ch_vals [NUM_CHANNELS-1:0]
  );
    logic [7:0] crc_val;
    logic [7:0] frame_bytes [21:0];
    begin
      crc_val = calc_crc(seq, 8'd16, ch_vals);

      frame_bytes[0]  = 8'hAA; // Sync 1
      frame_bytes[1]  = 8'h55; // Sync 2
      frame_bytes[2]  = seq;   // Sequence
      frame_bytes[3]  = 8'd16; // Length
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        frame_bytes[4 + (i * 2)]     = ch_vals[i][15:8]; // MSB
        frame_bytes[4 + (i * 2) + 1] = ch_vals[i][7:0];  // LSB
      end
      frame_bytes[20] = crc_val; // CRC-8
      frame_bytes[21] = 8'h5A;   // Tail

      // Push all 22 bytes across the valid/ready interface
      for (int b = 0; b < 22; b = b + 1) begin
        @(posedge clk);
        direct_stream_data  <= frame_bytes[b];
        direct_stream_valid <= 1'b1;

        while (!direct_stream_ready) @(posedge clk);
        @(posedge clk);
        direct_stream_valid <= 1'b0;
      end
    end
  endtask

  initial begin
    logic [15:0] read_val;
    logic signed [DATA_WIDTH-1:0] test_ch [NUM_CHANNELS-1:0];

    $display("==================================================================");
    $display("Starting tb_neuronose_top Integration Simulation");
    $display("==================================================================");

    clk                 = 1'b0;
    rst                 = 1'b1;
    uart_rxd            = 1'b1;
    direct_stream_data  = 8'h00;
    direct_stream_valid = 1'b0;
    use_direct_stream   = 1'b1; // Direct parallel streaming mode
    reg_addr            = 8'h00;
    reg_wdata           = 16'h0000;
    reg_wr_en           = 1'b0;
    reg_rd_en           = 1'b0;
    error_count         = 0;
    test_count          = 0;

    // Apply System Reset
    repeat (10) @(posedge clk);
    rst = 1'b0;
    repeat (5) @(posedge clk);

    // ------------------------------------------------------------------------
    // STEP 1: Configure System Registers via Memory-Mapped Interface
    // ------------------------------------------------------------------------
    $display("\n--- Step 1: Programming Control Registers ---");

    // Configure Window Size Shift = 2 (N = 4 samples per window) for fast verification
    bus_write(8'h03, 16'h0002);
    bus_read(8'h03, read_val);
    test_count = test_count + 1;
    if (read_val[3:0] == 4'd2) begin
      $display("[PASS] Programmed Window Shift = 2 (N = 4 samples)");
    end else begin
      $display("[FAIL] Read Window Shift mismatch: Got 0x%04h", read_val);
      error_count = error_count + 1;
    end

    // Bypass filter for deterministic feature accumulation
    // REG_CTRL: sys_enable=1, filter_bypass=1 (0x0003)
    bus_write(8'h00, 16'h0003);

    // Set Baselines to 0 for all channels
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
      bus_write(8'h10 + ch, 16'h0000);
    end

    // Configure Thresholds for Class 1:
    // Min = 0x0600 (6.0), Max = 0x0A00 (10.0) across all 8 channels
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
      // Min threshold for Class 1: [5:3]=class 1, [2:0]=ch, [6]=0 (min)
      bus_write(8'h40, {9'd0, 1'b0, 3'd1, ch[2:0]});
      bus_write(8'h41, 16'sh0600);
      // Max threshold for Class 1: [6]=1 (max)
      bus_write(8'h40, {9'd0, 1'b1, 3'd1, ch[2:0]});
      bus_write(8'h41, 16'sh0A00);
    end

    // Set Warn Threshold = 2 consecutive faults, Fault Threshold = 4
    bus_write(8'h06, 16'h0002);
    bus_write(8'h07, 16'h0004);

    // ------------------------------------------------------------------------
    // STEP 2: Stream 4 Sensor Packets (Class 1 Gas Signature)
    // ------------------------------------------------------------------------
    $display("\n--- Step 2: Streaming Class 1 Packet Window ---");
    // All 8 channels at 0x0800 (8.0 in Q8.8) -> falls right in Class 1 range [6.0, 10.0]
    for (int ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin
      test_ch[ch] = 16'sh0800;
    end

    send_frame(8'd0, test_ch);
    send_frame(8'd1, test_ch);
    send_frame(8'd2, test_ch);
    send_frame(8'd3, test_ch);

    // Wait for pipeline processing: Stage 6 (Feature) and Stage 7 (Classification)
    repeat (10) @(posedge clk);

    test_count = test_count + 1;
    if (classification_valid && (class_id == 3'd1) && (match_score == 8'd8)) begin
      $display("[PASS] Multi-Channel Classification Succeeded: Class=%0d, Score=%0d", 
               class_id, match_score);
    end else begin
      $display("[FAIL] Classification Failed: Valid=%b, Class=%0d, Score=%0d",
               classification_valid, class_id, match_score);
      error_count = error_count + 1;
    end

    // Read back latest feature mean from register 0x50 (Channel 0 mean)
    bus_read(8'h50, read_val);
    test_count = test_count + 1;
    if (read_val == 16'sh0800) begin
      $display("[PASS] Register Readback of Channel 0 Feature Mean = 0x%04h (8.0)", read_val);
    end else begin
      $display("[FAIL] Channel 0 Feature Mean: Expected 0x0800, Got 0x%04h", read_val);
      error_count = error_count + 1;
    end

    // ------------------------------------------------------------------------
    // STEP 3: Inject Anomalous Packets & Verify Health Monitoring
    // ------------------------------------------------------------------------
    $display("\n--- Step 3: Anomaly Injection & Health State Degradation ---");
    // Channel 0 sends out-of-bounds reading (+120.0 = 0x7800 > upper bound 0x6400)
    test_ch[0] = 16'sh7800;

    send_frame(8'd4, test_ch);
    repeat (5) @(posedge clk);

    test_count = test_count + 1;
    if (anomaly_flags[0] && (anomaly_type == ANOMALY_OUT_OF_BOUNDS)) begin
      $display("[PASS] Anomaly Flagger detected Ch0 Out-of-Bounds: Flags=0x%02h, Type=%0d",
               anomaly_flags, anomaly_type);
    end else begin
      $display("[FAIL] Anomaly not detected! Flags=0x%02h, Type=%0d", anomaly_flags, anomaly_type);
      error_count = error_count + 1;
    end

    // Send second anomalous frame -> should reach warn threshold (2)
    send_frame(8'd5, test_ch);
    repeat (5) @(posedge clk);

    bus_read(8'h0A, read_val); // Read health summary
    test_count = test_count + 1;
    // Health status for Ch0 is in bits [1:0]
    if (read_val[1:0] == HEALTH_WARNING) begin
      $display("[PASS] Sensor Health Monitor transitioned Ch0 to WARNING (0x%04h)", read_val);
    end else begin
      $display("[FAIL] Health status mismatch: Got 0x%04h, Expected Ch0 WARNING (01)", read_val);
      error_count = error_count + 1;
    end

    // ------------------------------------------------------------------------
    // Final Results Reporting
    // ------------------------------------------------------------------------
    $display("==================================================================");
    if (error_count == 0) begin
      $display("RESULT: PASS - All %0d NeuroNose Integration Tests Passed!", test_count);
    end else begin
      $display("RESULT: FAIL - %0d of %0d Tests Failed!", error_count, test_count);
    end
    $display("==================================================================");

    $finish;
  end

endmodule
