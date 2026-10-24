#!/usr/bin/env python3
"""
scripts/generate_datasets.py
Synthetic Dataset Generator for Operating Systems Course Project:
"Parallel File Processing System with CPU Scheduling and AI Insights"

Generates:
  - Customer Reviews (positive, neutral, negative reviews with sentiment tags)
  - Server Logs (INFO, WARNING, ERROR, CRITICAL records with latency_ms and anomaly patterns)
  - Executive Briefings (structured executive summaries, risks, observations, recommendations)

Modes:
  --small: 50 reviews, 50 logs, 25 briefings (fast testing)
  --full:  1,000 reviews, 1,000 logs, 500 briefings (full academic benchmark)
"""

import os
import sys
import argparse
import random
import datetime
import shutil

# Fixed random seed ensures reproducible generation across runs
DEFAULT_SEED = 42

PRODUCTS = [
    ("HyperDrive Pro SSD", "Storage"),
    ("AeroBook Slim 15", "Laptops"),
    ("NovaCore Octa-CPU", "Processors"),
    ("TitanSound ANC Headphones", "Audio"),
    ("QuantumRouter AX6000", "Networking"),
    ("VividPixel 4K Monitor", "Displays"),
    ("ErgoGlide Mechanical Keyboard", "Peripherals"),
    ("PulseTrack Smartwatch 3", "Wearables"),
]

POSITIVE_TEMPLATES = [
    "The build quality of the {product} exceeded all expectations. Exceptional performance and sustained read/write speeds during heavy workflows.",
    "Outstanding product! Battery longevity is phenomenal, lasting over two full work days under standard multitasking loads.",
    "Very impressed with the responsiveness and crisp design. Customer support was also helpful when asking about firmware upgrades.",
    "Tremendous value for money. Benchmark speeds matched the advertised manufacturer rates within a 2% margin. Highly recommended.",
    "Setup took less than five minutes. Integration with existing Linux workstations was seamless with zero driver friction.",
]

NEUTRAL_TEMPLATES = [
    "The {product} is decent for everyday usage, but lacks some advanced configuration toggles expected in this price bracket.",
    "Average performance. It operates reliably under light loads, though thermal throttling becomes noticeable during prolonged compilation tasks.",
    "Acceptable hardware aesthetics and good packaging. However, the accompanying documentation is sparse and lacks troubleshooting depth.",
    "Meets basic requirements without standing out. Software utility feels slightly unpolished, though the hardware itself is functional.",
    "Shipping was delayed by three days. Once unboxed, the device worked as specified, but nothing exceptionally standout.",
]

NEGATIVE_TEMPLATES = [
    "Extremely disappointed with the {product}. Frequent thermal spikes and unexpected system freezes during moderate multitasking.",
    "Unit failed after three weeks of standard desktop use. Customer service was slow to respond and refused replacement under warranty.",
    "Significant quality control defects. High acoustic coil whine and persistent latency drops during basic file I/O operations.",
    "Firmware updates repeatedly failed, corrupting custom configuration profiles. Subpar build materials prone to scratches.",
    "Overpriced and underperforming. I encountered multiple kernel panic traces upon cold boot when paired with standard PCIe peripherals.",
]

SERVICES = ["api-gateway", "auth-service", "worker-pool", "db-cluster", "file-storage", "billing-svc", "cache-redis"]

LOG_MESSAGES_INFO = [
    "Incoming HTTP request dispatched to worker handler",
    "Connection acquired from connection pool",
    "Cache lookup returned positive hit for session key",
    "Batch file chunk serialized successfully",
    "Worker heartbeat acknowledged by supervisor",
    "TLS handshake completed with client agent",
    "Scheduled garbage collection sweep finished",
]

LOG_MESSAGES_WARN = [
    "High memory consumption threshold reached (88% utilized)",
    "Slow query execution exceeded expected baseline (query took > 250ms)",
    "Downstream microservice response delayed, retry attempt scheduled",
    "Thread pool saturation index approaching upper boundary",
    "Disk buffer cache pressure elevated during concurrent writes",
]

LOG_MESSAGES_ERROR = [
    "Connection reset by peer while transmitting payload",
    "Failed to write metadata block to distributed store",
    "Worker thread crashed with segmentation violation in foreign library",
    "Deadlock detected in transactional database lock manager; transaction aborted",
    "TLS socket abruptly terminated before payload completion",
]

LOG_MESSAGES_CRITICAL = [
    "Database connection pool completely exhausted; dropping new client requests",
    "Cascading failover triggered on primary cluster node; state recovery active",
    "Authentication burst anomaly: 120 failed auth tokens within 10 seconds from subnet 198.51.100.0/24",
    "File descriptor limit reached for worker process; operating system rejecting socket creation",
]

DIVISIONS = [
    "Cloud Infrastructure & Reliability",
    "Distributed Systems Research",
    "Enterprise Security & Access Control",
    "Global Hardware Operations",
    "Platform Scalability & Performance",
]

