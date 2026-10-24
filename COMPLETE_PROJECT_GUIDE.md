# Complete Project Guide & Evaluation Manual

**Project Name:** Parallel File Processing System with CPU Scheduling and AI Insights  
**Operating Systems Laboratory Final Project**  
**Execution Environment:** Windows 10/11 using WSL2 Ubuntu

---

## 1. Quick Start Guide (WSL2 Ubuntu)

Open your WSL2 Ubuntu terminal, navigate to the project directory, and execute the following commands in order:

```bash
# Step 1: Verify toolchain and environment readiness
bash scripts/check_environment.sh

# Step 2: Install Node.js dependencies (express, cors)
npm install

# Step 3: Generate synthetic datasets (Full: 2,500 files or Small: 125 files)
python3 scripts/generate_datasets.py --full

# Step 4: Build the high-performance C processing engine
make clean
make

# Step 5: Execute automated verification test suites
bash tests/test_engine.sh
python3 tests/test_results.py
node tests/test_scheduling.js

# Step 6: Start the Express backend server
npm start
```

### Accessing the Dashboard from Windows
Once the server starts on port `3001`, open any Windows web browser (Chrome, Edge, Firefox) and navigate to:
```text
http://localhost:3001
```
*(Alternative if localhost loopback is disabled: `http://127.0.0.1:3001`)*

---

## 2. Step-by-Step Demonstration Sequence for Evaluators

Follow this sequence during your laboratory evaluation or project viva:

### Step 1: System Overview & Environment Health
1. Open the dashboard at `http://localhost:3001`.
2. Point out the top header status: **"Backend Online (WSL2 Active)"**.
3. Point out the **Overview** metrics cards:
   - Customer Reviews: 1,000 files
   - Server Log Streams: 1,000 files
   - Executive Briefings: 500 files
   - Platform & Logical Core count detected dynamically from the host machine.

### Step 2: Live File Processing Demonstration
1. Click **File Processing** on the sidebar.
2. Select **Executive Briefings** as the target dataset.
3. Select **Mode B: Parallel with UNIX Pipes** with **4 Workers**.
4. Click **Execute Engine**.
5. Observe the live metrics card displaying:
   - Files processed (500/500).
   - Total bytes read (~1.12 MB).
   - Cumulative 32-bit checksum hash.
   - Elapsed wall-clock time (~0.4s) and throughput (~1,100+ files/sec).
   - Raw JSON response generated directly by `./engine/bin/engine`.

### Step 3: Empirical Multi-Mode Benchmark Comparison
1. Click **Benchmark Suite** on the sidebar.
2. Choose **Customer Reviews (1,000 files)** with **4 Workers**.
3. Click **Run Full Benchmark**.
4. The system runs:
   - Mode A (Sequential Baseline, 1 worker).
   - Mode B (UNIX Pipes, 4 workers).
   - Mode C (POSIX Shared Memory & Semaphores, 4 workers).
5. Highlight the **Validation Passed Banner**:
   - Emphasize that all three modes generated **100% bit-identical cumulative checksums and total byte counts**.
   - Show the speedup multipliers ($3\times$ to $5\times$ faster than sequential).
   - Review the bar charts illustrating Wall-Clock Time reduction and Throughput scaling.

### Step 4: CPU Scheduling Simulator Walkthrough
1. Click **CPU Scheduling** on the sidebar.
2. Point out the academic simulation notice: *Models discrete-event CPU scheduling without altering kernel CFS*.
3. Click **Scenario 1: Round Robin Preemption**:
   - Shows 4 processes with varying arrival and burst times; Time Quantum = 2.
   - Click **Run Scheduling Simulation**.
   - Review the interactive **Gantt Chart** showing preemptive time slicing and PID color markers.
   - Review the computed metrics: Average Turnaround Time (TAT), Waiting Time (WT), Response Time (RT), and CPU Utilization.
4. Click **Scenario 3: FCFS with CPU Idle Interval**:
   - Demonstrates CPU idle block from $t=4$ to $t=8$ visually rendered with hatched pattern.

### Step 5: AI & NLP Insights
1. Click **AI Insights** on the sidebar.
2. Select **Server Logs** and click **Generate AI Insights**:
   - Displays severity tallies (INFO, WARNING, ERROR, CRITICAL).
   - Displays latency parametric statistics: Mean, Median, P95, and P99 computed from real `latency_ms=XX` values.
   - Displays clustered regex error signatures.
3. Switch to **Customer Product Reviews** and click **Generate AI Insights**:
   - Shows sentiment distribution (Positive, Neutral, Negative percentages).
   - Shows top keyword pills and unsupervised complaint clusters.

---

## 3. Project Architecture & File Manifest

```text
OS_CP_Final/
├── README.md                      # Quick overview, build commands, and features
├── COMPLETE_PROJECT_GUIDE.md      # This evaluation and setup manual
├── Makefile                       # C engine build configuration
├── package.json                   # Node.js project configuration and scripts
├── .gitignore                     # Git exclusions
├── engine/
│   ├── main.c                     # Engine CLI entry point and argument parsing
│   ├── common.h                   # Data structures, message packets, prototypes
│   ├── file_processor.c           # Core byte, line, word, djb2 checksum worker
│   ├── sequential.c               # Mode A: Single-process baseline
│   ├── parallel_pipes.c           # Mode B: Multi-process pipes with poll()
│   ├── parallel_shm.c             # Mode C: POSIX shm_open(), mmap(), sem_t
│   └── process_utils.c            # Monotonic timing, directory scanning, JSON
├── ai/
│   ├── analyzer.py                # Pure Python NLP analyzer
│   ├── requirements.txt           # Standard library specification
│   └── README.md                  # AI module methodology and limitations
├── datasets/
│   ├── reviews/                   # 1,000 customer review text files
│   ├── logs/                      # 1,000 server log telemetry files
│   └── briefings/                 # 500 executive technical briefing files
├── scripts/
│   ├── generate_datasets.py       # Reproducible synthetic dataset generator
│   └── check_environment.sh       # Toolchain verification script
├── results/
│   └── .gitkeep                   # Benchmark and run telemetry cache
├── web/
│   ├── index.html                 # Single-page dashboard HTML5 structure
│   ├── styles.css                 # Clean academic CSS styling
│   ├── scheduler.js               # Dual-environment CPU scheduling engine
│   └── app.js                     # Frontend event handlers and REST client
├── server.js                      # Express.js REST API and process supervisor
├── tests/
│   ├── test_engine.sh             # Engine integration & count equivalence test
│   ├── test_results.py            # JSON schema validation and reproducibility test
│   └── test_scheduling.js         # Unit tests for scheduling algorithms
└── docs/
    ├── architecture.md            # High-level architecture and component layout
    ├── ipc_design.md              # Detailed pipes & shared memory specifications
    ├── scheduling_algorithms.md   # Mathematical formulations of scheduling metrics
    ├── benchmark_methodology.md   # Monotonic clock, speedup, and Amdahl's Law
    └── viva_questions.md          # 15+ viva voce questions with model answers
```

---

## 4. Troubleshooting & FAQ

### Port 3001 Already in Use
If port 3001 is occupied, launch the server on an alternate port:
```bash
PORT=3050 npm start
```

### Shared Memory Segment Leak
If an unexpected kill occurs during debugging and shared memory persists:
```bash
ls -l /dev/shm
rm -f /dev/shm/os_shm_*
```
*(Our engine automatically installs signal handlers for SIGINT/SIGTERM to prevent this)*.

### Rebuilding from Scratch
```bash
make clean
make
```
