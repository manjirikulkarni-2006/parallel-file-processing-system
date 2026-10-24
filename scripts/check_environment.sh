#!/usr/bin/env bash
# scripts/check_environment.sh
# Diagnostic script to verify WSL2 Ubuntu environment and toolchain readiness

set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo -e "${BOLD}${CYAN}   Operating Systems Project - Environment Readiness Checker    ${RESET}"
echo -e "${BOLD}${CYAN}================================================================${RESET}"

ERRORS=0
WARNINGS=0

check_cmd() {
    local cmd_name="$1"
    local friendly_name="$2"
    local min_info="$3"

    printf " Checking %-24s ... " "$friendly_name"
    if command -v "$cmd_name" >/dev/null 2>&1; then
        local version_str
        version_str=$("$cmd_name" --version 2>&1 | head -n 1)
        echo -e "${GREEN}[OK]${RESET} found ($version_str)"
    else
        echo -e "${RED}[FAIL]${RESET} '$cmd_name' is not installed or not in PATH."
        ERRORS=$((ERRORS + 1))
    fi
}

echo -e "\n${BOLD}[1] Toolchain Verification${RESET}"
check_cmd "gcc" "GCC Compiler" "10+"
check_cmd "make" "GNU Make" "4+"
check_cmd "python3" "Python 3 Runtime" "3.8+"
check_cmd "node" "Node.js Runtime" "18+"
check_cmd "npm" "Node Package Manager" "9+"

echo -e "\n${BOLD}[2] Operating System & WSL Detection${RESET}"
OS_NAME=$(uname -s)
KERNEL_VER=$(uname -r)
printf " Kernel: %s (%s)\n" "$KERNEL_VER" "$OS_NAME"

if grep -qi "microsoft" /proc/version 2>/dev/null; then
    echo -e " Environment: ${GREEN}[OK] WSL2 Linux Kernel detected${RESET}"
else
    echo -e " Environment: ${YELLOW}[INFO] Native Linux detected (also supported)${RESET}"
fi

echo -e "\n${BOLD}[3] POSIX IPC Subsystem Readiness (/dev/shm)${RESET}"
if [ -d "/dev/shm" ] && [ -w "/dev/shm" ]; then
    echo -e " Shared Memory (/dev/shm): ${GREEN}[OK] Available and writable${RESET}"
else
    echo -e " Shared Memory (/dev/shm): ${RED}[FAIL] /dev/shm is missing or not writable${RESET}"
    ERRORS=$((ERRORS + 1))
fi

echo -e "\n${BOLD}[4] Project Folder Structure${RESET}"
for dir in "engine" "ai" "datasets" "datasets/reviews" "datasets/logs" "datasets/briefings" "scripts" "results" "web" "tests" "docs"; do
    if [ -d "$dir" ]; then
        echo -e " Directory '$dir': ${GREEN}[OK]${RESET}"
    else
        echo -e " Directory '$dir': ${YELLOW}[MISSING - will create]${RESET}"
        mkdir -p "$dir"
    fi
done

echo -e "\n${BOLD}[5] Python Standard Libraries Check${RESET}"
python3 -c "import json, os, sys, math, re, collections, time, random; print(' Python standard libraries for AI & Engine: [OK]')" 2>/dev/null || {
    echo -e " Python standard libraries: ${RED}[FAIL]${RESET}"
    ERRORS=$((ERRORS + 1))
}

echo -e "\n${BOLD}${CYAN}================================================================${RESET}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${BOLD}${GREEN} Environment Check PASSED! All prerequisites are satisfied.${RESET}"
    echo -e " You are ready to build the engine and run the project."
    echo -e "${BOLD}${CYAN}================================================================${RESET}"
    exit 0
else
    echo -e "${BOLD}${RED} Environment Check FAILED with $ERRORS error(s). Please install missing tools.${RESET}"
    echo -e "${BOLD}${CYAN}================================================================${RESET}"
    exit 1
fi
