#!/usr/bin/env bash
# tests/test_engine.sh
# Integration tests for C Parallel File Processing Engine.
# Verifies compilation, error handling, and 100% metric consistency across
# Sequential, UNIX Pipes, and POSIX Shared Memory modes.

set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${BOLD}${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}   PARALLEL FILE PROCESSING ENGINE INTEGRATION TESTS  ${RESET}"
echo -e "${BOLD}${CYAN}======================================================${RESET}"

# 1. Build Verification
echo -e "\n${BOLD}[1] Compiling C Engine with Makefile...${RESET}"
make clean >/dev/null
make >/dev/null

if [ ! -f "engine/bin/engine" ]; then
    echo -e "${RED}[FAIL] Engine binary engine/bin/engine was not produced!${RESET}"
    exit 1
fi
echo -e "${GREEN}[PASS] Compilation successful.${RESET}"

# 2. Dataset Verification
if [ ! -d "datasets/briefings" ] || [ $(ls -1 datasets/briefings/*.txt 2>/dev/null | wc -l) -eq 0 ]; then
    echo -e "\n${BOLD}[2] Generating small test dataset...${RESET}"
    python3 scripts/generate_datasets.py --small
fi

TEST_DIR="datasets/briefings"
echo -e "\n${BOLD}[2] Executing Modes on: ${TEST_DIR}${RESET}"

mkdir -p results

# Run Sequential Mode
echo -n "  Running Mode A (Sequential) ... "
./engine/bin/engine --mode sequential --dir "$TEST_DIR" --output results/integ_seq.json --json >/dev/null
echo -e "${GREEN}[OK]${RESET}"

# Run Pipes Mode
echo -n "  Running Mode B (Pipes, 4 workers) ... "
./engine/bin/engine --mode pipes --dir "$TEST_DIR" --workers 4 --output results/integ_pipe.json --json >/dev/null
echo -e "${GREEN}[OK]${RESET}"

# Run Shared Memory Mode
echo -n "  Running Mode C (Shared Memory, 4 workers) ... "
./engine/bin/engine --mode shared_memory --dir "$TEST_DIR" --workers 4 --output results/integ_shm.json --json >/dev/null
echo -e "${GREEN}[OK]${RESET}"

# 3. Metric Consistency Assertions
echo -e "\n${BOLD}[3] Verifying Cross-Mode Metric Consistency...${RESET}"

extract_val() {
    python3 -c "import json, sys; d=json.load(open('$1')); print(d['$2'])"
}

SEQ_FILES=$(extract_val results/integ_seq.json files_processed)
PIPE_FILES=$(extract_val results/integ_pipe.json files_processed)
SHM_FILES=$(extract_val results/integ_shm.json files_processed)

SEQ_BYTES=$(extract_val results/integ_seq.json total_bytes)
PIPE_BYTES=$(extract_val results/integ_pipe.json total_bytes)
SHM_BYTES=$(extract_val results/integ_shm.json total_bytes)

SEQ_LINES=$(extract_val results/integ_seq.json total_lines)
PIPE_LINES=$(extract_val results/integ_pipe.json total_lines)
SHM_LINES=$(extract_val results/integ_shm.json total_lines)

SEQ_WORDS=$(extract_val results/integ_seq.json total_words)
PIPE_WORDS=$(extract_val results/integ_pipe.json total_words)
SHM_WORDS=$(extract_val results/integ_shm.json total_words)

SEQ_CHK=$(extract_val results/integ_seq.json total_checksum)
PIPE_CHK=$(extract_val results/integ_pipe.json total_checksum)
SHM_CHK=$(extract_val results/integ_shm.json total_checksum)

assert_eq() {
    local val1="$1"
    local val2="$2"
    local val3="$3"
    local name="$4"

    if [ "$val1" == "$val2" ] && [ "$val1" == "$val3" ]; then
        echo -e "  [PASS] ${name} identical across all modes: ${BOLD}${val1}${RESET}"
    else
        echo -e "  ${RED}[FAIL] ${name} mismatch!${RESET} Seq: $val1, Pipe: $val2, Shm: $val3"
        exit 1
    fi
}

assert_eq "$SEQ_FILES" "$PIPE_FILES" "$SHM_FILES" "Files Processed"
assert_eq "$SEQ_BYTES" "$PIPE_BYTES" "$SHM_BYTES" "Total Bytes"
assert_eq "$SEQ_LINES" "$PIPE_LINES" "$SHM_LINES" "Total Lines"
assert_eq "$SEQ_WORDS" "$PIPE_WORDS" "$SHM_WORDS" "Total Words"
assert_eq "$SEQ_CHK" "$PIPE_CHK" "$SHM_CHK" "Cumulative Checksum"

# 4. Error Handling Checks
echo -e "\n${BOLD}[4] Verifying Error Handling & Robustness...${RESET}"

# Non-existent directory
if ./engine/bin/engine --mode sequential --dir /invalid_path_404 2>/dev/null; then
    echo -e "  ${RED}[FAIL] Engine did not reject invalid directory path!${RESET}"
    exit 1
else
    echo -e "  [PASS] Correctly rejected non-existent directory."
fi

# Invalid mode
if ./engine/bin/engine --mode invalid_mode --dir "$TEST_DIR" 2>/dev/null; then
    echo -e "  ${RED}[FAIL] Engine did not reject invalid processing mode!${RESET}"
    exit 1
else
    echo -e "  [PASS] Correctly rejected invalid mode."
fi

echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}   ALL C ENGINE INTEGRATION TESTS PASSED (100% OK)    ${RESET}"
echo -e "${BOLD}${GREEN}======================================================${RESET}\n"
