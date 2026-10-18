// ============================================================================
// File: rtl/packet_validator.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Validates unpacked frames: verifies length field, tail delimiter,
//              calculates and checks 8-bit CRC over header and payload, and tracks
//              sequence continuity for gap detection.
// Synthesizable: YES
// Latency: 1 cycle
// ============================================================================

`default_nettype none

module packet_validator #(
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8
) (
  input  logic clk,
  input  logic rst,

  // Upstream Frame Input Handshake
  input  logic signed [DATA_WIDTH-1:0] in_channel_data [NUM_CHANNELS-1:0],
  input  logic [7:0]                   in_seq_num,
  input  logic [7:0]                   in_length,
  input  logic [7:0]                   in_crc,
  input  logic [7:0]                   in_footer,
  input  logic                         in_valid,
  output logic                         in_ready,

  // Downstream Validated Data Output Handshake
  output logic signed [DATA_WIDTH-1:0] out_channel_data [NUM_CHANNELS-1:0],
  output logic [7:0]                   out_seq_num,
  output logic                         packet_valid,
  output logic                         packet_error,
  output logic [3:0]                   error_code,
  input  logic                         out_ready
);

  import neuronose_pkg::*;

  localparam int EXPECTED_LEN = NUM_CHANNELS * (DATA_WIDTH / 8); // 16 bytes

  // Sequence tracking state
  logic [7:0] expected_seq;
  logic       seq_initialized;

  // Registered outputs
  logic signed [DATA_WIDTH-1:0] reg_out_channels [NUM_CHANNELS-1:0];
  logic [7:0]                   reg_out_seq;
  logic                         reg_packet_valid;
  logic                         reg_packet_error;
  logic [3:0]                   reg_error_code;
  logic                         reg_busy;

  // --------------------------------------------------------------------------
  // CRC-8 Combinational Calculation over:
  // [0] in_seq_num, [1] in_length, [2..17] 8 channels * 2 bytes
  // --------------------------------------------------------------------------
  function automatic logic [7:0] compute_frame_crc();
    logic [7:0] c;
    logic [7:0] byte_val;
    begin
      c = 8'h00; // Initial CRC
      c = crc8_byte(in_seq_num, c);
      c = crc8_byte(in_length, c);
      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        // MSB first, then LSB (matching sensor_stream_interface)
        byte_val = in_channel_data[i][15:8];
        c = crc8_byte(byte_val, c);
        byte_val = in_channel_data[i][7:0];
        c = crc8_byte(byte_val, c);
      end
      return c;
    end
  endfunction

  wire [7:0] calc_crc = compute_frame_crc();

  // Handshake management: ready when not busy or downstream accepts current output
  assign in_ready = (!reg_busy) || (out_ready);

  always_ff @(posedge clk) begin
    if (rst) begin
      expected_seq     <= 8'h00;
      seq_initialized  <= 1'b0;
      reg_busy         <= 1'b0;
      reg_packet_valid <= 1'b0;
      reg_packet_error <= 1'b0;
      reg_error_code   <= ERR_NONE;
      reg_out_seq      <= 8'h00;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        reg_out_channels[i] <= '0;
      end
    end else begin
      // Downstream consumption
      if (reg_busy && out_ready) begin
        reg_busy         <= 1'b0;
        reg_packet_valid <= 1'b0;
        reg_packet_error <= 1'b0;
      end

      // Upstream sample ingestion
      if (in_valid && in_ready) begin
        reg_busy    <= 1'b1;
        reg_out_seq <= in_seq_num;
        for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
          reg_out_channels[i] <= in_channel_data[i];
        end

        // Check 1: Length field verification
        if (in_length != EXPECTED_LEN[7:0]) begin
          reg_packet_valid <= 1'b0;
          reg_packet_error <= 1'b1;
          reg_error_code   <= ERR_BAD_LENGTH;
        end
        // Check 2: Tail/Footer verification
        else if (in_footer != TAIL_BYTE) begin
          reg_packet_valid <= 1'b0;
          reg_packet_error <= 1'b1;
          reg_error_code   <= ERR_BAD_FOOTER;
        end
        // Check 3: CRC-8 Checksum verification
        else if (calc_crc != in_crc) begin
          reg_packet_valid <= 1'b0;
          reg_packet_error <= 1'b1;
          reg_error_code   <= ERR_BAD_CRC;
        end
        // Check 4: Sequence Continuity Check
        else if (seq_initialized && (in_seq_num != expected_seq)) begin
          reg_packet_valid <= 1'b0;
          reg_packet_error <= 1'b1;
          reg_error_code   <= ERR_SEQ_GAP;
          expected_seq     <= in_seq_num + 1'b1;
        end
        // Packet is fully valid!
        else begin
          reg_packet_valid <= 1'b1;
          reg_packet_error <= 1'b0;
          reg_error_code   <= ERR_NONE;
          expected_seq     <= in_seq_num + 1'b1;
          seq_initialized  <= 1'b1;
        end
      end
    end
  end

  // Output assignments
  assign packet_valid = reg_packet_valid;
  assign packet_error = reg_packet_error;
  assign error_code   = reg_error_code;
  assign out_seq_num  = reg_out_seq;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_out_channels
      assign out_channel_data[ch] = reg_out_channels[ch];
    end
  endgenerate

endmodule

`default_nettype wire