TOPICS = [
    ("Operating System Memory Virtualization & Paging", "Memory Management"),
    ("High-Throughput Inter-Process Communication Benchmarks", "IPC Architecture"),
    ("Preemptive CPU Scheduling Policies in Multi-Core Workstations", "CPU Scheduling"),
    ("Resilient Distributed File Storage & Concurrent I/O", "File I/O"),
    ("Zero-Trust Microsegmentation & System Kernel Hardening", "Kernel Security"),
]


def generate_review_content(index: int, rng: random.Random) -> str:
    product, category = rng.choice(PRODUCTS)
    sentiment_roll = rng.random()
    if sentiment_roll < 0.45:
        sentiment = "Positive"
        rating = rng.choice([4, 5])
        body_template = rng.choice(POSITIVE_TEMPLATES)
    elif sentiment_roll < 0.75:
        sentiment = "Neutral"
        rating = 3
        body_template = rng.choice(NEUTRAL_TEMPLATES)
    else:
        sentiment = "Negative"
        rating = rng.choice([1, 2])
        body_template = rng.choice(NEGATIVE_TEMPLATES)

    body = body_template.format(product=product)
    
    # Add extra context to make file processing work realistic and text rich
    extra_details = [
        f"Verified Purchase: Yes. Usage duration: {rng.randint(1, 48)} weeks.",
        f"Key attributes evaluated: build quality, throughput, reliability, ergonomics.",
        f"User feedback note: {'Recommended for engineering workloads.' if rating >= 4 else 'Consider alternatives if demanding high stability.'}",
        f"Diagnostic benchmark checksum ID: REV-{index:05d}-CHK.",
    ]

    return f"""==================================================
CUSTOMER PRODUCT REVIEW RECORD
Review-ID: REV-{index:05d}
Product: {product}
Category: {category}
Rating: {rating}/5 Stars
Sentiment-Tag: {sentiment}
Date: 2026-03-{rng.randint(1, 28):02d}
--------------------------------------------------
Feedback:
{body}

{extra_details[0]}
{extra_details[1]}
{extra_details[2]}
{extra_details[3]}
==================================================
"""


