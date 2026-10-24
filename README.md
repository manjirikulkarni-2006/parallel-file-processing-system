# Parallel File Processing System with CPU Scheduling and AI Insights

An Operating Systems course project demonstrating **process creation (`fork()`)**, **inter-process communication using UNIX Pipes and POSIX Shared Memory**, **process synchronization with POSIX Semaphores**, **benchmarking**, **CPU scheduling algorithms**, and **lightweight AI/NLP telemetry analysis**.

Designed to run on **Windows 10/11 using WSL2 with Ubuntu**.

## Key Features

- **Sequential Processing:** A single-process baseline for comparing results.
- **Parallel Processing with UNIX Pipes:** Uses `fork()`, pipes, and `poll()` to coordinate worker processes.
- **Parallel Processing with POSIX Shared Memory:** Uses `shm_open()`, `mmap()`, and POSIX semaphores for shared-memory coordination.
- **Metric Validation:** Compares total bytes, lines, words, and 32-bit djb2 checksums across processing modes.
- **CPU Scheduling Simulator:** Models FCFS, non-preemptive Priority, and Round Robin scheduling. Displays Gantt charts and calculates completion, turnaround, waiting, and response times.
- **AI/NLP Telemetry Analysis:** Extracts lightweight sentiment indicators, complaint-related terms, latency statistics, and TF-IDF keywords using Python.
- **Web Dashboard:** Provides an interactive interface through an Express.js backend and a browser-based frontend.

## Technology Stack

- **C11 and POSIX:** File processing, process management, inter-process communication, and synchronization.
- **Node.js and Express:** Backend API and process execution.
- **HTML, CSS, and JavaScript:** Dashboard interface and scheduling simulator.
- **Python 3:** Dataset generation and telemetry analysis.
- **WSL2 with Ubuntu:** Runtime environment on Windows.

## Prerequisites

Install or enable the following:

- Windows 10/11 with WSL2 enabled.
- Ubuntu installed in WSL2.
- GCC or a compatible C compiler.
- GNU Make.
- Python 3.
- Node.js and npm.

Open your **Ubuntu terminal**, not PowerShell, for the following setup commands.

## Quick Start

Run each command from the project root inside WSL2 Ubuntu.

### 1. Open the project directory

Navigate to the directory containing `README.md`, `Makefile`, and `package.json`.

If the project is stored at `C:\Users\MANJIRI\Desktop\OS_cp\OS`, run:

```bash
cd "/mnt/c/Users/MANJIRI/Desktop/OS_cp/OS"
```

If you cloned the repository into a different directory, use that directory instead.

### 2. Check the environment

```bash
bash scripts/check_environment.sh
```

Resolve any missing prerequisites reported by the script before continuing.

### 3. Install Node.js dependencies

```bash
npm install
```

### 4. Generate the datasets

```bash
python3 scripts/generate_datasets.py --full
```

This command is intended to generate the full synthetic dataset collection of 2,500 text files:

- 1,000 customer reviews
- 1,000 server logs
- 500 executive briefings

### 5. Compile the C engine

```bash
make clean
make
```

### 6. Run the automated tests

```bash
npm test
npm run test:engine
npm run test:results
```

Review the output of each test command. Do not assume a test passed if it reports an error.

### 7. Start the dashboard

```bash
npm start
```

Open this address in your Windows browser:

**http://localhost:3001**

Keep the Ubuntu terminal open while using the dashboard. Press `Ctrl+C` in the terminal to stop the server.

## Repository Structure

```text
.
├── README.md
├── COMPLETE_PROJECT_GUIDE.md
├── Makefile
├── package.json
├── package-lock.json
├── .gitignore
├── engine/
│   ├── main.c
│   ├── common.h
│   ├── file_processor.c
│   ├── sequential.c
│   ├── parallel_pipes.c
│   ├── parallel_shm.c
│   └── process_utils.c
├── ai/
│   ├── analyzer.py
│   ├── requirements.txt
│   └── README.md
├── datasets/
│   ├── reviews/
│   ├── logs/
│   └── briefings/
├── scripts/
│   ├── generate_datasets.py
│   └── check_environment.sh
├── results/
├── web/
│   ├── index.html
│   ├── styles.css
│   ├── scheduler.js
│   └── app.js
├── server.js
├── tests/
│   ├── test_engine.sh
│   ├── test_results.py
│   └── test_scheduling.js
└── docs/
    ├── architecture.md
    ├── ipc_design.md
    ├── scheduling_algorithms.md
    ├── benchmark_methodology.md
    └── viva_questions.md
```

## Verification

The project includes automated checks for:

| Test command | Purpose |
|---|---|
| `bash scripts/check_environment.sh` | Checks required development tools and environment |
| `npm test` | Runs the test suite configured as the default npm test command |
| `npm run test:engine` | Checks C engine behavior and cross-mode consistency |
| `npm run test:results` | Checks generated result data and schema validity |

Run the tests on your current checkout and use their actual output to report the results. Benchmark timings may vary with hardware, system load, and WSL2 configuration.

## Notes

- Run the C engine in WSL2 Ubuntu because it relies on POSIX APIs that are not natively available in standard Windows PowerShell.
- Generate the datasets before running benchmarks if they are not already present.
- Generated result files and benchmark timings may differ between runs.
- The AI/NLP module provides lightweight text analytics; it should not be described as a trained machine-learning model unless a trained model is actually used.
- For detailed design, implementation, and viva preparation, see `COMPLETE_PROJECT_GUIDE.md` and the files in `docs/`.
