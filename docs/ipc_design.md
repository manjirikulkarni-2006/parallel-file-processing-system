# Inter-Process Communication (IPC) Design

This document details the operating system IPC mechanisms implemented in the C processing engine: **UNIX Pipes** and **POSIX Shared Memory with Semaphores**.

---

## 1. Mode B: Parallel Processing Using UNIX Pipes

### A. Architectural Overview
UNIX pipes provide a unidirectional, byte-stream IPC channel managed directly within the Linux kernel buffer cache.

```text
Parent Process (Supervisor)
   │
   ├── pipe(pipe_fds[0]) ────► Worker 0 (PID 101) ───[Process file subset]───► write(msg)
   ├── pipe(pipe_fds[1]) ────► Worker 1 (PID 102) ───[Process file subset]───► write(msg)
   ├── pipe(pipe_fds[2]) ────► Worker 2 (PID 103) ───[Process file subset]───► write(msg)
   └── pipe(pipe_fds[3]) ────► Worker 3 (PID 104) ───[Process file subset]───► write(msg)
   │
   └── poll(pfds, 4, -1) [Multiplexing read channels]
         └── read() packet until EOF (POLLHUP)
         └── waitpid() reaping to eliminate zombies
```

### B. Implementation Details
1. **Creation and Descriptor Hygiene**:
   - For $W$ workers, $W$ distinct pipes are instantiated via `pipe(pipe_fds[i])`.
   - Each worker process closes its read descriptor `pipe_fds[i][0]` immediately upon `fork()`.
   - Crucially, each child process closes any file descriptors inherited from previously forked siblings. This prevents descriptor leaks and ensures proper EOF propagation.
   - The parent process closes the write descriptor `pipe_fds[i][1]` for all workers.

2. **Workload Partitioning**:
   - Files are partitioned using interleaved indexing: Worker $i$ processes files at indices $i, i + W, 2W + i, \dots$
   - This provides automatic load balancing across files of varying byte lengths.

3. **Safe Multi-Process I/O Handling**:
   - **Partial Writes:** Workers execute a loop over `write()` until `sizeof(pipe_message_t)` is fully transferred.
   - **`EINTR` Handling:** If interrupted by a signal, the write/read call automatically resumes.
   - **Multiplexing with `poll()`:** The parent process monitors all $W$ read descriptors simultaneously via `poll()`, reacting to `POLLIN`, `POLLHUP`, and `POLLERR` events without blocking on any single worker.
   - **Zombie Prevention:** The parent reaps every worker using `waitpid(worker_pids[i], &status, 0)` and asserts clean exit codes with `WIFEXITED(status)` and `WEXITSTATUS(status)`.

---

## 2. Mode C: Parallel Processing Using POSIX Shared Memory & Semaphores

### A. Architectural Overview
POSIX Shared Memory maps a common memory page into the virtual address space of distinct processes, eliminating kernel data copying.

```text
                 Virtual Address Space (Worker 1)       Virtual Address Space (Worker 2)
                               \                               /
                                \                             /
                         mmap()  \                           /  mmap()
                                  v                         v
                       +-----------------------------------------------+
                       |           POSIX SHARED MEMORY BLOCK           |
                       |                (/os_shm_XXXX)                 |
                       |-----------------------------------------------|
                       | sem_t mutex (Process-shared semaphore)        |
                       | uint32_t next_file_idx (Dynamic Task Queue)   |
                       | uint64_t files_processed, total_bytes, ...    |
                       +-----------------------------------------------+
```

### B. Synchronization Primitives
1. **Memory Allocation**:
   - Named shared memory block created with `shm_open(name, O_CREAT | O_RDWR | O_EXCL, 0600)`.
   - Sized via `ftruncate(shm_fd, sizeof(shared_memory_block_t))`.
   - Mapped with `mmap(NULL, size, PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0)`.

2. **Process-Shared Semaphore**:
   - Uses an in-memory `sem_t` initialized with `sem_init(&shm_block->mutex, 1, 1)`.
   - Setting `pshared = 1` designates the semaphore for multi-process synchronization.

3. **Dynamic Work-Stealing / Job Dispatch**:
   - To avoid race conditions, workers acquire the mutex lock (`sem_wait`) to read and increment `next_file_idx`.
   - **Critical Optimization:** The file I/O and checksum computation (`process_single_file()`) occur **OUTSIDE** the critical section, ensuring true multi-core parallel computation.
   - Workers re-acquire the lock briefly only to aggregate their accumulated byte, line, word, and checksum totals.

4. **Resource Lifecycle & Signal Safety**:
   - On completion, `sem_destroy()`, `munmap()`, `close()`, and `shm_unlink()` ensure no dangling memory segments remain in `/dev/shm`.
   - Signal handlers for `SIGINT` and `SIGTERM` are registered to unlink the shared memory object if execution is aborted unexpectedly.

---

## 3. Comparison of IPC Mechanisms

| Feature | UNIX Pipes (Mode B) | POSIX Shared Memory (Mode C) |
| :--- | :--- | :--- |
| **Communication Paradigm** | Byte-stream messaging | Direct shared state / memory mapping |
| **Kernel Transitions** | Data copied into and out of kernel pipe buffer | Zero-copy data access after initial mapping |
| **Synchronization** | Implicit via pipe blocking & `poll()` | Explicit via POSIX semaphores (`sem_t`) |
| **Work Scheduling** | Static interleaved partitioning | Dynamic work-stealing job queue |
| **Cleanup Primitives** | Automatic on file descriptor closure | Explicit `shm_unlink()` and `sem_destroy()` |