def generate_log_content(index: int, rng: random.Random) -> str:
    lines = []
    base_time = datetime.datetime(2026, 3, 15, rng.randint(0, 23), rng.randint(0, 59), rng.randint(0, 59))
    num_lines = rng.randint(15, 30)

    # In ~15% of files, inject an anomalous pattern (high latency burst or error storm)
    has_anomaly = (rng.random() < 0.15)
    
    for i in range(num_lines):
        record_time = base_time + datetime.timedelta(milliseconds=i * rng.randint(150, 800))
        timestamp_str = record_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        service = rng.choice(SERVICES)
        trace_id = f"trc-{rng.randint(100000, 999999)}"

        if has_anomaly and i >= (num_lines // 2) and i <= (num_lines // 2 + 4):
            # Anomaly sequence: critical error or severe latency spike
            level = "CRITICAL" if rng.random() < 0.5 else "ERROR"
            msg = rng.choice(LOG_MESSAGES_CRITICAL if level == "CRITICAL" else LOG_MESSAGES_ERROR)
            latency = rng.randint(3500, 8500) # Explicit high latency anomaly
        else:
            roll = rng.random()
            if roll < 0.70:
                level = "INFO"
                msg = rng.choice(LOG_MESSAGES_INFO)
                latency = rng.randint(5, 75)
            elif roll < 0.88:
                level = "WARNING"
                msg = rng.choice(LOG_MESSAGES_WARN)
                latency = rng.randint(80, 450)
            else:
                level = "ERROR"
                msg = rng.choice(LOG_MESSAGES_ERROR)
                latency = rng.randint(500, 1500)

        line = f"[{timestamp_str}] [{level:<8}] [{service:<14}] [{trace_id}] {msg} latency_ms={latency}"
        lines.append(line)

    header = f"# SERVER DIAGNOSTIC LOG STREAM - SESSION LOG-{index:05d}\n# Generated: {base_time.isoformat()}\n# Records Count: {len(lines)}\n"
    return header + "\n".join(lines) + "\n"


def generate_briefing_content(index: int, rng: random.Random) -> str:
    topic_title, category = rng.choice(TOPICS)
    division = rng.choice(DIVISIONS)
    status = rng.choice(["On Track", "Under Review", "Requires Executive Intervention", "Optimization Target"])
    budget_delta = rng.choice(["+4.2%", "-1.5%", "+11.0%", "Within 0.5% margin", "-3.2%"])
    throughput_gain = rng.choice(["+28% throughput improvement", "+45% IPC responsiveness", "-18% latency overhead"])

    return f"""================================================================================
EXECUTIVE TECHNICAL BRIEFING
Document Reference: DOC-BRF-{index:04d}
Division: {division}
Thematic Category: {category}
Primary Subject: {topic_title}
Reporting Period: Q1 2026 Fiscal Audit
System Status: {status}
================================================================================

1. EXECUTIVE SUMMARY
Recent engineering evaluations within {division} focused on {topic_title}.
Empirical measurements across benchmark runs demonstrate {throughput_gain}
when transitioning from serial execution models to modern multi-worker paradigms.
Resource allocation variance currently stands at {budget_delta}.

2. OPERATIONAL OBSERVATIONS
- Multi-process worker pools utilizing POSIX pipes demonstrated reliable IPC channel throughput.
- POSIX shared memory buffers minimized kernel context-switch penalties during high-volume transfers.
- Real-time CPU scheduling algorithms (notably Round Robin with tuned quanta) maintained low turnaround delays.
- Process synchronization mechanisms must strictly prevent race conditions and ensure clean semaphore release.

3. RISK FACTORS & SYSTEM VULNERABILITIES
- Zombie process proliferation risk if parent processes fail to reap terminated workers via waitpid().
- Semaphore deadlock risk under abrupt worker termination; sighandler cleanup routines must be bulletproof.
- Memory page swapping overhead if worker allocations exceed physical RAM quotas.

4. STRATEGIC RECOMMENDATIONS & ACTION ITEMS
- Standardize all concurrent data engines on structured POSIX IPC primitives.
- Integrate automated CPU scheduling simulators for predictive capacity planning.
- Deploy continuous AI log telemetry analyzers to capture anomaly spikes before operational disruption.

5. KEY PERFORMANCE TARGETS (KPIS)
- Target System Throughput: >= 1,200 files/sec on standard multi-core hardware.
- Maximum Allowed IPC Round-Trip Latency: <= 4.5 milliseconds.
- Worker Child Reap Success Rate: 100.0% zero orphan leakage.
================================================================================
"""


def generate_datasets(mode: str, seed: int = DEFAULT_SEED, root_dir: str = "."):
    rng = random.Random(seed)

    if mode == "small":
        n_reviews = 50
        n_logs = 50
        n_briefings = 25
    elif mode == "full":
        n_reviews = 1000
        n_logs = 1000
        n_briefings = 500
    else:
        raise ValueError(f"Unknown generation mode: {mode}")

    base_dir = os.path.join(root_dir, "datasets")
    rev_dir = os.path.join(base_dir, "reviews")
    log_dir = os.path.join(base_dir, "logs")
    brf_dir = os.path.join(base_dir, "briefings")

    # Ensure directories exist and are clean
    for d in [rev_dir, log_dir, brf_dir]:
        os.makedirs(d, exist_ok=True)
        # Clean existing generated text files in target dataset folders
        for fname in os.listdir(d):
            if fname.endswith(".txt"):
                os.remove(os.path.join(d, fname))

    print(f"[Dataset Generator] Mode: '{mode}' (Seed: {seed})")
    print(f"[Dataset Generator] Generating {n_reviews} customer reviews in {rev_dir}...")
    for i in range(1, n_reviews + 1):
        content = generate_review_content(i, rng)
        path = os.path.join(rev_dir, f"review_{i:04d}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"[Dataset Generator] Generating {n_logs} server log files in {log_dir}...")
    for i in range(1, n_logs + 1):
        content = generate_log_content(i, rng)
        path = os.path.join(log_dir, f"log_{i:04d}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    print(f"[Dataset Generator] Generating {n_briefings} executive briefings in {brf_dir}...")
    for i in range(1, n_briefings + 1):
        content = generate_briefing_content(i, rng)
        path = os.path.join(brf_dir, f"briefing_{i:04d}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)

    total_files = n_reviews + n_logs + n_briefings
    print(f"\n[Dataset Generator] SUCCESS: Successfully generated {total_files} synthetic files:")
    print(f"  - Customer Reviews:    {n_reviews:4d} files -> {rev_dir}")
    print(f"  - Server Logs:         {n_logs:4d} files -> {log_dir}")
    print(f"  - Executive Briefings: {n_briefings:4d} files -> {brf_dir}")
    print(f"[Note] These datasets are reproducible synthetic data for academic OS benchmarking.")


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic datasets for OS parallel processing project.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--small", action="store_true", help="Generate small test datasets (50 reviews, 50 logs, 25 briefings)")
    group.add_argument("--full", action="store_true", help="Generate full benchmark datasets (1000 reviews, 1000 logs, 500 briefings)")
    parser.add_argument("--seed", type=int, default=DEFAULT_SEED, help="Random generator seed (default: 42)")
    parser.add_argument("--dir", type=str, default=".", help="Project root directory (default: current directory)")

    args = parser.parse_args()
    mode = "small" if args.small else "full"
    generate_datasets(mode, seed=args.seed, root_dir=args.dir)


if __name__ == "__main__":
    main()
