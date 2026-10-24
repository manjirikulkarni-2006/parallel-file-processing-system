/*
 * engine/process_utils.c
 *
 * System utilities for the processing engine:
 * - High-resolution monotonic timing
 * - Directory scanning and deterministic sorting
 * - Text and JSON summary reporting
 */

#include "common.h"

double get_current_time_sec(void) {
    struct timespec ts;
    if (clock_gettime(CLOCK_MONOTONIC, &ts) != 0) {
        return 0.0;
    }
    return (double)ts.tv_sec + ((double)ts.tv_nsec / 1e9);
}

static int compare_strings(const void *a, const void *b) {
    return strcmp((const char *)a, (const char *)b);
}

int scan_directory_files(const char *dirpath, char file_list[][MAX_PATH_LEN], int max_files) {
    if (!dirpath || !file_list || max_files <= 0) {
        return -1;
    }

    DIR *dir = opendir(dirpath);
    if (!dir) {
        fprintf(stderr, "[Engine Error] Cannot open directory: %s (%s)\n", dirpath, strerror(errno));
        return -1;
    }

    struct dirent *entry;
    int count = 0;

    while ((entry = readdir(dir)) != NULL) {
        if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
            continue;
        }

        char fullpath[MAX_PATH_LEN];
        snprintf(fullpath, sizeof(fullpath), "%s/%s", dirpath, entry->d_name);

        struct stat st;
        if (stat(fullpath, &st) == 0 && S_ISREG(st.st_mode)) {
            if (count < max_files) {
                snprintf(file_list[count], MAX_PATH_LEN, "%s", fullpath);
                count++;
            } else {
                fprintf(stderr, "[Engine Warning] Max files threshold (%d) reached. Truncating scan.\n", max_files);
                break;
            }
        }
    }

    closedir(dir);

    /* Sort deterministically for reproducible runs across modes */
    if (count > 1) {
        qsort(file_list, count, MAX_PATH_LEN, compare_strings);
    }

    return count;
}

void print_summary_text(const engine_summary_t *summary) {
    if (!summary) return;

    printf("\n============================================================\n");
    printf("   PARALLEL FILE PROCESSING ENGINE - EXECUTION SUMMARY      \n");
    printf("============================================================\n");
    printf(" Mode:                   %s\n", summary->mode);
    printf(" Dataset Directory:      %s\n", summary->dataset_dir);
    printf(" Configured Workers:     %d\n", summary->num_workers);
    printf(" Total Files Discovered: %lu\n", (unsigned long)summary->total_files_discovered);
    printf(" Files Processed (OK):   %lu\n", (unsigned long)summary->files_processed);
    printf(" Files Failed (Error):   %lu\n", (unsigned long)summary->files_failed);
    printf(" Total Bytes:            %lu (%.2f MB)\n", 
           (unsigned long)summary->total_bytes, (double)summary->total_bytes / (1024.0 * 1024.0));
    printf(" Total Lines:            %lu\n", (unsigned long)summary->total_lines);
    printf(" Total Words:            %lu\n", (unsigned long)summary->total_words);
    printf(" Cumulative Checksum:    0x%016llX\n", (unsigned long long)summary->total_checksum);
    printf(" Elapsed Wall-Clock:     %.4f seconds\n", summary->elapsed_time_sec);
    printf(" Throughput (Files/sec): %.2f fps\n", summary->throughput_fps);
    printf(" Throughput (Data/sec):  %.2f MB/sec\n", summary->throughput_mbps);
    printf("============================================================\n\n");
}

void write_summary_json(const engine_summary_t *summary, const char *output_file) {
    if (!summary) return;

    FILE *out = stdout;
    bool should_close = false;

    if (output_file && strcmp(output_file, "-") != 0) {
        out = fopen(output_file, "w");
        if (!out) {
            fprintf(stderr, "[Engine Warning] Cannot open '%s' for writing JSON: %s. Using stdout.\n",
                    output_file, strerror(errno));
            out = stdout;
        } else {
            should_close = true;
        }
    }

    fprintf(out, "{\n");
    fprintf(out, "  \"success\": true,\n");
    fprintf(out, "  \"mode\": \"%s\",\n", summary->mode);
    fprintf(out, "  \"dataset_dir\": \"%s\",\n", summary->dataset_dir);
    fprintf(out, "  \"num_workers\": %d,\n", summary->num_workers);
    fprintf(out, "  \"total_files_discovered\": %lu,\n", (unsigned long)summary->total_files_discovered);
    fprintf(out, "  \"files_processed\": %lu,\n", (unsigned long)summary->files_processed);
    fprintf(out, "  \"files_failed\": %lu,\n", (unsigned long)summary->files_failed);
    fprintf(out, "  \"total_bytes\": %lu,\n", (unsigned long)summary->total_bytes);
    fprintf(out, "  \"total_lines\": %lu,\n", (unsigned long)summary->total_lines);
    fprintf(out, "  \"total_words\": %lu,\n", (unsigned long)summary->total_words);
    fprintf(out, "  \"total_checksum\": \"%016llX\",\n", (unsigned long long)summary->total_checksum);
    fprintf(out, "  \"elapsed_time_sec\": %.6f,\n", summary->elapsed_time_sec);
    fprintf(out, "  \"throughput_fps\": %.2f,\n", summary->throughput_fps);
    fprintf(out, "  \"throughput_mbps\": %.4f\n", summary->throughput_mbps);
    fprintf(out, "}\n");

    if (should_close) {
        fclose(out);
    }
}
