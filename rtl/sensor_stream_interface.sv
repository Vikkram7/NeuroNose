// ============================================================================
// File: rtl/sensor_stream_interface.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Deserializes incoming byte stream into structured multi-channel
//              sensor samples. Detects frame sync (0xAA 0x55), collects packet
//              fields, and monitors inter-byte arrival with a timeout watchdog.
// Synthesizable: YES
// Latency: 1 cycle after last byte received
// ============================================================================

`default_nettype none

module sensor_stream_interface #(
  parameter int DATA_WIDTH     = 16,
  parameter int NUM_CHANNELS   = 8,
  parameter int TIMEOUT_CYCLES = 2000
) (
  input  logic clk,
  input  logic rst,

  // Byte Stream Handshake Interface (Upstream e.g. UART RX)
  input  logic [7:0] in_data,
  input  logic       in_valid,
  output logic       in_ready,

  // Frame Level Handshake Interface (Downstream e.g. Packet Validator)
  output logic signed [DATA_WIDTH-1:0] channel_data [NUM_CHANNELS-1:0],
  output logic [7:0]                   seq_num,
  output logic [7:0]                   length_field,
  output logic [7:0]                   received_crc,
  output logic [7:0]                   received_tail,
  output logic                         channel_valid,
  output logic                         frame_complete,
  output logic                         timeout_error,
  input  logic                         out_ready
);

  localparam int BYTES_PER_SAMPLE = DATA_WIDTH / 8; // 2 bytes for 16-bit
  localparam int TOTAL_PAYLOAD    = NUM_CHANNELS * BYTES_PER_SAMPLE; // 16 bytes

  // Receiver State Machine
  typedef enum logic [3:0] {
    ST_IDLE_SYNC1  = 4'h0,
    ST_SYNC2       = 4'h1,
    ST_SEQ         = 4'h2,
    ST_LEN         = 4'h3,
    ST_PAYLOAD     = 4'h4,
    ST_CRC         = 4'h5,
    ST_TAIL        = 4'h6,
    ST_EMIT_FRAME  = 4'h7
  } state_e;

  state_e state;

  // Internal registers for packet fields
  logic [7:0] reg_seq;
  logic [7:0] reg_len;
  logic [7:0] reg_crc;
  logic [7:0] reg_tail;
  logic signed [DATA_WIDTH-1:0] reg_channels [NUM_CHANNELS-1:0];

  // Byte indexing within payload
  logic [4:0] byte_idx;
  logic [31:0] watchdog_cnt;

  // Calculate channel index and byte within channel (Big-Endian)
  wire [2:0] current_ch  = byte_idx[3:1]; // byte_idx / 2
  wire       is_low_byte = byte_idx[0];

  // in_ready assignment: ready whenever not stalled in EMIT_FRAME
  assign in_ready = (state != ST_EMIT_FRAME);

  always_ff @(posedge clk) begin
    if (rst) begin
      state          <= ST_IDLE_SYNC1;
      reg_seq        <= 8'h00;
      reg_len        <= 8'h00;
      reg_crc        <= 8'h00;
      reg_tail       <= 8'h00;
      byte_idx       <= 5'd0;
      watchdog_cnt   <= 32'd0;
      timeout_error  <= 1'b0;
      channel_valid  <= 1'b0;
      frame_complete <= 1'b0;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        reg_channels[i] <= '0;
      end
    end else begin
      // Default single-cycle pulses
      timeout_error  <= 1'b0;

      // Watchdog counter logic
      if (state != ST_IDLE_SYNC1 && state != ST_EMIT_FRAME) begin
        if (in_valid && in_ready) begin
          watchdog_cnt <= 32'd0;
        end else if (watchdog_cnt >= TIMEOUT_CYCLES) begin
          // Watchdog timed out: abort current frame and return to sync search
          state         <= ST_IDLE_SYNC1;
          watchdog_cnt  <= 32'd0;
          timeout_error <= 1'b1;
        end else begin
          watchdog_cnt <= watchdog_cnt + 1'b1;
        end
      end else begin
        watchdog_cnt <= 32'd0;
      end

      // State transitions and byte assembly
      case (state)
        ST_IDLE_SYNC1: begin
          channel_valid  <= 1'b0;
          frame_complete <= 1'b0;
          if (in_valid && in_ready) begin
            if (in_data == 8'hAA) begin
              state <= ST_SYNC2;
            end
          end
        end

        ST_SYNC2: begin
          if (in_valid && in_ready) begin
            if (in_data == 8'h55) begin
              state <= ST_SEQ;
            end else if (in_data == 8'hAA) begin
              // Keep waiting on repeated sync byte 1
              state <= ST_SYNC2;
            end else begin
              state <= ST_IDLE_SYNC1;
            end
          end
        end

        ST_SEQ: begin
          if (in_valid && in_ready) begin
            reg_seq  <= in_data;
            state    <= ST_LEN;
          end
        end

        ST_LEN: begin
          if (in_valid && in_ready) begin
            reg_len  <= in_data;
            byte_idx <= 5'd0;
            state    <= ST_PAYLOAD;
          end
        end

        ST_PAYLOAD: begin
          if (in_valid && in_ready) begin
            if (!is_low_byte) begin
              // High byte (MSB)
              reg_channels[current_ch][15:8] <= in_data;
            end else begin
              // Low byte (LSB)
              reg_channels[current_ch][7:0]  <= in_data;
            end

            if (byte_idx == (TOTAL_PAYLOAD - 1)) begin
              state <= ST_CRC;
            end else begin
              byte_idx <= byte_idx + 1'b1;
            end
          end
        end

        ST_CRC: begin
          if (in_valid && in_ready) begin
            reg_crc <= in_data;
            state   <= ST_TAIL;
          end
        end

        ST_TAIL: begin
          if (in_valid && in_ready) begin
            reg_tail       <= in_data;
            channel_valid  <= 1'b1;
            frame_complete <= 1'b1;
            state          <= ST_EMIT_FRAME;
          end
        end

        ST_EMIT_FRAME: begin
          // Wait for downstream module to accept frame
          if (out_ready) begin
            channel_valid  <= 1'b0;
            frame_complete <= 1'b0;
            state          <= ST_IDLE_SYNC1;
          end else begin
            channel_valid  <= 1'b1;
            frame_complete <= 1'b1;
          end
        end

        default: begin
          state <= ST_IDLE_SYNC1;
        end
      endcase
    end
  end

  // Assign registered outputs
  assign seq_num       = reg_seq;
  assign length_field   = reg_len;
  assign received_crc   = reg_crc;
  assign received_tail  = reg_tail;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_assign_channels
      assign channel_data[ch] = reg_channels[ch];
    end
  endgenerate

endmodule

`default_nettype wire
