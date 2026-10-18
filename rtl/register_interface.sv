// ============================================================================
// File: rtl/register_interface.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Memory-mapped register file providing complete software-accessible
//              configuration and real-time status telemetry.
// Synthesizable: YES
// Latency: 1 cycle for Read/Write Ack
// ============================================================================
//
// ============================================================================
// MEMORY MAP DOCUMENTATION (Address Width: 8 bits, Data Width: 16 bits)
// ----------------------------------------------------------------------------
// ADDR   NAME                 TYPE   RESET   DESCRIPTION
// ----------------------------------------------------------------------------
// 0x00   REG_CTRL             R/W    0x0001  [0]: sys_enable
//                                            [1]: filter_bypass
//                                            [2]: auto_baseline_trigger (strobe)
//                                            [3]: filter_mode (0: IIR, 1: MA)
//                                            [4]: soft_reset (strobe)
// 0x01   REG_STATUS           RO     0x0000  [0]: active
//                                            [1]: stream_timeout
//                                            [2]: packet_error
//                                            [3]: anomaly_detected
//                                            [4]: classification_valid
//                                            [5]: system_healthy
// 0x02   REG_FILTER_ALPHA     R/W    0x0040  Filter coefficient alpha in Q8.8 (0.25)
// 0x03   REG_WINDOW_SHIFT     R/W    0x0004  Window size shift (N = 1 << shift, 4->16)
// 0x04   REG_ANOMALY_STUCK    R/W    0x0010  Stuck-at cycle count threshold (16)
// 0x05   REG_ANOMALY_MISSING  R/W    0x07D0  Missing-data cycle watchdog (2000)
// 0x06   REG_HEALTH_WARN_TH   R/W    0x0003  Consecutive anomaly warnings threshold
// 0x07   REG_HEALTH_FAULT_TH  R/W    0x000A  Consecutive anomaly fault threshold
// 0x08   REG_OFFLINE_TO_LO    R/W    0xC350  Offline timeout [15:0] (50,000)
// 0x09   REG_OFFLINE_TO_HI    R/W    0x0000  Offline timeout [31:16]
// 0x0A   REG_HEALTH_SUMMARY   RO     0x0000  2-bit health status per channel (Ch7..0)
// 0x0B   REG_CLASSIFICATION   RO     0x0000  [15:8]: match_score, [2:0]: class_id
// 0x0C   REG_ANOMALY_STATUS   RO     0x0000  [10:8]: anomaly_type, [7:0]: flags
// 0x0D   REG_PACKET_STATUS    RO     0x0000  [15:8]: seq_num, [3:0]: error_code
// 0x0E   REG_CLASS_ENABLES    R/W    0x00FF  Bitmask enabling classes 0 to 7
// 0x0F   REG_MIN_MATCH_SCORE  R/W    0x0001  Minimum matching channels for class
// 0x10..0x17 REG_BASELINES    R/W    0x0000  Per-channel stored baselines (Ch0..7)
// 0x20..0x27 REG_UPPER_BOUND  R/W    0x6400  Per-channel upper bounds (Q8.8, +100.0)
// 0x28..0x2F REG_LOWER_BOUND  R/W    0x0000  Per-channel lower bounds (Q8.8, 0.0)
// 0x30..0x37 REG_MAX_RATE     R/W    0x0A00  Per-channel max rate-of-change (Q8.8, 10.0)
// 0x40   REG_CLASS_TH_CFG     R/W    0x0000  [5:3]: class_idx, [2:0]: ch_idx, [6]: is_max
// 0x41   REG_CLASS_TH_DATA    WO     0x0000  Write triggers class threshold store
// 0x50..0x57 REG_LATEST_MEAN  RO     0x0000  Read latest feature mean for Ch0..7
// ============================================================================

