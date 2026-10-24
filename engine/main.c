/*
 * engine/main.c
 *
 * CLI Entry point for the Parallel File Processing Engine.
 * Supports:
 *   --mode [sequential|pipes|shared_memory]
 *   --dir <dataset_directory>
 *   --workers <worker_count>
 *   --output <output_json_path>
 *   --json
 */

#include "common.h"

static char g_file_list[MAX_FILES][MAX_PATH_LEN];

static void print_usage(const char *prog_name) {
    fprintf(stderr, "Usage: %s --mode <sequential|pipes|shared_memory> --dir <dataset_path> [options]\n", prog_name);
    fprintf(stderr, "\nRequired Options:\n");
    fprintf(stderr, "  --mode <mode>      Processing mode: 'sequential', 'pipes', or 'shared_memory'\n");
    fprintf(stderr, "  --dir <path>       Directory containing dataset files\n");
    fprintf(stderr, "\nOptional Options:\n");
    fprintf(stderr, "  --workers <count>  Number of parallel workers (default: 4 or system cores)\n");
    fprintf(stderr, "  --output <path>    Write output JSON metrics to specified file path\n");
    fprintf(stderr, "  --json             Print only raw JSON output to stdout\n");
    fprintf(stderr, "  --help             Display this help message and exit\n");
}

int main(int argc, char *argv[]) {
    char mode[32] = "sequential";
    char dataset_dir[MAX_PATH_LEN] = "";
    char output_file[MAX_PATH_LEN] = "";
    int num_workers = (int)sysconf(_SC_NPROCESSORS_ONLN);
    if (num_workers <= 0) {
        num_workers = 4;
    }
    bool json_only = false;

    /* Parse command-line flags */
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--mode") == 0 && i + 1 < argc) {
            strncpy(mode, argv[++i], sizeof(mode) - 1);
        } else if (strcmp(argv[i], "--dir") == 0 && i + 1 < argc) {
            strncpy(dataset_dir, argv[++i], sizeof(dataset_dir) - 1);
        } else if (strcmp(argv[i], "--workers") == 0 && i + 1 < argc) {
            num_workers = atoi(argv[++i]);
            if (num_workers <= 0) num_workers = 1;
        } else if (strcmp(argv[i], "--output") == 0 && i + 1 < argc) {
            strncpy(output_file, argv[++i], sizeof(output_file) - 1);
        } else if (strcmp(argv[i], "--json") == 0) {
            json_only = true;
        } else if (strcmp(argv[i], "--help") == 0 || strcmp(argv[i], "-h") == 0) {
            print_usage(argv[0]);
            return 0;
        } else {
            fprintf(stderr, "[Engine Warning] Unrecognized option: %s\n", argv[i]);
        }
    }

    if (strlen(dataset_dir) == 0) {
        fprintf(stderr, "[Engine Error] Missing mandatory argument: --dir <path>\n\n");
        print_usage(argv[0]);
        return 1;
    }

    /* Standardize mode strings */
    if (strcmp(mode, "seq") == 0) strncpy(mode, "sequential", sizeof(mode) - 1);
    if (strcmp(mode, "pipe") == 0) strncpy(mode, "pipes", sizeof(mode) - 1);
    if (strcmp(mode, "shm") == 0) strncpy(mode, "shared_memory", sizeof(mode) - 1);

    if (strcmp(mode, "sequential") != 0 &&
        strcmp(mode, "pipes") != 0 &&
        strcmp(mode, "shared_memory") != 0) {
        fprintf(stderr, "[Engine Error] Invalid mode '%s'. Must be 'sequential', 'pipes', or 'shared_memory'.\n", mode);
        return 1;
    }

    /* Scan directory */
    int file_count = scan_directory_files(dataset_dir, g_file_list, MAX_FILES);
    if (file_count < 0) {
        fprintf(stderr, "[Engine Error] Failed to scan dataset directory: %s\n", dataset_dir);
        return 1;
    }
    if (file_count == 0) {
        fprintf(stderr, "[Engine Error] No readable regular files found in: %s\n", dataset_dir);
        return 1;
    }

    engine_summary_t summary;
    int run_status = -1;

    if (strcmp(mode, "sequential") == 0) {
        run_status = run_sequential(g_file_list, file_count, dataset_dir, &summary);
    } else if (strcmp(mode, "pipes") == 0) {
        run_status = run_parallel_pipes(g_file_list, file_count, num_workers, dataset_dir, &summary);
    } else if (strcmp(mode, "shared_memory") == 0) {
        run_status = run_parallel_shm(g_file_list, file_count, num_workers, dataset_dir, &summary);
    }

    if (run_status != 0) {
        fprintf(stderr, "[Engine Error] Engine execution failed for mode '%s'\n", mode);
        return 1;
    }

    /* Output reporting */
    if (strlen(output_file) > 0) {
        write_summary_json(&summary, output_file);
    }

    if (json_only) {
        if (strlen(output_file) == 0) {
            write_summary_json(&summary, "-");
        }
    } else {
        print_summary_text(&summary);
    }

    return 0;
}
