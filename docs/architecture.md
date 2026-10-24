# System Architecture Overview

**Project Title:** Parallel File Processing System with CPU Scheduling and AI Insights  
**Academic Course:** Operating Systems Laboratory / Final Course Project  
**Target Platform:** Windows 10/11 with WSL2 Ubuntu (x86_64)

---

## 1. High-Level Architecture

The system is designed with a layered, decoupled architecture combining low-level C systems programming with a modern, responsive web dashboard and lightweight AI analysis.

```text
+-------------------------------------------------------------------------------+
|                             CLIENT BROWSER (UI)                               |
|          HTML5 / CSS3 / Vanilla JavaScript (Inter / JetBrains Mono)           |
|  - Real-time Metrics Dashboard         - Benchmark Bar Visualizations         |
|  - CPU Scheduling Interactive Gantt    - AI Sentiment & Telemetry Displays    |
+---------------------------------------+---------------------------------------+
                                        | HTTP / REST (JSON)
                                        v
+-------------------------------------------------------------------------------+
|                           BACKEND API (Node.js & Express)                     |
|                               Port: 3001                                      |
|  - /api/system       - /api/datasets      - /api/process      - /api/benchmark|
|  - /api/simulate     - /api/analyze       - /api/results      - /api/health   |
|  Safe Child Process Execution via execFile() [No shell string concatenation]  |
+-------------------+-----------------------------------+-----------------------+
                    |                                   |
         fork() / execFile()                  fork() / execFile()
                    v                                   v
+---------------------------------------+   +-----------------------------------+
|      C FILE PROCESSING ENGINE         |   |      PYTHON AI/NLP ANALYZER       |
|             (engine/bin/engine)       |   |         (ai/analyzer.py)          |
|                                       |   |                                   |
|  +---------------------------------+  |   |  - Sentiment Lexicon Polarity     |
|  | Mode A: Sequential Processing   |  |   |  - Stop-Word Filtered Frequency   |
|  +---------------------------------+  |   |  - Unsupervised Complaint Clusters|
|  | Mode B: Parallel (UNIX Pipes)   |  |   |  - Regex Error Signatures         |
|  |   fork(), poll(), waitpid()     |  |   |  - Latency Percentile Analytics   |
|  +---------------------------------+  |   |  - Anomaly Outlier Detection      |
|  | Mode C: Parallel (Shared Memory)|  |   |  - Corpus TF-IDF Extraction       |
|  |   shm_open(), mmap(), sem_t     |  |   |  - Extractive Document Summaries  |
|  +---------------------------------+  |   +-----------------------------------+
|                                       |
|  Core Workload:                       |
|   - Byte & char tallying              |
|   - Word & line counting              |
|   - 32-bit djb2 checksum hash         |
+-------------------+-------------------+
                    |
                    v
+-------------------------------------------------------------------------------+
|                               REPRODUCIBLE DATASETS                           |
|       - datasets/reviews/     : 1,000 synthetic customer reviews (text)       |
|       - datasets/logs/        : 1,000 server log telemetry streams (text)     |
|       - datasets/briefings/   : 500 executive technical briefings (text)      |
+-------------------------------------------------------------------------------+
```

---

## 2. Component Breakdown

### A. High-Performance C Processing Engine (`engine/`)
- **`main.c`**: Parses CLI flags (`--mode`, `--dir`, `--workers`, `--output`, `--json`), initiates directory scans, and dispatches execution.
- **`common.h`**: Defines the shared structures (`file_result_t`, `engine_summary_t`, `shared_memory_block_t`, `pipe_message_t`).
- **`file_processor.c`**: Core workload routine executed identically by all modes to guarantee deterministic, bit-for-bit count equivalence (bytes, lines, words, checksum).
- **`sequential.c`**: Single-process reference implementation establishing the baseline for Amdahl's Law speedup calculations.
- **`parallel_pipes.c`**: Multi-process worker pool using `fork()`, unidirectional UNIX pipes, and `poll()` multiplexing to stream partial metrics.
- **`parallel_shm.c`**: POSIX shared memory (`shm_open`, `mmap`) synchronized via POSIX process-shared semaphores (`sem_t`) with dynamic work stealing.
- **`process_utils.c`**: Monotonic time measurement (`clock_gettime(CLOCK_MONOTONIC)`), deterministic directory sorting, and JSON serialization.

### B. Lightweight AI/NLP Analyzer (`ai/analyzer.py`)
- Standard library Python 3 (zero heavy GPU or PyTorch dependencies).
- Parses structured text files to derive actionable semantic and statistical insights:
  - Lexicon-based sentiment polarities.
  - Telemetry percentile latencies (Mean, Median, P95, P99).
  - Anomaly pattern identification.
  - TF-IDF domain keyword indexing.

### C. Backend API Server (`server.js`)
- Express.js application serving static UI assets and exposing clean REST endpoints.
- Avoids shell injection vulnerabilities by using `execFile()` with discrete argument arrays rather than shell string concatenation.
- Generates unique result files in `results/` for historical tracking.

### D. Web Frontend Dashboard (`web/`)
- Minimalist, responsive UI built with pure HTML5, CSS3, and vanilla JavaScript.
- Restrained academic color palette (Navy, White, Light Gray, Royal Blue accent).
- Interactive Gantt chart for discrete CPU scheduling simulations.
- Empirical comparison bar charts for multi-core throughput and wall-clock execution time.

---

## 3. Communication Pathways & Data Flow

1. **User Request**: User clicks **"Run Full Benchmark"** on the dashboard.
2. **REST Invocation**: Browser issues `POST /api/benchmark` with `{ dataset: "briefings", workers: 4 }`.
3. **Engine Execution**:
   - Backend calls `./engine/bin/engine --mode sequential --dir datasets/briefings ...`
   - Backend calls `./engine/bin/engine --mode pipes --dir datasets/briefings --workers 4 ...`
   - Backend calls `./engine/bin/engine --mode shared_memory --dir datasets/briefings --workers 4 ...`
4. **Validation & Collation**: Backend verifies that all 3 modes generated identical file counts and cumulative checksums, calculates speedups, and saves `results/benchmark_<timestamp>_summary.json`.
5. **Dashboard Rendering**: Frontend renders side-by-side metric cards, verification badges, and visual bars.
