# Makefile for Operating Systems Course Project:
# Parallel File Processing System with CPU Scheduling and AI Insights

CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -pthread -std=c11
LDFLAGS ?= -pthread -lrt

SRC_DIR = engine
BIN_DIR = $(SRC_DIR)/bin
TARGET = $(BIN_DIR)/engine

SRCS = $(SRC_DIR)/main.c \
       $(SRC_DIR)/file_processor.c \
       $(SRC_DIR)/sequential.c \
       $(SRC_DIR)/parallel_pipes.c \
       $(SRC_DIR)/parallel_shm.c \
       $(SRC_DIR)/process_utils.c

OBJS = $(SRCS:.c=.o)

.PHONY: all clean help rebuild

all: $(TARGET)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(TARGET): $(OBJS) | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $(OBJS) $(LDFLAGS)
	@echo "Build successful: $(TARGET)"

%.o: %.c $(SRC_DIR)/common.h
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -rf $(BIN_DIR) $(SRC_DIR)/*.o results/*.json
	@echo "Clean completed."

rebuild: clean all

help:
	@echo "Operating Systems Project - Build Commands:"
	@echo "  make         - Build the parallel C processing engine"
	@echo "  make clean   - Remove compiled binaries, object files, and temporary results"
	@echo "  make rebuild - Clean and rebuild the engine"
	@echo "  make help    - Show this help message"
