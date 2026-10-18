// ============================================================================
// File: rtl/neuronose_top.sv
// Project: NeuroNose Gas Sensor Array Signal Processing & Classification Core
// Description: Top-level integration module for the NeuroNose electronic nose
//              processing system. Integrates UART communication, frame deserialization,
//              packet verification, Q8.8 fixed-point IIR/MA filtering, baseline
//              correction, statistical feature extraction, anomaly detection,
//              sensor health tracking, and threshold-based multi-class classification.
// Synthesizable: YES
// ============================================================================
//
// ============================================================================
// PIPELINE ARCHITECTURE & TIMING LATENCY SPECIFICATION
// ----------------------------------------------------------------------------
// Stage 1: Ingestion & Deserialization (sensor_stream_interface)
//          - Input: Byte stream (via UART RX or direct parallel byte port)
//          - Latency: 22 byte periods to assemble full 8-channel frame.
// Stage 2: Packet Validation (packet_validator)
//          - Checks Sync, Length (16B), Tail (0x5A), CRC-8, and Sequence continuity.
//          - Latency: 1 system clock cycle.
// Stage 3: Fixed-Point Filtering (fixed_point_filter x8)
//          - 8 parallel channels of Q8.8 IIR/MA low-pass filter with symmetric rounding.
//          - Latency: 1 system clock cycle.
// Stage 4: Baseline Correction (baseline_corrector)
//          - Per-channel baseline subtraction with zero-clamping [0, 32767].
//          - Latency: 1 system clock cycle.
// Stage 5: Anomaly Detection & Sensor Health (anomaly_flagger, sensor_health_monitor)
//          - Evaluates bounds, rate-of-change, stuck-at, and missing data.
//          - Updates health FSMs (OK, WARN, FAULT, OFFLINE) and fault counters.
//          - Latency: 1 system clock cycle.
// Stage 6: Statistical Feature Extraction (feature_extractor)
//          - Accumulates Min, Max, Mean, Energy, Variance over N = 2^shift samples.
//          - Latency: N sample periods + 1 system clock cycle.
// Stage 7: Threshold Classification (threshold_classifier)
//          - Compares 8-channel feature vector to class bounding profiles.
//          - Evaluates match scores and resolves ties via lowest Class ID.
//          - Latency: 1 system clock cycle after feature extraction completes.
// Total Pipeline Delay per sample: 4 clock cycles (Stages 2 -> 5).
// Window-to-Class Latency: 2 clock cycles after window sample N arrives.
// ============================================================================

