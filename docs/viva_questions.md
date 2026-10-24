# Operating Systems Viva Questions & Model Answers

This guide contains essential oral examination (viva voce) questions with crisp, technically precise answers tailored directly to this project's implementation.

---

### Q1: What happens under the hood when `fork()` is called?
**Answer:** `fork()` creates an exact clone of the calling process (the child). The operating system assigns a new unique Process ID (PID). In modern Linux, memory pages are not immediately duplicated; instead, **Copy-On-Write (COW)** is utilized—both processes share identical physical frames until one attempts a write. The file descriptor table is duplicated, meaning open file descriptors (and pipes) point to the same open file table entries in the kernel. In the parent process, `fork()` returns the child's PID; in the child, it returns `0`.

---

### Q2: What is a zombie process, and how does your engine prevent zombie proliferation?
**Answer:** A zombie process is a process that has completed execution via `exit()`, but still occupies an entry in the process table because its parent has not yet read its exit status.  
**Prevention in this project:** In both `parallel_pipes.c` and `parallel_shm.c`, the parent process explicitly calls `waitpid(worker_pids[i], &status, 0)` for every spawned child process. This harvests the termination status and releases the child's process table entry.

---

### Q3: What is the difference between a zombie process and an orphan process?
**Answer:**
- A **zombie process** is terminated, but its parent has not called `wait()`/`waitpid()`. It consumes no CPU or memory, only a process table slot.
- An **orphan process** is an active process whose parent has terminated before it. The Linux `init` process (or systemd, PID 1) automatically adopts orphan processes and reaps them when they exit.

---

### Q4: How do UNIX pipes work, and what are their limitations?
**Answer:** UNIX pipes are unidirectional byte streams managed in the kernel buffer cache (typically 64 KB in Linux). Data written to the write end (`fd[1]`) is held in the buffer until read from the read end (`fd[0]`).  
*Limitations:* Pipes are unidirectional (half-duplex). If multiple readers or writers are attached without coordination, messages can interleave. Writes exceeding `PIPE_BUF` (4,096 bytes) are not guaranteed to be atomic.

---

### Q5: Why did you use `poll()` instead of standard blocking `read()` in `parallel_pipes.c`?
**Answer:** If the parent performed a blocking `read()` sequentially on worker 0's pipe, it would stall if worker 0 was slow, even if workers 1, 2, and 3 had already completed and filled their pipe buffers. Using `poll()` multiplexes multiple file descriptors simultaneously: the parent wakes up as soon as *any* worker pipe has data ready (`POLLIN`) or closes (`POLLHUP`), avoiding pipeline stalls.

---

### Q6: What is `EINTR` and how is it handled in your C engine?
**Answer:** `EINTR` (Error: Interrupted System Call) occurs when a blocking system call (such as `read()`, `write()`, or `poll()`) is interrupted by the delivery of a signal before any data was transferred. In our implementation, loops inspect `errno == EINTR` and immediately resume the system call rather than treating it as a fatal failure.

---

### Q7: How does POSIX Shared Memory differ from UNIX Pipes?
**Answer:**
- **Pipes:** Require multiple context switches and data copying (Worker Memory $\to$ Kernel Pipe Buffer $\to$ Parent Memory).
- **Shared Memory:** Uses `shm_open()` and `mmap()` to map the identical physical memory frames into the virtual address space of both processes. After setup, data access occurs directly in RAM at memory bus speeds with zero kernel copying.

---

### Q8: What is the purpose of `pshared = 1` in `sem_init()`?
**Answer:** The `pshared` argument in `sem_init(sem_t *sem, int pshared, unsigned int value)` determines the visibility scope of the semaphore:
- `pshared = 0`: Semaphore is shared only between threads of the same process.
- `pshared = 1`: Semaphore is allocated in shared memory and can be accessed across different distinct processes for inter-process synchronization.

---

### Q9: Why is `process_single_file()` called *outside* the semaphore critical section in `parallel_shm.c`?
**Answer:** If `process_single_file()` was called inside `sem_wait()` / `sem_post()`, only one worker could read a file at a time, effectively serializing the workload and destroying parallelism. Instead, workers hold the lock for a fraction of a microsecond only to claim the next file index (`next_file_idx++`), release the lock, process the file concurrently on separate CPU cores, and briefly re-acquire the lock to aggregate totals.

---

### Q10: How do you guarantee that all three modes (Sequential, Pipes, Shared Memory) did identical work?
**Answer:** All three modes process the exact same list of files using the identical function `process_single_file()`. In addition to verifying total file count and byte counts, our engine computes a 32-bit djb2 checksum hash for every single byte processed. When all three modes produce the exact same cumulative checksum (e.g., `0x000000F3BB39E841`), it mathematically verifies that no files were skipped, duplicated, or corrupted.

---

### Q11: Why did you use `CLOCK_MONOTONIC` instead of `gettimeofday()` or `time()`?
**Answer:** `time()` has only 1-second resolution, which is far too coarse. `gettimeofday()` and `CLOCK_REALTIME` measure wall-clock calendar time and are subject to discontinuous jumps from NTP adjustments or manual changes. `CLOCK_MONOTONIC` represents steady uptime tick counts and is guaranteed to never jump backward, providing nanosecond-precision intervals required for valid benchmarking.

---

### Q12: What is the difference between Turnaround Time and Waiting Time?
**Answer:**
- **Turnaround Time ($TAT$):** The total elapsed time between process arrival in the ready queue and its final completion: $TAT = CT - AT$.
- **Waiting Time ($WT$):** The total amount of time the process spent sitting in the ready queue waiting to get CPU time: $WT = TAT - BT$.

---

### Q13: Why is Response Time lower in Round Robin compared to FCFS?
**Answer:** Response Time ($RT$) measures how quickly a process gets the CPU for the first time ($RT = \text{first\_dispatch} - AT$). In FCFS, a short job stuck behind a long job must wait for the entire long burst to finish (convoy effect). In Round Robin, time-slicing preempts the long process after a small quantum $q$, allowing other jobs to get their first CPU dispatch rapidly.

---

### Q14: Explain Amdahl's Law and why $8$ workers do not produce an $8\times$ speedup.
**Answer:** Amdahl's Law states: $S = \frac{1}{(1-p) + \frac{p}{w}}$, where $p$ is the parallel fraction and $w$ is the worker count. Any program contains inherently serial components (directory scanning, process forking, IPC setup, aggregation). Furthermore, real-world factors such as memory bus saturation, virtualized disk I/O contention in WSL2, and CPU context-switch overhead impose physical limits on speedup.

---

### Q15: How does your Node.js backend prevent command injection vulnerabilities?
**Answer:** Rather than executing shell strings with `child_process.exec("cmd " + userInput)`, the backend uses `child_process.execFile()`, which takes an executable binary path and an explicit array of arguments. The arguments are passed directly to the operating system `execve()` system call without invoking a shell interpreter (`/bin/sh`), making shell metacharacter injection impossible.