`default_nettype none

module register_interface #(
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8,
  parameter int NUM_CLASSES  = 8
) (
  input  logic clk,
  input  logic rst,

  // Memory-Mapped Bus Slave Interface
  input  logic [7:0]                   reg_addr,
  input  logic [15:0]                  reg_wdata,
  input  logic                         reg_wr_en,
  input  logic                         reg_rd_en,
  output logic [15:0]                  reg_rdata,
  output logic                         reg_ack,

  // Hardware Status Telemetry Inputs
  input  logic                         stat_stream_timeout,
  input  logic                         stat_packet_error,
  input  logic [3:0]                   stat_packet_err_code,
  input  logic [7:0]                   stat_packet_seq,
  input  logic [NUM_CHANNELS-1:0]      stat_anomaly_flags,
  input  logic [2:0]                   stat_anomaly_type,
  input  logic                         stat_anomaly_valid,
  input  logic [15:0]                  stat_health_summary,
  input  logic                         stat_system_healthy,
  input  logic [2:0]                   stat_class_id,
  input  logic [7:0]                   stat_match_score,
  input  logic                         stat_classification_valid,
  input  logic signed [DATA_WIDTH-1:0] stat_feature_means [NUM_CHANNELS-1:0],

  // Hardware Control Configuration Outputs
  output logic                         cfg_sys_enable,
  output logic                         cfg_filter_bypass,
  output logic                         cfg_filter_mode,
  output logic                         cfg_auto_baseline,
  output logic                         cfg_soft_reset,
  output logic signed [DATA_WIDTH-1:0] cfg_filter_alpha,
  output logic [3:0]                   cfg_window_shift,
  output logic [7:0]                   cfg_stuck_threshold,
  output logic [15:0]                  cfg_missing_threshold,
  output logic [7:0]                   cfg_health_warn_thresh,
  output logic [7:0]                   cfg_health_fault_thresh,
  output logic [31:0]                  cfg_health_offline_to,
  output logic [NUM_CLASSES-1:0]       cfg_class_enables,
  output logic [3:0]                   cfg_min_match_score,

  // Direct Hardware Register Configuration Lines
  output logic                         reg_baseline_wr,
  output logic [2:0]                   reg_baseline_ch,
  output logic signed [DATA_WIDTH-1:0] reg_baseline_val,
  input  logic signed [DATA_WIDTH-1:0] current_baselines [NUM_CHANNELS-1:0],

  output logic signed [DATA_WIDTH-1:0] cfg_upper_bound [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] cfg_lower_bound [NUM_CHANNELS-1:0],
  output logic signed [DATA_WIDTH-1:0] cfg_max_rate    [NUM_CHANNELS-1:0],

  output logic                         reg_thresh_wr,
  output logic [2:0]                   reg_thresh_class,
  output logic [2:0]                   reg_thresh_ch,
  output logic                         reg_thresh_is_max,
  output logic signed [DATA_WIDTH-1:0] reg_thresh_val
);

  // Address Constants
  localparam logic [7:0] ADDR_CTRL            = 8'h00;
  localparam logic [7:0] ADDR_STATUS          = 8'h01;
  localparam logic [7:0] ADDR_FILTER_ALPHA    = 8'h02;
  localparam logic [7:0] ADDR_WINDOW_SHIFT    = 8'h03;
  localparam logic [7:0] ADDR_ANOMALY_STUCK   = 8'h04;
  localparam logic [7:0] ADDR_ANOMALY_MISSING = 8'h05;
  localparam logic [7:0] ADDR_HEALTH_WARN     = 8'h06;
  localparam logic [7:0] ADDR_HEALTH_FAULT    = 8'h07;
  localparam logic [7:0] ADDR_OFFLINE_LO      = 8'h08;
  localparam logic [7:0] ADDR_OFFLINE_HI      = 8'h09;
  localparam logic [7:0] ADDR_HEALTH_SUMMARY  = 8'h0A;
  localparam logic [7:0] ADDR_CLASSIFICATION  = 8'h0B;
  localparam logic [7:0] ADDR_ANOMALY_STATUS  = 8'h0C;
  localparam logic [7:0] ADDR_PACKET_STATUS   = 8'h0D;
  localparam logic [7:0] ADDR_CLASS_ENABLES   = 8'h0E;
  localparam logic [7:0] ADDR_MIN_MATCH_SCORE = 8'h0F;
  localparam logic [7:0] ADDR_CLASS_TH_CFG    = 8'h40;
  localparam logic [7:0] ADDR_CLASS_TH_DATA   = 8'h41;

  // Internal configuration registers
  logic [15:0] reg_ctrl;
  logic signed [15:0] reg_alpha;
  logic [3:0]  reg_win_shift;
  logic [7:0]  reg_stuck_th;
  logic [15:0] reg_missing_th;
  logic [7:0]  reg_warn_th;
  logic [7:0]  reg_fault_th;
  logic [31:0] reg_offline_to;
  logic [7:0]  reg_class_en;
  logic [3:0]  reg_min_score;

  logic signed [DATA_WIDTH-1:0] reg_upper [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_lower [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] reg_rate  [NUM_CHANNELS-1:0];

  logic [6:0]  reg_th_cfg;
  logic        pulse_baseline_wr;
  logic [2:0]  sel_baseline_ch;
  logic signed [15:0] val_baseline_wr;

  logic        pulse_thresh_wr;
  logic [2:0]  sel_thresh_class;
  logic [2:0]  sel_thresh_ch;
  logic        sel_thresh_is_max;
  logic signed [15:0] val_thresh_wr;

  // Read response registers
  logic [15:0] read_data_comb;
  logic [15:0] reg_rdata_out;
  logic        reg_ack_out;

  // Read multiplexer logic
  always_comb begin
    read_data_comb = 16'h0000;

    if (reg_addr == ADDR_CTRL) begin
      read_data_comb = reg_ctrl;
    end else if (reg_addr == ADDR_STATUS) begin
      read_data_comb = {10'd0,
                        stat_system_healthy,
                        stat_classification_valid,
                        (stat_anomaly_flags != '0),
                        stat_packet_error,
                        stat_stream_timeout,
                        reg_ctrl[0]};
    end else if (reg_addr == ADDR_FILTER_ALPHA) begin
      read_data_comb = reg_alpha;
    end else if (reg_addr == ADDR_WINDOW_SHIFT) begin
      read_data_comb = {12'd0, reg_win_shift};
    end else if (reg_addr == ADDR_ANOMALY_STUCK) begin
      read_data_comb = {8'd0, reg_stuck_th};
    end else if (reg_addr == ADDR_ANOMALY_MISSING) begin
      read_data_comb = reg_missing_th;
    end else if (reg_addr == ADDR_HEALTH_WARN) begin
      read_data_comb = {8'd0, reg_warn_th};
    end else if (reg_addr == ADDR_HEALTH_FAULT) begin
      read_data_comb = {8'd0, reg_fault_th};
    end else if (reg_addr == ADDR_OFFLINE_LO) begin
      read_data_comb = reg_offline_to[15:0];
    end else if (reg_addr == ADDR_OFFLINE_HI) begin
      read_data_comb = reg_offline_to[31:16];
    end else if (reg_addr == ADDR_HEALTH_SUMMARY) begin
      read_data_comb = stat_health_summary;
    end else if (reg_addr == ADDR_CLASSIFICATION) begin
      read_data_comb = {stat_match_score, 5'd0, stat_class_id};
    end else if (reg_addr == ADDR_ANOMALY_STATUS) begin
      read_data_comb = {5'd0, stat_anomaly_type, stat_anomaly_flags};
    end else if (reg_addr == ADDR_PACKET_STATUS) begin
      read_data_comb = {stat_packet_seq, 4'd0, stat_packet_err_code};
    end else if (reg_addr == ADDR_CLASS_ENABLES) begin
      read_data_comb = {8'd0, reg_class_en};
    end else if (reg_addr == ADDR_MIN_MATCH_SCORE) begin
      read_data_comb = {12'd0, reg_min_score};
    end else if (reg_addr >= 8'h10 && reg_addr <= 8'h17) begin
      read_data_comb = current_baselines[reg_addr - 8'h10];
    end else if (reg_addr >= 8'h20 && reg_addr <= 8'h27) begin
      read_data_comb = reg_upper[reg_addr - 8'h20];
    end else if (reg_addr >= 8'h28 && reg_addr <= 8'h2F) begin
      read_data_comb = reg_lower[reg_addr - 8'h28];
    end else if (reg_addr >= 8'h30 && reg_addr <= 8'h37) begin
      read_data_comb = reg_rate[reg_addr - 8'h30];
    end else if (reg_addr >= 8'h50 && reg_addr <= 8'h57) begin
      read_data_comb = stat_feature_means[reg_addr - 8'h50];
    end else begin
      read_data_comb = 16'hDEAD;
    end
  end

  always_ff @(posedge clk) begin
    if (rst) begin
      reg_ack_out       <= 1'b0;
      reg_rdata_out     <= 16'h0000;
      reg_ctrl          <= 16'h0001; // Enabled by default
      reg_alpha         <= 16'h0040; // 0.25 Q8.8
      reg_win_shift     <= 4'd4;     // N=16
      reg_stuck_th      <= 8'd16;
      reg_missing_th    <= 16'd2000;
      reg_warn_th       <= 8'd3;
      reg_fault_th      <= 8'd10;
      reg_offline_to    <= 32'd50000;
      reg_class_en      <= 8'hFF;
      reg_min_score     <= 4'd1;
      reg_th_cfg        <= 7'd0;

      pulse_baseline_wr <= 1'b0;
      sel_baseline_ch   <= 3'd0;
      val_baseline_wr   <= 16'd0;

      pulse_thresh_wr   <= 1'b0;
      sel_thresh_class  <= 3'd0;
      sel_thresh_ch     <= 3'd0;
      sel_thresh_is_max <= 1'b0;
      val_thresh_wr     <= 16'd0;

      for (int i = 0; i < NUM_CHANNELS; i = i + 1) begin
        reg_upper[i] <= 16'sh6400; // +100.0 Q8.8
        reg_lower[i] <= 16'sh0000; // 0.0 Q8.8
        reg_rate[i]  <= 16'sh0A00; // 10.0 Q8.8
      end
    end else begin
      // Default single-cycle strobes
      reg_ack_out       <= 1'b0;
      pulse_baseline_wr <= 1'b0;
      pulse_thresh_wr   <= 1'b0;
      reg_ctrl[2]       <= 1'b0; // Auto-baseline strobe auto-clears
      reg_ctrl[4]       <= 1'b0; // Soft reset strobe auto-clears

      // Read Cycle
      if (reg_rd_en) begin
        reg_rdata_out <= read_data_comb;
        reg_ack_out   <= 1'b1;
      end

      // Write Cycle
      if (reg_wr_en) begin
        reg_ack_out <= 1'b1;

        if (reg_addr == ADDR_CTRL) begin
          reg_ctrl <= reg_wdata;
        end else if (reg_addr == ADDR_FILTER_ALPHA) begin
          reg_alpha <= reg_wdata;
        end else if (reg_addr == ADDR_WINDOW_SHIFT) begin
          reg_win_shift <= reg_wdata[3:0];
        end else if (reg_addr == ADDR_ANOMALY_STUCK) begin
          reg_stuck_th <= reg_wdata[7:0];
        end else if (reg_addr == ADDR_ANOMALY_MISSING) begin
          reg_missing_th <= reg_wdata;
        end else if (reg_addr == ADDR_HEALTH_WARN) begin
          reg_warn_th <= reg_wdata[7:0];
        end else if (reg_addr == ADDR_HEALTH_FAULT) begin
          reg_fault_th <= reg_wdata[7:0];
        end else if (reg_addr == ADDR_OFFLINE_LO) begin
          reg_offline_to[15:0] <= reg_wdata;
        end else if (reg_addr == ADDR_OFFLINE_HI) begin
          reg_offline_to[31:16] <= reg_wdata;
        end else if (reg_addr == ADDR_CLASS_ENABLES) begin
          reg_class_en <= reg_wdata[7:0];
        end else if (reg_addr == ADDR_MIN_MATCH_SCORE) begin
          reg_min_score <= reg_wdata[3:0];
        end else if (reg_addr >= 8'h10 && reg_addr <= 8'h17) begin
          pulse_baseline_wr <= 1'b1;
          sel_baseline_ch   <= reg_addr[2:0];
          val_baseline_wr   <= reg_wdata;
        end else if (reg_addr >= 8'h20 && reg_addr <= 8'h27) begin
          reg_upper[reg_addr[2:0]] <= reg_wdata;
        end else if (reg_addr >= 8'h28 && reg_addr <= 8'h2F) begin
          reg_lower[reg_addr[2:0]] <= reg_wdata;
        end else if (reg_addr >= 8'h30 && reg_addr <= 8'h37) begin
          reg_rate[reg_addr[2:0]] <= reg_wdata;
        end else if (reg_addr == ADDR_CLASS_TH_CFG) begin
          reg_th_cfg <= reg_wdata[6:0];
        end else if (reg_addr == ADDR_CLASS_TH_DATA) begin
          pulse_thresh_wr   <= 1'b1;
          sel_thresh_class  <= reg_th_cfg[5:3];
          sel_thresh_ch     <= reg_th_cfg[2:0];
          sel_thresh_is_max <= reg_th_cfg[6];
          val_thresh_wr     <= reg_wdata;
        end
      end
    end
  end

  // Register Output Assignments
  assign reg_rdata               = reg_rdata_out;
  assign reg_ack                 = reg_ack_out;

  assign cfg_sys_enable          = reg_ctrl[0];
  assign cfg_filter_bypass       = reg_ctrl[1];
  assign cfg_auto_baseline       = reg_ctrl[2];
  assign cfg_filter_mode         = reg_ctrl[3];
  assign cfg_soft_reset          = reg_ctrl[4];

  assign cfg_filter_alpha        = reg_alpha;
  assign cfg_window_shift        = reg_win_shift;
  assign cfg_stuck_threshold     = reg_stuck_th;
  assign cfg_missing_threshold   = reg_missing_th;
  assign cfg_health_warn_thresh  = reg_warn_th;
  assign cfg_health_fault_thresh = reg_fault_th;
  assign cfg_health_offline_to   = reg_offline_to;
  assign cfg_class_enables       = reg_class_en;
  assign cfg_min_match_score     = reg_min_score;

  assign reg_baseline_wr         = pulse_baseline_wr;
  assign reg_baseline_ch         = sel_baseline_ch;
  assign reg_baseline_val        = val_baseline_wr;

  assign reg_thresh_wr           = pulse_thresh_wr;
  assign reg_thresh_class        = sel_thresh_class;
  assign reg_thresh_ch           = sel_thresh_ch;
  assign reg_thresh_is_max       = sel_thresh_is_max;
  assign reg_thresh_val          = val_thresh_wr;

  genvar ch;
  generate
    for (ch = 0; ch < NUM_CHANNELS; ch = ch + 1) begin: gen_reg_bounds
      assign cfg_upper_bound[ch] = reg_upper[ch];
      assign cfg_lower_bound[ch] = reg_lower[ch];
      assign cfg_max_rate[ch]    = reg_rate[ch];
    end
  endgenerate

endmodule

`default_nettype wire
