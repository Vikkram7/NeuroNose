// ============================================================================
// File: rtl/uart_rx.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: UART Receiver with 3x oversampling, 2-stage metastability
//              synchronization, false start-bit rejection, stop-bit validation,
//              and framing error detection.
// Synthesizable: YES
// ============================================================================

`default_nettype none

module uart_rx #(
  parameter int CLK_FREQ   = 50_000_000,
  parameter int BAUD_RATE  = 115200,
  parameter int OVERSAMPLE = 3
) (
  input  logic clk,
  input  logic rst,

  // Serial Line Input
  input  logic uart_rxd,

  // Byte Stream Handshake Interface
  output logic [7:0] rx_data,
  output logic       rx_valid,
  output logic       framing_error,
  input  logic       rx_ready
);

  localparam int CLKS_PER_SUB_TICK = CLK_FREQ / (BAUD_RATE * OVERSAMPLE);

  typedef enum logic [1:0] {
    ST_IDLE  = 2'b00,
    ST_START = 2'b01,
    ST_DATA  = 2'b10,
    ST_STOP  = 2'b11
  } state_e;

  state_e state;

  // Metastability synchronizer
  logic rxd_sync1;
  logic rxd_sync2;
  logic rxd_prev;

  // Sub-tick generator counter
  logic [15:0] tick_div;
  logic        sub_tick;

  // State machine counters
  logic [1:0]  sub_sample_cnt; // 0, 1, 2 for 3x oversampling
  logic [2:0]  bit_idx;
  logic [7:0]  shift_reg;
  logic [7:0]  reg_rx_data;
  logic        reg_rx_valid;
  logic        reg_framing_err;

  // 2-stage synchronizer and edge detection
  always_ff @(posedge clk) begin
    if (rst) begin
      rxd_sync1 <= 1'b1;
      rxd_sync2 <= 1'b1;
      rxd_prev  <= 1'b1;
    end else begin
      rxd_sync1 <= uart_rxd;
      rxd_sync2 <= rxd_sync1;
      rxd_prev  <= rxd_sync2;
    end
  end

  wire falling_edge = (rxd_prev == 1'b1) && (rxd_sync2 == 1'b0);

  // Sub-tick generator
  always_ff @(posedge clk) begin
    if (rst) begin
      tick_div <= 16'd0;
      sub_tick <= 1'b0;
    end else begin
      if (state == ST_IDLE) begin
        tick_div <= 16'd0;
        sub_tick <= 1'b0;
      end else begin
        if (tick_div >= (CLKS_PER_SUB_TICK - 1)) begin
          tick_div <= 16'd0;
          sub_tick <= 1'b1;
        end else begin
          tick_div <= tick_div + 1'b1;
          sub_tick <= 1'b0;
        end
      end
    end
  end

  // State Machine logic
  always_ff @(posedge clk) begin
    if (rst) begin
      state           <= ST_IDLE;
      sub_sample_cnt  <= 2'd0;
      bit_idx         <= 3'd0;
      shift_reg       <= 8'd0;
      reg_rx_data     <= 8'd0;
      reg_rx_valid    <= 1'b0;
      reg_framing_err <= 1'b0;
    end else begin
      // Clear valid on downstream read
      if (reg_rx_valid && rx_ready) begin
        reg_rx_valid    <= 1'b0;
        reg_framing_err <= 1'b0;
      end

      case (state)
        ST_IDLE: begin
          sub_sample_cnt <= 2'd0;
          bit_idx        <= 3'd0;
          if (falling_edge) begin
            state <= ST_START;
          end
        end

        ST_START: begin
          if (sub_tick) begin
            if (sub_sample_cnt == 2'd1) begin
              // Middle of start bit: verify line is indeed low
              if (rxd_sync2 != 1'b0) begin
                // False start bit detected
                state <= ST_IDLE;
              end
            end

            if (sub_sample_cnt == (OVERSAMPLE - 1)) begin
              sub_sample_cnt <= 2'd0;
              state          <= ST_DATA;
            end else begin
              sub_sample_cnt <= sub_sample_cnt + 1'b1;
            end
          end
        end

        ST_DATA: begin
          if (sub_tick) begin
            // Middle sample at sub_sample_cnt == 1
            if (sub_sample_cnt == 2'd1) begin
              shift_reg[bit_idx] <= rxd_sync2;
            end

            if (sub_sample_cnt == (OVERSAMPLE - 1)) begin
              sub_sample_cnt <= 2'd0;
              if (bit_idx == 3'd7) begin
                bit_idx <= 3'd0;
                state   <= ST_STOP;
              end else begin
                bit_idx <= bit_idx + 1'b1;
              end
            end else begin
              sub_sample_cnt <= sub_sample_cnt + 1'b1;
            end
          end
        end

        ST_STOP: begin
          if (sub_tick) begin
            // Middle sample of stop bit: verify high line
            if (sub_sample_cnt == 2'd1) begin
              if (rxd_sync2 != 1'b1) begin
                reg_framing_err <= 1'b1;
              end else begin
                reg_framing_err <= 1'b0;
              end
            end

            if (sub_sample_cnt == (OVERSAMPLE - 1)) begin
              sub_sample_cnt <= 2'd0;
              reg_rx_data    <= shift_reg;
              reg_rx_valid   <= 1'b1;
              state          <= ST_IDLE;
            end else begin
              sub_sample_cnt <= sub_sample_cnt + 1'b1;
            end
          end
        end

        default: begin
          state <= ST_IDLE;
        end
      endcase
    end
  end

  assign rx_data       = reg_rx_data;
  assign rx_valid      = reg_rx_valid;
  assign framing_error = reg_framing_err;

endmodule

`default_nettype wire