`default_nettype none

module neuronose_top #(
  parameter int CLK_FREQ     = 50_000_000,
  parameter int BAUD_RATE    = 115200,
  parameter int DATA_WIDTH   = 16,
  parameter int NUM_CHANNELS = 8,
  parameter int NUM_CLASSES  = 8
) (
  input  logic clk,
  input  logic rst,

  // Serial UART Interface (Optional external connection)
  input  logic uart_rxd,
  output logic uart_txd,

  // Direct Parallel Byte Stream Interface (Alternative to UART)
  input  logic [7:0]                   direct_stream_data,
  input  logic                         direct_stream_valid,
  output logic                         direct_stream_ready,
  input  logic                         use_direct_stream,

  // Memory-Mapped Register Bus Interface
  input  logic [7:0]                   reg_addr,
  input  logic [15:0]                  reg_wdata,
  input  logic                         reg_wr_en,
  input  logic                         reg_rd_en,
  output logic [15:0]                  reg_rdata,
  output logic                         reg_ack,

  // Classification Results
  output logic [2:0]                   class_id,
  output logic [7:0]                   match_score,
  output logic                         classification_valid,

  // Anomaly & Health Telemetry Outputs
  output logic [NUM_CHANNELS-1:0]      anomaly_flags,
  output logic [2:0]                   anomaly_type,
  output logic                         anomaly_valid,
  output logic [15:0]                  health_summary,
  output logic                         system_healthy,

  // Board Diagnostic LEDs
  output logic [7:0]                   led_status
);

  import neuronose_pkg::*;

  // --------------------------------------------------------------------------
  // Internal Configuration and Status Wires (Register Interface Interconnect)
  // --------------------------------------------------------------------------
  logic                         cfg_sys_enable;
  logic                         cfg_filter_bypass;
  logic                         cfg_filter_mode;
  logic                         cfg_auto_baseline;
  logic                         cfg_soft_reset;
  logic signed [DATA_WIDTH-1:0] cfg_filter_alpha;
  logic [3:0]                   cfg_window_shift;
  logic [7:0]                   cfg_stuck_threshold;
  logic [15:0]                  cfg_missing_threshold;
  logic [7:0]                   cfg_health_warn_thresh;
  logic [7:0]                   cfg_health_fault_thresh;
  logic [31:0]                  cfg_health_offline_to;
  logic [NUM_CLASSES-1:0]       cfg_class_enables;
  logic [3:0]                   cfg_min_match_score;

  logic                         reg_baseline_wr;
  logic [2:0]                   reg_baseline_ch;
  logic signed [DATA_WIDTH-1:0] reg_baseline_val;
  logic signed [DATA_WIDTH-1:0] current_baselines [NUM_CHANNELS-1:0];

  logic signed [DATA_WIDTH-1:0] cfg_upper_bound [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] cfg_lower_bound [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] cfg_max_rate    [NUM_CHANNELS-1:0];

  logic                         reg_thresh_wr;
  logic [2:0]                   reg_thresh_class;
  logic [2:0]                   reg_thresh_ch;
  logic                         reg_thresh_is_max;
  logic signed [DATA_WIDTH-1:0] reg_thresh_val;

  // Composite Synchronous Reset
  wire sys_rst = rst || cfg_soft_reset;

  // --------------------------------------------------------------------------
  // UART Transceiver Instances
  // --------------------------------------------------------------------------
  logic [7:0] uart_rx_byte;
  logic       uart_rx_valid;
  logic       uart_rx_framing_err;
  logic       uart_rx_ready;

  uart_rx #(
    .CLK_FREQ   (CLK_FREQ),
    .BAUD_RATE  (BAUD_RATE),
    .OVERSAMPLE (3)
  ) u_uart_rx (
    .clk           (clk),
    .rst           (sys_rst),
    .uart_rxd      (uart_rxd),
    .rx_data       (uart_rx_byte),
    .rx_valid      (uart_rx_valid),
    .framing_error (uart_rx_framing_err),
    .rx_ready      (uart_rx_ready)
  );

  logic [7:0] uart_tx_byte;
  logic       uart_tx_valid;
  logic       uart_tx_ready;
  logic       uart_tx_busy;

  // Simple telemetry TX: sends classification ID when available
  assign uart_tx_byte  = {5'd0, class_id};
  assign uart_tx_valid = classification_valid;

  uart_tx #(
    .CLK_FREQ  (CLK_FREQ),
    .BAUD_RATE (BAUD_RATE)
  ) u_uart_tx (
    .clk      (clk),
    .rst      (sys_rst),
    .tx_data  (uart_tx_byte),
    .tx_valid (uart_tx_valid),
    .tx_ready (uart_tx_ready),
    .tx_busy  (uart_tx_busy),
    .uart_txd (uart_txd)
  );

  // --------------------------------------------------------------------------
  // Ingestion Multiplexer (UART vs Direct Parallel Stream)
  // --------------------------------------------------------------------------
  logic [7:0] stream_byte;
  logic       stream_valid;
  logic       stream_ready;

  always_comb begin
    if (use_direct_stream) begin
      stream_byte         = direct_stream_data;
      stream_valid        = direct_stream_valid && cfg_sys_enable;
      direct_stream_ready = stream_ready;
      uart_rx_ready       = 1'b0;
    end else begin
      stream_byte         = uart_rx_byte;
      stream_valid        = uart_rx_valid && cfg_sys_enable;
      uart_rx_ready       = stream_ready;
      direct_stream_ready = 1'b0;
    end
  end

  // --------------------------------------------------------------------------
  // Stage 1: Stream Deserializer & Frame Synchronizer
  // --------------------------------------------------------------------------
  logic signed [DATA_WIDTH-1:0] ssi_channel_data [NUM_CHANNELS-1:0];
  logic [7:0]                   ssi_seq;
  logic [7:0]                   ssi_len;
  logic [7:0]                   ssi_crc;
  logic [7:0]                   ssi_tail;
  logic                         ssi_valid;
  logic                         ssi_frame_done;
  logic                         ssi_timeout;
  logic                         ssi_ready;

  sensor_stream_interface #(
    .DATA_WIDTH     (DATA_WIDTH),
    .NUM_CHANNELS   (NUM_CHANNELS),
    .TIMEOUT_CYCLES (2000)
  ) u_stream_if (
    .clk            (clk),
    .rst            (sys_rst),
    .in_data        (stream_byte),
    .in_valid       (stream_valid),
    .in_ready       (stream_ready),
    .channel_data   (ssi_channel_data),
    .seq_num        (ssi_seq),
    .length_field   (ssi_len),
    .received_crc   (ssi_crc),
    .received_tail  (ssi_tail),
    .channel_valid  (ssi_valid),
    .frame_complete (ssi_frame_done),
    .timeout_error  (ssi_timeout),
    .out_ready      (ssi_ready)
  );

  // --------------------------------------------------------------------------
  // Stage 2: Packet Verification
  // --------------------------------------------------------------------------
  logic signed [DATA_WIDTH-1:0] val_channel_data [NUM_CHANNELS-1:0];
  logic [7:0]                   val_seq;
  logic                         val_packet_valid;
  logic                         val_packet_error;
  logic [3:0]                   val_error_code;
  logic                         val_ready;

  packet_validator #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS)
  ) u_packet_val (
    .clk              (clk),
    .rst              (sys_rst),
    .in_channel_data  (ssi_channel_data),
    .in_seq_num       (ssi_seq),
    .in_length        (ssi_len),
    .in_crc           (ssi_crc),
    .in_footer        (ssi_tail),
    .in_valid         (ssi_valid),
    .in_ready         (ssi_ready),
    .out_channel_data (val_channel_data),
    .out_seq_num      (val_seq),
    .packet_valid     (val_packet_valid),
    .packet_error     (val_packet_error),
    .error_code       (val_error_code),
    .out_ready        (val_ready)
  );

  // --------------------------------------------------------------------------
  // Stage 3: Multichannel Fixed-Point Filtering
  // --------------------------------------------------------------------------
  logic signed [DATA_WIDTH-1:0] flt_channel_data [NUM_CHANNELS-1:0];
  logic [NUM_CHANNELS-1:0]      flt_in_ready;
  logic [NUM_CHANNELS-1:0]      flt_out_valid;
  logic                         flt_downstream_ready;

  // Parallel bank of 8 digital filters
  genvar i;
  generate
    for (i = 0; i < NUM_CHANNELS; i = i + 1) begin: gen_channel_filters
      fixed_point_filter #(
        .DATA_WIDTH   (DATA_WIDTH),
        .COEFF_WIDTH  (DATA_WIDTH),
        .FILTER_ORDER (4)
      ) u_filter_ch (
        .clk         (clk),
        .rst         (sys_rst),
        .coeff_alpha (cfg_filter_alpha),
        .filter_mode (cfg_filter_mode),
        .bypass      (cfg_filter_bypass),
        .in_data     (val_channel_data[i]),
        .in_valid    (val_packet_valid),
        .in_ready    (flt_in_ready[i]),
        .out_data    (flt_channel_data[i]),
        .out_valid   (flt_out_valid[i]),
        .out_ready   (flt_downstream_ready)
      );
    end
  endgenerate

  assign val_ready = flt_in_ready[0];
  wire flt_valid   = flt_out_valid[0];

  // --------------------------------------------------------------------------
  // Stage 4: Baseline Correction
  // --------------------------------------------------------------------------
  logic signed [DATA_WIDTH-1:0] base_channel_data [NUM_CHANNELS-1:0];
  logic                         base_valid;
  logic                         base_ready;

  baseline_corrector #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS)
  ) u_baseline_corr (
    .clk                   (clk),
    .rst                   (sys_rst),
    .in_channel_data       (flt_channel_data),
    .in_valid              (flt_valid),
    .in_ready              (flt_downstream_ready),
    .out_channel_data      (base_channel_data),
    .out_valid             (base_valid),
    .out_ready             (base_ready),
    .auto_baseline_trigger (cfg_auto_baseline),
    .reg_baseline_wr_en    (reg_baseline_wr),
    .reg_baseline_ch_sel   (reg_baseline_ch),
    .reg_baseline_wdata    (reg_baseline_val),
    .reg_baselines         (current_baselines)
  );

  // --------------------------------------------------------------------------
  // Stage 5: Anomaly Flagger & Health Monitor
  // --------------------------------------------------------------------------
  logic [NUM_CHANNELS-1:0] int_anomaly_flags;
  logic [2:0]              int_anomaly_type;
  logic                    int_anomaly_valid;
  logic                    anomaly_ready;

  anomaly_flagger #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS)
  ) u_anomaly_flag (
    .clk                   (clk),
    .rst                   (sys_rst),
    .in_channel_data       (base_channel_data),
    .in_valid              (base_valid),
    .in_ready              (), // Monitored snooping stage
    .anomaly_flags         (int_anomaly_flags),
    .anomaly_type          (int_anomaly_type),
    .anomaly_valid         (int_anomaly_valid),
    .out_ready             (1'b1),
    .cfg_upper_bound       (cfg_upper_bound),
    .cfg_lower_bound       (cfg_lower_bound),
    .cfg_max_rate          (cfg_max_rate),
    .cfg_stuck_threshold   (cfg_stuck_threshold),
    .cfg_missing_threshold (cfg_missing_threshold)
  );

  logic [1:0]  int_channel_health [NUM_CHANNELS-1:0];
  logic [15:0] int_health_summary;
  logic        int_sys_healthy;
  logic [7:0]  int_consec_faults [NUM_CHANNELS-1:0];
  logic [31:0] int_last_valid_ts [NUM_CHANNELS-1:0];

  sensor_health_monitor #(
    .NUM_CHANNELS (NUM_CHANNELS)
  ) u_health_mon (
    .clk                  (clk),
    .rst                  (sys_rst),
    .anomaly_flags        (int_anomaly_flags),
    .anomaly_valid        (int_anomaly_valid),
    .cfg_warn_threshold   (cfg_health_warn_thresh),
    .cfg_fault_threshold  (cfg_health_fault_thresh),
    .cfg_offline_timeout  (cfg_health_offline_to),
    .channel_health       (int_channel_health),
    .health_summary       (int_health_summary),
    .system_healthy       (int_sys_healthy),
    .consec_fault_cnt     (int_consec_faults),
    .last_valid_timestamp (int_last_valid_ts)
  );

  assign anomaly_flags  = int_anomaly_flags;
  assign anomaly_type   = int_anomaly_type;
  assign anomaly_valid  = int_anomaly_valid;
  assign health_summary = int_health_summary;
  assign system_healthy = int_sys_healthy;

  // --------------------------------------------------------------------------
  // Stage 6: Statistical Feature Extractor
  // --------------------------------------------------------------------------
  logic signed [DATA_WIDTH-1:0] feat_min      [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] feat_max      [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] feat_mean     [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] feat_variance [NUM_CHANNELS-1:0];
  logic signed [DATA_WIDTH-1:0] feat_energy   [NUM_CHANNELS-1:0];
  logic                         feat_win_done;
  logic                         feat_valid;
  logic                         feat_ready;

  feature_extractor #(
    .DATA_WIDTH        (DATA_WIDTH),
    .NUM_CHANNELS      (NUM_CHANNELS),
    .DEFAULT_WIN_SHIFT (4)
  ) u_feature_ext (
    .clk              (clk),
    .rst              (sys_rst),
    .cfg_window_shift (cfg_window_shift),
    .in_channel_data  (base_channel_data),
    .in_valid         (base_valid),
    .in_ready         (base_ready),
    .feat_min         (feat_min),
    .feat_max         (feat_max),
    .feat_mean        (feat_mean),
    .feat_variance    (feat_variance),
    .feat_energy      (feat_energy),
    .window_complete  (feat_win_done),
    .out_valid        (feat_valid),
    .out_ready        (feat_ready)
  );

  // --------------------------------------------------------------------------
  // Stage 7: Threshold Multi-Class Classifier
  // --------------------------------------------------------------------------
  logic [2:0] int_class_id;
  logic [7:0] int_match_score;
  logic       int_class_valid;

  threshold_classifier #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS),
    .NUM_CLASSES  (NUM_CLASSES)
  ) u_classifier (
    .clk                  (clk),
    .rst                  (sys_rst),
    .feat_vector          (feat_mean),
    .in_valid             (feat_valid),
    .in_ready             (feat_ready),
    .class_id             (int_class_id),
    .match_score          (int_match_score),
    .classification_valid (int_class_valid),
    .out_ready            (1'b1),
    .reg_thresh_wr_en     (reg_thresh_wr),
    .reg_class_sel        (reg_thresh_class),
    .reg_ch_sel           (reg_thresh_ch),
    .reg_is_max           (reg_thresh_is_max),
    .reg_thresh_wdata     (reg_thresh_val),
    .reg_class_enables    (cfg_class_enables),
    .reg_min_match_score  (cfg_min_match_score)
  );

  assign class_id             = int_class_id;
  assign match_score          = int_match_score;
  assign classification_valid = int_class_valid;

  // --------------------------------------------------------------------------
  // Memory-Mapped Register File Interface
  // --------------------------------------------------------------------------
  register_interface #(
    .DATA_WIDTH   (DATA_WIDTH),
    .NUM_CHANNELS (NUM_CHANNELS),
    .NUM_CLASSES  (NUM_CLASSES)
  ) u_reg_if (
    .clk                       (clk),
    .rst                       (rst),
    .reg_addr                  (reg_addr),
    .reg_wdata                 (reg_wdata),
    .reg_wr_en                 (reg_wr_en),
    .reg_rd_en                 (reg_rd_en),
    .reg_rdata                 (reg_rdata),
    .reg_ack                   (reg_ack),
    .stat_stream_timeout       (ssi_timeout),
    .stat_packet_error         (val_packet_error),
    .stat_packet_err_code      (val_error_code),
    .stat_packet_seq           (val_seq),
    .stat_anomaly_flags        (int_anomaly_flags),
    .stat_anomaly_type         (int_anomaly_type),
    .stat_anomaly_valid        (int_anomaly_valid),
    .stat_health_summary       (int_health_summary),
    .stat_system_healthy       (int_sys_healthy),
    .stat_class_id             (int_class_id),
    .stat_match_score          (int_match_score),
    .stat_classification_valid (int_class_valid),
    .stat_feature_means        (feat_mean),
    .cfg_sys_enable            (cfg_sys_enable),
    .cfg_filter_bypass         (cfg_filter_bypass),
    .cfg_filter_mode           (cfg_filter_mode),
    .cfg_auto_baseline         (cfg_auto_baseline),
    .cfg_soft_reset            (cfg_soft_reset),
    .cfg_filter_alpha          (cfg_filter_alpha),
    .cfg_window_shift          (cfg_window_shift),
    .cfg_stuck_threshold       (cfg_stuck_threshold),
    .cfg_missing_threshold     (cfg_missing_threshold),
    .cfg_health_warn_thresh    (cfg_health_warn_thresh),
    .cfg_health_fault_thresh   (cfg_health_fault_thresh),
    .cfg_health_offline_to     (cfg_health_offline_to),
    .cfg_class_enables         (cfg_class_enables),
    .cfg_min_match_score       (cfg_min_match_score),
    .reg_baseline_wr           (reg_baseline_wr),
    .reg_baseline_ch           (reg_baseline_ch),
    .reg_baseline_val          (reg_baseline_val),
    .current_baselines         (current_baselines),
    .cfg_upper_bound           (cfg_upper_bound),
    .cfg_lower_bound           (cfg_lower_bound),
    .cfg_max_rate              (cfg_max_rate),
    .reg_thresh_wr             (reg_thresh_wr),
    .reg_thresh_class          (reg_thresh_class),
    .reg_thresh_ch             (reg_thresh_ch),
    .reg_thresh_is_max         (reg_thresh_is_max),
    .reg_thresh_val            (reg_thresh_val)
  );

  // --------------------------------------------------------------------------
  // Board Diagnostic LEDs
  // --------------------------------------------------------------------------
  logic [23:0] heartbeat_cnt;
  always_ff @(posedge clk) begin
    if (sys_rst) begin
      heartbeat_cnt <= 24'd0;
    end else begin
      heartbeat_cnt <= heartbeat_cnt + 1'b1;
    end
  end

  assign led_status[0]   = heartbeat_cnt[23];           // LED0: Heartbeat pulse
  assign led_status[1]   = val_packet_valid;            // LED1: Packet received successfully
  assign led_status[2]   = val_packet_error;            // LED2: Packet error detected
  assign led_status[3]   = (int_anomaly_flags != '0);   // LED3: Anomaly present
  assign led_status[4]   = int_class_valid;             // LED4: Classification valid
  assign led_status[5]   = int_sys_healthy;             // LED5: Array healthy
  assign led_status[7:6] = int_class_id[1:0];           // LED7..6: Class identifier [1:0]

endmodule

`default_nettype wire
