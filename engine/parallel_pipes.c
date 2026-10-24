/*
 * engine/parallel_pipes.c
 *
 * Mode B: Parallel Processing Using Pipes
 * Spawns worker processes using fork().
 * Inter-process communication via UNIX pipes.
 * Parent monitors worker pipes using poll() with full EINTR and partial-read handling.
 * Reaps all children using waitpid() to prevent zombie processes.
 */

#include "common.h"

int run_parallel_pipes(char file_list[][MAX_PATH_LEN], int file_count, int num_workers, const char *dataset_dir, engine_summary_t *summary) {
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
    strncpy(summary->mode, "pipes", sizeof(summary->mode) - 1);
    strncpy(summary->dataset_dir, dataset_dir, sizeof(summary->dataset_dir) - 1);
    summary->num_workers = num_workers;
    summary->total_files_discovered = file_count;

    int pipe_fds[num_workers][2];
    pid_t worker_pids[num_workers];

    double start_time = get_current_time_sec();

    /* Create pipes and fork worker processes */
    for (int i = 0; i < num_workers; i++) {
        if (pipe(pipe_fds[i]) != 0) {
            fprintf(stderr, "[Pipes Error] Failed to create pipe for worker %d: %s\n", i, strerror(errno));
            /* Clean up already opened pipes */
            for (int k = 0; k < i; k++) {
                close(pipe_fds[k][0]);
                close(pipe_fds[k][1]);
            }
            return -1;
        }

        pid_t pid = fork();
        if (pid < 0) {
            fprintf(stderr, "[Pipes Error] Failed to fork worker %d: %s\n", i, strerror(errno));
            close(pipe_fds[i][0]);
            close(pipe_fds[i][1]);
            return -1;
        }

        if (pid == 0) {
            /* ================= CHILD WORKER PROCESS ================= */
            /* Close read end */
            close(pipe_fds[i][0]);

            /* Close inherited descriptors from prior siblings */
            for (int k = 0; k < i; k++) {
                close(pipe_fds[k][0]);
            }

            pipe_message_t msg;
            memset(&msg, 0, sizeof(pipe_message_t));
            msg.worker_id = (uint32_t)i;

            /* Interleaved file distribution: worker i processes i, i + num_workers, ... */
            for (int f = i; f < file_count; f += num_workers) {
                file_result_t res;
                int ret = process_single_file(file_list[f], &res);
                if (ret == 0) {
                    msg.files_processed++;
                    msg.bytes_processed += res.bytes_processed;
                    msg.line_count += res.line_count;
                    msg.word_count += res.word_count;
                    msg.checksum_sum += (uint64_t)res.checksum;
                } else {
                    msg.files_failed++;
                }
            }
            msg.status = 0;

            /* Write result packet safely handling partial writes and EINTR */
            const char *buf_ptr = (const char *)&msg;
            size_t total_to_write = sizeof(pipe_message_t);
            size_t bytes_written = 0;

            while (bytes_written < total_to_write) {
                ssize_t w = write(pipe_fds[i][1], buf_ptr + bytes_written, total_to_write - bytes_written);
                if (w < 0) {
                    if (errno == EINTR) {
                        continue;
                    }
                    perror("[Child Worker Write Error]");
                    break;
                }
                bytes_written += (size_t)w;
            }

            close(pipe_fds[i][1]);
            _exit(0); /* Terminate child immediately */
        } else {
            /* ================= PARENT PROCESS ================= */
            worker_pids[i] = pid;
            /* Close write end in parent */
            close(pipe_fds[i][1]);
        }
    }

    /* Prepare poll structures to monitor worker read pipes */
    struct pollfd pfds[num_workers];
    pipe_message_t results[num_workers];
    size_t bytes_read[num_workers];

    for (int i = 0; i < num_workers; i++) {
        pfds[i].fd = pipe_fds[i][0];
        pfds[i].events = POLLIN | POLLHUP | POLLERR;
        pfds[i].revents = 0;
        memset(&results[i], 0, sizeof(pipe_message_t));
        bytes_read[i] = 0;
    }

    int active_workers = num_workers;

    while (active_workers > 0) {
        int poll_ret = poll(pfds, num_workers, -1);
        if (poll_ret < 0) {
            if (errno == EINTR) {
                continue; /* Interrupted by signal, retry */
            }
            perror("[Pipes Error] poll() failed");
            break;
        }

        for (int i = 0; i < num_workers; i++) {
            if (pfds[i].fd < 0) {
                continue;
            }

            if (pfds[i].revents & (POLLIN | POLLHUP)) {
                char *target = (char *)&results[i];
                size_t needed = sizeof(pipe_message_t) - bytes_read[i];

                if (needed > 0) {
                    ssize_t r = read(pfds[i].fd, target + bytes_read[i], needed);
                    if (r > 0) {
                        bytes_read[i] += (size_t)r;
                    } else if (r == 0) {
                        /* End of file / pipe closed by worker */
                        close(pfds[i].fd);
                        pfds[i].fd = -1;
                        active_workers--;
                    } else {
                        if (errno != EINTR && errno != EAGAIN) {
                            perror("[Pipes Error] read() failed on worker pipe");
                            close(pfds[i].fd);
                            pfds[i].fd = -1;
                            active_workers--;
                        }
                    }
                } else {
                    /* All bytes already received, close descriptor */
                    close(pfds[i].fd);
                    pfds[i].fd = -1;
                    active_workers--;
                }
            } else if (pfds[i].revents & (POLLERR | POLLNVAL)) {
                fprintf(stderr, "[Pipes Warning] Worker %d pipe reported error event\n", i);
                close(pfds[i].fd);
                pfds[i].fd = -1;
                active_workers--;
            }
        }
    }

    /* Clean up any remaining open read file descriptors */
    for (int i = 0; i < num_workers; i++) {
        if (pfds[i].fd >= 0) {
            close(pfds[i].fd);
        }
    }

    /* Reap all child worker processes */
    for (int i = 0; i < num_workers; i++) {
        int status = 0;
        pid_t waited_pid = waitpid(worker_pids[i], &status, 0);
        if (waited_pid < 0) {
            fprintf(stderr, "[Pipes Warning] waitpid failed for worker %d: %s\n", i, strerror(errno));
        } else if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) {
            fprintf(stderr, "[Pipes Warning] Worker %d (PID %d) terminated abnormally (exit code %d)\n",
                    i, (int)waited_pid, WEXITSTATUS(status));
        }
    }

    /* Aggregate collected metrics from each worker */
    for (int i = 0; i < num_workers; i++) {
        summary->files_processed += results[i].files_processed;
        summary->files_failed += results[i].files_failed;
        summary->total_bytes += results[i].bytes_processed;
        summary->total_lines += results[i].line_count;
        summary->total_words += results[i].word_count;
        summary->total_checksum += results[i].checksum_sum;
    }

    double end_time = get_current_time_sec();
    double elapsed = end_time - start_time;
    if (elapsed < 0.000001) {
        elapsed = 0.000001;
    }

    summary->elapsed_time_sec = elapsed;
    summary->throughput_fps = (double)summary->files_processed / elapsed;
    summary->throughput_mbps = ((double)summary->total_bytes / (1024.0 * 1024.0)) / elapsed;

    return 0;
}
