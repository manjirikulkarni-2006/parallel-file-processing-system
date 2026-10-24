# Parallel File Processing System with CPU Scheduling and AI Insights

An Operating Systems final course project demonstrating **process creation (`fork()`)**, **inter-process communication (UNIX Pipes & POSIX Shared Memory)**, **process synchronization (POSIX Semaphores)**, **high-resolution monotonic benchmarking**, **CPU scheduling modeling (FCFS, Priority, Round Robin)**, and **lightweight AI telemetry insights**.

Built for reliable execution and demonstration on **Windows 10/11 using WSL2 Ubuntu**.

---

## Key Highlights

- **Three Processing Paradigms**:
  - **Mode A (Sequential):** Single-process golden baseline.
  - **Mode B (UNIX Pipes):** Multi-process worker pool using `fork()`, unidirectional pipes, and `poll()` multiplexing with partial-read and `EINTR` resilience.
  - **Mode C (POSIX Shared Memory):** `shm_open()`, `mmap()`, and process-shared `sem_t` synchronization with dynamic work stealing.
- **100% Metric Equivalence & Validation**:
  All three modes compute total bytes, lines, words, and a 32-bit djb2 checksum hash across 2,500 dataset files. Bit-for-bit checksum equality mathematically validates multi-process correctness.
- **Interactive CPU Scheduling Simulator**:
  Models discrete-event execution for **FCFS**, **Non-preemptive Priority**, and **Preemptive Round Robin**. Renders dynamic Gantt charts with CPU idle blocks, Completion Time, Turnaround Time, Waiting Time, and Response Time calculations.
- **AI/NLP Telemetry Analyzer**:
  Pure Python 3 standard library module extracting sentiment polarity, complaint clusters, latency percentiles (Mean, Median, P95, P99), and corpus TF-IDF keywords.
- **Restrained Academic Web Dashboard**:
  Clean, professional HTML5/CSS3/Vanilla JS UI connecting to an Express.js backend on **port 3001**.

---

## Technology Stack

- **C (C11, GCC, POSIX, -pthread -lrt):** Core processing engine, IPC, memory mapping, semaphores.
- **Node.js & Express:** Backend REST API, safe child-process execution via `execFile()`.
- **HTML5, CSS3, Vanilla JavaScript:** Interactive academic dashboard.
- **Python 3:** Synthetic reproducible dataset generation and AI telemetry analytics.
- **WSL2 Ubuntu:** Linux execution environment.

---

## Quick Start (WSL2 Ubuntu)

Run the following commands from the project root:

```bash
# 1. Verify system environment & toolchain
bash scripts/check_environment.sh

# 2. Install backend dependencies
npm install

# 3. Generate synthetic benchmark datasets (2,500 files)
python3 scripts/generate_datasets.py --full

# 4. Compile the C processing engine
make clean
make

# 5. Run automated test suites
npm test                # CPU scheduling simulation unit tests
npm run test:engine     # C engine integration and cross-mode consistency tests
npm run test:results    # JSON schema and reproducibility validation tests

# 6. Start the dashboard application
npm start
```

Open your browser in Windows:
```text
http://localhost:3001
```

---

## Repository Structure

```text
├── README.md                      # Project overview and quick start
├── COMPLETE_PROJECT_GUIDE.md      # Comprehensive evaluation and setup manual
├── Makefile                       # C engine build instructions
├── package.json                   # Node.js dependencies and npm scripts
├── .gitignore                     # Git exclusions
├── engine/                        # C File Processing Engine
│   ├── main.c                     # Engine CLI entry point
│   ├── common.h                   # Common structs, prototypes, IPC messages
│   ├── file_processor.c           # Core byte, line, word, djb2 checksum logic
│   ├── sequential.c               # Mode A: Sequential baseline
│   ├── parallel_pipes.c           # Mode B: UNIX Pipes with poll()
│   ├── parallel_shm.c             # Mode C: POSIX shm_open(), mmap(), sem_t
│   └── process_utils.c            # Monotonic timing, directory scanning, JSON
├── ai/                            # Lightweight AI/NLP Analyzer
│   ├── analyzer.py                # Sentiment, latency stats, TF-IDF keywords
│   ├── requirements.txt           # Standard library specification
│   └── README.md                  # Methodologies and limitations
├── datasets/                      # 2,500 Reproducible Text Files
│   ├── reviews/                   # 1,000 customer review text files
│   ├── logs/                      # 1,000 server log telemetry files
│   └── briefings/                 # 500 executive technical briefing files
├── scripts/
│   ├── generate_datasets.py       # Seeded synthetic dataset generator
│   └── check_environment.sh       # Environment readiness verification
├── results/                       # Generated execution telemetry and benchmarks
│   └── .gitkeep
├── web/                           # Frontend Dashboard (Port 3001)
│   ├── index.html                 # Semantic HTML structure
│   ├── styles.css                 # Clean academic styling
│   ├── scheduler.js               # CPU scheduling algorithm engine
│   └── app.js                     # REST API client and event handlers
├── server.js                      # Express API server & process supervisor
├── tests/                         # Automated Verification Suite
│   ├── test_engine.sh             # Cross-mode metric consistency tests
│   ├── test_results.py            # JSON schema validation tests
│   └── test_scheduling.js         # Unit tests for scheduling algorithms
└── docs/                          # Academic Documentation
    ├── architecture.md            # System architecture and data flow
    ├── ipc_design.md              # UNIX Pipes vs Shared Memory specifications
    ├── scheduling_algorithms.md   # Mathematical formulations & Gantt charts
    ├── benchmark_methodology.md   # Monotonic clock, speedup, and Amdahl's Law
    └── viva_questions.md          # 15+ viva voce questions and model answers
```

---

## Verification Test Results

| Test Suite | Purpose | Status |
| :--- | :--- | :--- |
| `scripts/check_environment.sh` | Validates GCC, Make, Python3, Node, `/dev/shm` | **PASSED** |
| `tests/test_engine.sh` | Validates Sequential, Pipes, and Shared Memory metric consistency | **PASSED (100% OK)** |
| `tests/test_scheduling.js` | 31 unit tests validating FCFS, Priority, Round Robin, idle periods | **31/31 PASSED** |
| `tests/test_results.py` | 43 tests validating JSON schemas and reproducibility | **43/43 PASSED** |

---

## Academic Documentation Links

- [Complete Project Guide & Evaluation Manual](file:///c:/Users/MANJIRI/Desktop/OS/COMPLETE_PROJECT_GUIDE.md)
- [System Architecture](file:///c:/Users/MANJIRI/Desktop/OS/docs/architecture.md)
- [IPC Design: Pipes vs Shared Memory](file:///c:/Users/MANJIRI/Desktop/OS/docs/ipc_design.md)
- [CPU Scheduling Algorithms & Metrics](file:///c:/Users/MANJIRI/Desktop/OS/docs/scheduling_algorithms.md)
- [Benchmark Methodology & Speedup](file:///c:/Users/MANJIRI/Desktop/OS/docs/benchmark_methodology.md)
- [Viva Voce Questions & Answers](file:///c:/Users/MANJIRI/Desktop/OS/docs/viva_questions.md)
