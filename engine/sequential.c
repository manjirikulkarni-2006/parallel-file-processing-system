/*
 * engine/sequential.c
 *
 * Mode A: Sequential Processing
 * Processes files sequentially within a single OS process.
 * Serves as the golden baseline for timing and speedup comparisons.
 */

#include "common.h"

int run_sequential(char file_list[][MAX_PATH_LEN], int file_count, const char *dataset_dir, engine_summary_t *summary) {
    if (!summary || !file_list) {
        return -1;
    }

    memset(summary, 0, sizeof(engine_summary_t));
    strncpy(summary->mode, "sequential", sizeof(summary->mode) - 1);
    strncpy(summary->dataset_dir, dataset_dir, sizeof(summary->dataset_dir) - 1);
    summary->num_workers = 1;
    summary->total_files_discovered = file_count;

    double start_time = get_current_time_sec();

    for (int i = 0; i < file_count; i++) {
        file_result_t res;
        int status = process_single_file(file_list[i], &res);

        if (status == 0) {
            summary->files_processed++;
            summary->total_bytes += res.bytes_processed;
            summary->total_lines += res.line_count;
            summary->total_words += res.word_count;
            summary->total_checksum += (uint64_t)res.checksum;
        } else {
            summary->files_failed++;
            fprintf(stderr, "[Sequential Warning] Failed processing file: %s (errno: %d)\n",
                    file_list[i], res.error_code);
        }
    }

    double end_time = get_current_time_sec();
    double elapsed = end_time - start_time;
    if (elapsed < 0.000001) {
        elapsed = 0.000001; /* Guard against division by zero */
    }

    summary->elapsed_time_sec = elapsed;
    summary->throughput_fps = (double)summary->files_processed / elapsed;
    summary->throughput_mbps = ((double)summary->total_bytes / (1024.0 * 1024.0)) / elapsed;

    return 0;
}
