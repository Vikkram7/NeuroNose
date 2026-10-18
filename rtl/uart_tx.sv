// ============================================================================
// File: rtl/uart_tx.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: UART Transmitter core supporting 8N1 serial protocol with
//              parameterized clock frequency and baud rate. Features a byte-level
//              valid/ready handshake and busy status indicator.
// Synthesizable: YES
// ============================================================================

`default_nettype none

module uart_tx #(
  parameter int CLK_FREQ  = 50_000_000,
  parameter int BAUD_RATE = 115200
) (
  input  logic clk,
  input  logic rst,

  // Byte Stream Handshake Interface
  input  logic [7:0] tx_data,
  input  logic       tx_valid,
  output logic       tx_ready,
  output logic       tx_busy,

  // Serial Line Output
  output logic       uart_txd
);

  localparam int CLKS_PER_BIT = CLK_FREQ / BAUD_RATE;

  typedef enum logic [1:0] {
    ST_IDLE  = 2'b00,
    ST_START = 2'b01,
    ST_DATA  = 2'b10,
    ST_STOP  = 2'b11
  } state_e;

  state_e state;

  logic [15:0] clk_cnt;
  logic [2:0]  bit_idx;
  logic [7:0]  shift_reg;
  logic        txd_reg;

  assign tx_ready = (state == ST_IDLE);
  assign tx_busy  = (state != ST_IDLE);
  assign uart_txd = txd_reg;

  always_ff @(posedge clk) begin
    if (rst) begin
      state     <= ST_IDLE;
      clk_cnt   <= 16'd0;
      bit_idx   <= 3'd0;
      shift_reg <= 8'd0;
      txd_reg   <= 1'b1; // UART idle line is high
    end else begin
      case (state)
        ST_IDLE: begin
          txd_reg <= 1'b1;
          clk_cnt <= 16'd0;
          bit_idx <= 3'd0;
          if (tx_valid) begin
            shift_reg <= tx_data;
            txd_reg   <= 1'b0; // Drive Start Bit
            state     <= ST_START;
          end
        end

        ST_START: begin
          txd_reg <= 1'b0;
          if (clk_cnt >= (CLKS_PER_BIT - 1)) begin
            clk_cnt <= 16'd0;
            txd_reg <= shift_reg[0];
            state   <= ST_DATA;
          end else begin
            clk_cnt <= clk_cnt + 1'b1;
          end
        end

        ST_DATA: begin
          txd_reg <= shift_reg[bit_idx];
          if (clk_cnt >= (CLKS_PER_BIT - 1)) begin
            clk_cnt <= 16'd0;
            if (bit_idx == 3'd7) begin
              bit_idx <= 3'd0;
              txd_reg <= 1'b1; // Drive Stop Bit
              state   <= ST_STOP;
            end else begin
              bit_idx <= bit_idx + 1'b1;
            end
          end else begin
            clk_cnt <= clk_cnt + 1'b1;
          end
        end

        ST_STOP: begin
          txd_reg <= 1'b1;
          if (clk_cnt >= (CLKS_PER_BIT - 1)) begin
            clk_cnt <= 16'd0;
            state   <= ST_IDLE;
          end else begin
            clk_cnt <= clk_cnt + 1'b1;
          end
        end

        default: begin
          state <= ST_IDLE;
        end
      endcase
    end
  end

endmodule

`default_nettype wire
