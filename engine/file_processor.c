/*
 * engine/file_processor.c
 *
 * Core file processing logic:
 * Reads a target file in buffered chunks, computing:
 * - Total byte count
 * - Line count
 * - Word count
 * - Character count
 * - 32-bit djb2 checksum hash
 *
 * All three modes (sequential, pipes, shared memory) call this exact
 * routine to ensure 100% equivalent work and consistent verification metrics.
 */

#include "common.h"
#include <ctype.h>

/* djb2 hash initialization constant */
#define DJB2_INIT 5381

int process_single_file(const char *filepath, file_result_t *out_result) {
    if (!filepath || !out_result) {
        return -1;
    }

    memset(out_result, 0, sizeof(file_result_t));
    strncpy(out_result->filepath, filepath, MAX_PATH_LEN - 1);

    FILE *fp = fopen(filepath, "rb");
    if (!fp) {
        out_result->error_code = errno ? errno : EIO;
        return -1;
    }

    unsigned char buffer[BUFFER_SIZE];
    size_t bytes_read = 0;
    uint32_t hash = DJB2_INIT;
    uint64_t total_bytes = 0;
    uint32_t line_count = 0;
    uint32_t word_count = 0;
    uint32_t char_count = 0;
    bool in_word = false;

    while ((bytes_read = fread(buffer, 1, sizeof(buffer), fp)) > 0) {
        total_bytes += bytes_read;

        for (size_t i = 0; i < bytes_read; i++) {
            unsigned char c = buffer[i];

            /* Hash update: (hash * 33) + c */
            hash = ((hash << 5) + hash) + c;
            char_count++;

            if (c == '\n') {
                line_count++;
            }

            if (isspace(c)) {
                in_word = false;
            } else {
                if (!in_word) {
                    in_word = true;
                    word_count++;
                }
            }
        }
    }

    if (ferror(fp)) {
        out_result->error_code = errno ? errno : EIO;
        fclose(fp);
        return -1;
    }

    fclose(fp);

    out_result->bytes_processed = total_bytes;
    out_result->line_count = line_count;
    out_result->word_count = word_count;
    out_result->char_count = char_count;
    out_result->checksum = hash;
    out_result->error_code = 0;

    return 0;
}
