/*
 * engine/common.h
 *
 * Common header definitions, data structures, and function prototypes
 * for the Parallel File Processing Engine.
 */

#ifndef COMMON_H
#define COMMON_H

#define _POSIX_C_SOURCE 200809L
#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <fcntl.h>
#include <dirent.h>
#include <time.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/mman.h>
#include <semaphore.h>
#include <poll.h>
#include <signal.h>

#define MAX_PATH_LEN 512
#define MAX_FILES 50000
#define BUFFER_SIZE 16384
#define SHM_NAME_DEFAULT "/os_engine_shm_block"

/* Results structure for an individual file */
typedef struct {
    char filepath[MAX_PATH_LEN];
    uint64_t bytes_processed;
    uint32_t line_count;
    uint32_t word_count;
    uint32_t char_count;
    uint32_t checksum;       /* djb2 hash */
    int error_code;          /* 0 on success, errno on error */
} file_result_t;

/* Summary metrics for an engine processing run */
typedef struct {
    char mode[32];           /* "sequential", "pipes", "shared_memory" */
    char dataset_dir[MAX_PATH_LEN];
    int num_workers;
    uint64_t total_files_discovered;
    uint64_t files_processed;
    uint64_t files_failed;
    uint64_t total_bytes;
    uint64_t total_lines;
    uint64_t total_words;
    uint64_t total_checksum; /* Accumulated 64-bit checksum for validation */
    double elapsed_time_sec;
    double throughput_fps;   /* files per second */
    double throughput_mbps;  /* megabytes per second */
} engine_summary_t;

/* Shared memory IPC layout */
typedef struct {
    sem_t mutex;             /* Mutual exclusion semaphore for job fetching & aggregation */
    uint32_t next_file_idx;  /* Index of next file to be claimed by an idle worker */
    uint32_t total_files;    /* Total number of files to process */
    uint64_t files_processed;
    uint64_t files_failed;
    uint64_t total_bytes;
    uint64_t total_lines;
    uint64_t total_words;
    uint64_t total_checksum;
    bool terminate_flag;     /* Signal for workers to shut down early if error */
} shared_memory_block_t;

/* Pipe IPC message packet */
typedef struct {
    uint32_t worker_id;
    uint32_t files_processed;
    uint32_t files_failed;
    uint64_t bytes_processed;
    uint64_t line_count;
    uint64_t word_count;
    uint64_t checksum_sum;
    int status;              /* 0 for success, non-zero for error */
} pipe_message_t;

/* Function Prototypes */

/* file_processor.c */
int process_single_file(const char *filepath, file_result_t *out_result);

/* process_utils.c */
double get_current_time_sec(void);
int scan_directory_files(const char *dirpath, char file_list[][MAX_PATH_LEN], int max_files);
void print_summary_text(const engine_summary_t *summary);
void write_summary_json(const engine_summary_t *summary, const char *output_file);

/* sequential.c */
int run_sequential(char file_list[][MAX_PATH_LEN], int file_count, const char *dataset_dir, engine_summary_t *summary);

/* parallel_pipes.c */
int run_parallel_pipes(char file_list[][MAX_PATH_LEN], int file_count, int num_workers, const char *dataset_dir, engine_summary_t *summary);

/* parallel_shm.c */
int run_parallel_shm(char file_list[][MAX_PATH_LEN], int file_count, int num_workers, const char *dataset_dir, engine_summary_t *summary);

#endif /* COMMON_H */
