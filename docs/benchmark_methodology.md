# Empirical Benchmark Methodology & Performance Metrics

This document details the benchmarking framework, timing instrumentation, speedup calculations, and validation criteria used to compare the processing modes.

---

## 1. Timing Instrumentation

### A. High-Resolution Monotonic Clock
All runtime measurements in the C engine utilize POSIX `clock_gettime()` with `CLOCK_MONOTONIC`:

```c
double get_current_time_sec(void) {
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec + ((double)ts.tv_nsec / 1e9);
}
```

**Why CLOCK_MONOTONIC is Mandatory:**
1. **Immunity to Time Skew:** Unlike `gettimeofday()` or `CLOCK_REALTIME`, monotonic clocks cannot jump backward or forward due to NTP synchronization, leap seconds, or manual clock adjustments.
2. **Nanosecond Resolution:** Allows accurate sub-millisecond benchmarking even on fast SSD storage.
3. **Wall-Clock Accuracy:** Measures real elapsed time inclusive of process scheduling delays, I/O wait, and IPC context-switch latency.

---

## 2. Key Performance Metrics

### A. Wall-Clock Execution Time ($T$)
Measured from immediately before process spawning / iteration starts to immediately after all worker processes have exited and their descriptors are closed:
$$T = \text{Time}_{\text{end}} - \text{Time}_{\text{start}}$$

*Division-by-Zero Guard:* If $T < 0.000001$ seconds, it is clamped to $10^{-6}$ s.

### B. System Throughput
1. **Files Per Second (FPS):**
   $$\text{Throughput}_{\text{fps}} = \frac{\text{Total Files Processed}}{T}$$
2. **Megabytes Per Second (MB/s):**
   $$\text{Throughput}_{\text{mbps}} = \frac{\text{Total Bytes Processed} / (1024 \times 1024)}{T}$$

### C. Relative Speedup Ratio ($S$)
Speedup is calculated strictly against the Sequential baseline ($T_{\text{seq}}$) operating on the identical dataset:
$$S = \frac{T_{\text{seq}}}{T_{\text{parallel}}}$$

- $S = 1.0$: Baseline performance.
- $S > 1.0$: Positive performance gain due to multi-process parallelization.
- $S < 1.0$: Performance regression (e.g., when process creation and IPC synchronization overhead outweigh the compute load on very small datasets).

---

## 3. Workload Equivalence & Verification Criteria

To ensure legitimate academic benchmarking, all three modes (Sequential, UNIX Pipes, Shared Memory) invoke the identical processing routine: `process_single_file()`.

### Mandatory Validation Checks
A benchmark run is marked valid only if:
1. **File Count Match:**
   $$\text{Files}_{\text{seq}} = \text{Files}_{\text{pipe}} = \text{Files}_{\text{shm}}$$
2. **Byte Count Match:**
   $$\text{Bytes}_{\text{seq}} = \text{Bytes}_{\text{pipe}} = \text{Bytes}_{\text{shm}}$$
3. **Cumulative Checksum Match:**
   $$\text{Checksum}_{\text{seq}} = \text{Checksum}_{\text{pipe}} = \text{Checksum}_{\text{shm}}$$

Every character is hashed into a 32-bit djb2 hash:
$$\text{hash}_{t} = ((\text{hash}_{t-1} \ll 5) + \text{hash}_{t-1}) + c$$

A matching checksum across all three modes mathematically proves that all files were read completely without missed files, dropped pipe bytes, or race conditions.

---

## 4. Theoretical Analysis: Amdahl's Law in Practice

Amdahl's law defines the maximum theoretical speedup $S(w)$ achievable using $w$ parallel workers:
$$S(w) = \frac{1}{(1 - p) + \frac{p}{w}}$$

where $p$ is the parallelizable fraction of the workload ($0 \le p \le 1$), and $(1 - p)$ represents the strictly serial portion (directory scanning, `fork()` invocation, IPC initialization, and `waitpid()` reaping).

### WSL2 Considerations
Under WSL2, file I/O traverses the Linux virtualized page cache and the underlying host file system. While parallel workers achieve substantial speedups (often $3\times$ to $6\times$ on multi-core systems), memory bus bandwidth and virtualized disk I/O contention will naturally bound scalability according to Amdahl's Law.
