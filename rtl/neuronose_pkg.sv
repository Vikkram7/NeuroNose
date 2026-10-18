// ============================================================================
// File: rtl/neuronose_pkg.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Global package containing system parameters, data types, 
//              Q8.8 fixed-point constants, and protocol definitions.
// Synthesizable: YES
// ============================================================================

`default_nettype none

package neuronose_pkg;

  // --------------------------------------------------------------------------
  // System Dimensions & Fixed-Point Constants
  // --------------------------------------------------------------------------
  localparam int DATA_WIDTH     = 16;  // Q8.8 format: 1 sign, 7 integer, 8 fractional bits
  localparam int FRAC_BITS      = 8;   // Fractional bits for Q8.8
  localparam int NUM_CHANNELS   = 8;   // 8 sensor channels (e.g. MOX array)
  localparam int NUM_CLASSES    = 8;   // Supported classification categories

  // Fixed-point Q8.8 boundary limits (16-bit signed)
  localparam logic signed [DATA_WIDTH-1:0] Q8_8_MAX = 16'sh7FFF; // +127.99609375
  localparam logic signed [DATA_WIDTH-1:0] Q8_8_MIN = -16'sh8000; // -128.00000000
  localparam logic signed [DATA_WIDTH-1:0] Q8_8_ZERO = 16'sh0000;
  localparam logic signed [DATA_WIDTH-1:0] Q8_8_ONE  = 16'sh0100; // 1.0 in Q8.8 = 256

  // --------------------------------------------------------------------------
  // Packet Protocol Parameters
  // Total Frame Size = 2 (Sync) + 1 (Seq) + 1 (Len) + 16 (Payload) + 1 (CRC) + 1 (Tail) = 22 Bytes
  // --------------------------------------------------------------------------
  localparam logic [7:0] SYNC_BYTE_1   = 8'hAA;
  localparam logic [7:0] SYNC_BYTE_2   = 8'h55;
  localparam logic [7:0] TAIL_BYTE     = 8'h5A;
  localparam int         PAYLOAD_BYTES = NUM_CHANNELS * (DATA_WIDTH / 8); // 8 * 2 = 16 bytes
  localparam int         PACKET_SIZE   = 2 + 1 + 1 + PAYLOAD_BYTES + 1 + 1; // 22 bytes
  localparam logic [7:0] CRC8_POLY     = 8'h07; // CRC-8 polynomial: x^8 + x^2 + x + 1

  // --------------------------------------------------------------------------
  // Protocol & System Error Enumeration
  // --------------------------------------------------------------------------
  typedef enum logic [3:0] {
    ERR_NONE        = 4'h0,
    ERR_BAD_HEADER  = 4'h1,
    ERR_BAD_FOOTER  = 4'h2,
    ERR_BAD_CRC     = 4'h3,
    ERR_BAD_LENGTH  = 4'h4,
    ERR_SEQ_GAP     = 4'h5,
    ERR_TIMEOUT     = 4'h6,
    ERR_OVERRUN     = 4'h7
  } packet_error_e;

  // --------------------------------------------------------------------------
  // Sensor Health States
  // --------------------------------------------------------------------------
  typedef enum logic [1:0] {
    HEALTH_OK       = 2'b00,
    HEALTH_WARNING  = 2'b01,
    HEALTH_FAULT    = 2'b10,
    HEALTH_OFFLINE  = 2'b11
  } health_state_e;

  // --------------------------------------------------------------------------
  // Anomaly Detection Classifications
  // --------------------------------------------------------------------------
  typedef enum logic [2:0] {
    ANOMALY_NONE          = 3'b000,
    ANOMALY_OUT_OF_BOUNDS = 3'b001,
    ANOMALY_RATE_OF_CHANGE= 3'b010,
    ANOMALY_STUCK_AT      = 3'b011,
    ANOMALY_MISSING_DATA  = 3'b100
  } anomaly_type_e;

  // --------------------------------------------------------------------------
  // Basic Channel Data Types
  // --------------------------------------------------------------------------
  typedef logic signed [DATA_WIDTH-1:0] sample_t;

  // --------------------------------------------------------------------------
  // Synthesizable CRC-8 Function (x^8 + x^2 + x + 1, init 0x00)
  // --------------------------------------------------------------------------
  function automatic logic [7:0] crc8_byte(
    input logic [7:0] data_in,
    input logic [7:0] current_crc
  );
    logic [7:0] crc;
    begin
      crc = current_crc ^ data_in;
      for (int i = 0; i < 8; i = i + 1) begin
        if (crc[7]) begin
          crc = (crc << 1) ^ CRC8_POLY;
        end else begin
          crc = (crc << 1);
        end
      end
      return crc;
    end
  endfunction

endpackage: neuronose_pkg

`default_nettype wire
