/*
 * engine/parallel_shm.c
 *
 * Mode C: Parallel Processing Using POSIX Shared Memory and Semaphores
 * - POSIX shm_open() and mmap()
 * - POSIX process-shared semaphores (sem_init with pshared = 1)
 * - Safe dynamic work dispatch preventing duplicate processing
 * - Robust cleanup on success, error, and signal interruption
 */

#include "common.h"

static char g_active_shm_name[64] = {0};
static bool g_shm_needs_cleanup = false;

static void shm_signal_cleanup(int sig) {
    (void)sig;
    if (g_shm_needs_cleanup && g_active_shm_name[0] != '\0') {
        shm_unlink(g_active_shm_name);
    }
    _exit(128 + sig);
}

int run_parallel_shm(char file_list[][MAX_PATH_LEN], int file_count, int num_workers, const char *dataset_dir, engine_summary_t *summary) {
    if (!summary || !file_list || file_count <= 0) {
        return -1;
    }

    if (num_workers <= 0) {
        num_workers = 4;
    }
    if (num_workers > file_count) {
        num_workers = file_count;
    }

    memset(summary, 0, sizeof(engine_summary_t));
    strncpy(summary->mode, "shared_memory", sizeof(summary->mode) - 1);
    strncpy(summary->dataset_dir, dataset_dir, sizeof(summary->dataset_dir) - 1);
    summary->num_workers = num_workers;
    summary->total_files_discovered = file_count;

    /* Generate unique POSIX shared memory name */
    snprintf(g_active_shm_name, sizeof(g_active_shm_name), "/os_shm_%d_%ld", (int)getpid(), (long)time(NULL));

    /* Create POSIX shared memory segment */
    int shm_fd = shm_open(g_active_shm_name, O_CREAT | O_RDWR | O_EXCL, 0600);
    if (shm_fd < 0) {
        fprintf(stderr, "[SHM Error] shm_open failed: %s\n", strerror(errno));
        return -1;
    }
    g_shm_needs_cleanup = true;

    /* Set segment size */
    if (ftruncate(shm_fd, sizeof(shared_memory_block_t)) != 0) {
        fprintf(stderr, "[SHM Error] ftruncate failed: %s\n", strerror(errno));
        close(shm_fd);
        shm_unlink(g_active_shm_name);
        return -1;
    }

    /* Map shared memory block */
    shared_memory_block_t *shm_block = (shared_memory_block_t *)mmap(
        NULL,
        sizeof(shared_memory_block_t),
        PROT_READ | PROT_WRITE,
        MAP_SHARED,
        shm_fd,
        0
    );

    if (shm_block == MAP_FAILED) {
        fprintf(stderr, "[SHM Error] mmap failed: %s\n", strerror(errno));
        close(shm_fd);
        shm_unlink(g_active_shm_name);
        return -1;
    }

    /* Initialize process-shared mutex semaphore (pshared = 1) */
    if (sem_init(&shm_block->mutex, 1, 1) != 0) {
        fprintf(stderr, "[SHM Error] sem_init failed: %s\n", strerror(errno));
        munmap(shm_block, sizeof(shared_memory_block_t));
        close(shm_fd);
        shm_unlink(g_active_shm_name);
        return -1;
    }

    /* Initialize control variables in shared memory */
    shm_block->next_file_idx = 0;
    shm_block->total_files = (uint32_t)file_count;
    shm_block->files_processed = 0;
    shm_block->files_failed = 0;
    shm_block->total_bytes = 0;
    shm_block->total_lines = 0;
    shm_block->total_words = 0;
    shm_block->total_checksum = 0;
    shm_block->terminate_flag = false;

    /* Register signal handlers for clean shm removal on unexpected abort */
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = shm_signal_cleanup;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    pid_t worker_pids[num_workers];
    double start_time = get_current_time_sec();

    /* Fork worker processes */
    for (int i = 0; i < num_workers; i++) {
        pid_t pid = fork();
        if (pid < 0) {
            fprintf(stderr, "[SHM Error] Failed to fork worker %d: %s\n", i, strerror(errno));
            /* Signal running workers to abort */
            sem_wait(&shm_block->mutex);
            shm_block->terminate_flag = true;
            sem_post(&shm_block->mutex);

            for (int k = 0; k < i; k++) {
                waitpid(worker_pids[k], NULL, 0);
            }
            sem_destroy(&shm_block->mutex);
            munmap(shm_block, sizeof(shared_memory_block_t));
            close(shm_fd);
            shm_unlink(g_active_shm_name);
            return -1;
        }

        if (pid == 0) {
            /* ================= CHILD WORKER PROCESS ================= */
            while (1) {
                uint32_t job_idx = 0;

                /* 1. Acquire job index under semaphore lock */
                if (sem_wait(&shm_block->mutex) != 0) {
                    if (errno == EINTR) continue;
                    break;
                }

                if (shm_block->terminate_flag || shm_block->next_file_idx >= shm_block->total_files) {
                    sem_post(&shm_block->mutex);
                    break; /* All files have been claimed */
                }

                job_idx = shm_block->next_file_idx++;
                sem_post(&shm_block->mutex);

                /* 2. Process file concurrently outside semaphore critical section */
                file_result_t res;
                int ret = process_single_file(file_list[job_idx], &res);

                /* 3. Aggregate results under semaphore lock */
                while (sem_wait(&shm_block->mutex) != 0) {
                    if (errno == EINTR) continue;
                    break;
                }

                if (ret == 0) {
                    shm_block->files_processed++;
                    shm_block->total_bytes += res.bytes_processed;
                    shm_block->total_lines += res.line_count;
                    shm_block->total_words += res.word_count;
                    shm_block->total_checksum += (uint64_t)res.checksum;
                } else {
                    shm_block->files_failed++;
                }

                sem_post(&shm_block->mutex);
            }

            munmap(shm_block, sizeof(shared_memory_block_t));
            close(shm_fd);
            _exit(0);
        } else {
            worker_pids[i] = pid;
        }
    }

    /* ================= PARENT PROCESS ================= */
    /* Reap all child worker processes */
    for (int i = 0; i < num_workers; i++) {
        int status = 0;
        waitpid(worker_pids[i], &status, 0);
    }

    double end_time = get_current_time_sec();
    double elapsed = end_time - start_time;
    if (elapsed < 0.000001) {
        elapsed = 0.000001;
    }

    /* Extract results from shared memory */
    summary->files_processed = shm_block->files_processed;
    summary->files_failed = shm_block->files_failed;
    summary->total_bytes = shm_block->total_bytes;
    summary->total_lines = shm_block->total_lines;
    summary->total_words = shm_block->total_words;
    summary->total_checksum = shm_block->total_checksum;
    summary->elapsed_time_sec = elapsed;
    summary->throughput_fps = (double)summary->files_processed / elapsed;
    summary->throughput_mbps = ((double)summary->total_bytes / (1024.0 * 1024.0)) / elapsed;

    /* Clean up synchronization primitives and shared memory segment */
    sem_destroy(&shm_block->mutex);
    munmap(shm_block, sizeof(shared_memory_block_t));
    close(shm_fd);
    shm_unlink(g_active_shm_name);
    g_shm_needs_cleanup = false;

    return 0;
}
