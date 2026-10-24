#!/usr/bin/env python3
"""
tests/test_results.py
Automated validation of C engine results JSON and AI analyzer output schemas.
"""

import os
import sys
import json
import subprocess

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(ROOT_DIR)

TESTS_PASSED = 0
TESTS_TOTAL = 0


def assert_true(condition, msg):
    global TESTS_PASSED, TESTS_TOTAL
    TESTS_TOTAL += 1
    if condition:
        print(f"  [PASS] {msg}")
        TESTS_PASSED += 1
    else:
        print(f"  [FAIL] {msg}")
        sys.exit(1)


def test_engine_schema_and_reproducibility():
    print("\n--- 1. Testing C Engine Output Schema & Reproducibility ---")
    engine_bin = os.path.join("engine", "bin", "engine")
    if not os.path.exists(engine_bin):
        print(f"Building engine...")
        subprocess.check_call(["make"], cwd=ROOT_DIR)

    dataset_dir = os.path.join("datasets", "briefings")
    out1 = os.path.join("results", "py_test_1.json")
    out2 = os.path.join("results", "py_test_2.json")

    # Run engine twice on same input
    cmd1 = [engine_bin, "--mode", "sequential", "--dir", dataset_dir, "--output", out1, "--json"]
    cmd2 = [engine_bin, "--mode", "sequential", "--dir", dataset_dir, "--output", out2, "--json"]

    subprocess.check_call(cmd1)
    subprocess.check_call(cmd2)

    with open(out1) as f:
        data1 = json.load(f)
    with open(out2) as f:
        data2 = json.load(f)

    # Validate Schema
    required_keys = [
        "success", "mode", "dataset_dir", "num_workers",
        "total_files_discovered", "files_processed", "files_failed",
        "total_bytes", "total_lines", "total_words", "total_checksum",
        "elapsed_time_sec", "throughput_fps", "throughput_mbps"
    ]
    for key in required_keys:
        assert_true(key in data1, f"JSON contains required key: '{key}'")

    assert_true(data1["success"] is True, "Engine reports success: true")
    assert_true(data1["files_processed"] > 0, "Files processed > 0")
    assert_true(data1["total_bytes"] > 0, "Total bytes > 0")
    assert_true(data1["elapsed_time_sec"] > 0.0, "Elapsed time > 0.0s")
    assert_true(data1["throughput_fps"] > 0.0, "Throughput fps > 0.0")

    # Validate Deterministic Reproducibility
    assert_true(data1["total_checksum"] == data2["total_checksum"], "Checksum identical across repeated runs")
    assert_true(data1["total_bytes"] == data2["total_bytes"], "Total bytes identical across repeated runs")
    assert_true(data1["total_words"] == data2["total_words"], "Total words identical across repeated runs")


def test_ai_analyzer_schema():
    print("\n--- 2. Testing AI Analyzer Output Schemas ---")
    analyzer_script = os.path.join("ai", "analyzer.py")

    for ds_type in ["reviews", "logs", "briefings"]:
        ds_dir = os.path.join("datasets", ds_type)
        out_file = os.path.join("results", f"py_ai_{ds_type}.json")

        cmd = ["python3", analyzer_script, "--dataset", ds_type, "--dir", ds_dir, "--output", out_file]
        subprocess.check_call(cmd)

        with open(out_file) as f:
            data = json.load(f)

        assert_true(data.get("status") == "success", f"AI Analyzer succeeded for {ds_type}")
        assert_true("analysis_type" in data, f"{ds_type} output contains 'analysis_type'")
        assert_true("methodology" in data, f"{ds_type} output contains 'methodology'")
        assert_true("limitations" in data, f"{ds_type} output contains 'limitations'")

        if ds_type == "reviews":
            assert_true("sentiment_distribution" in data, "Reviews analysis contains 'sentiment_distribution'")
            assert_true("frequent_keywords" in data, "Reviews analysis contains 'frequent_keywords'")
            assert_true("complaint_themes" in data, "Reviews analysis contains 'complaint_themes'")
        elif ds_type == "logs":
            assert_true("severity_distribution" in data, "Logs analysis contains 'severity_distribution'")
            assert_true("latency_statistics" in data, "Logs analysis contains 'latency_statistics'")
            assert_true("frequent_error_patterns" in data, "Logs analysis contains 'frequent_error_patterns'")
        elif ds_type == "briefings":
            assert_true("thematic_topic_groupings" in data, "Briefings analysis contains 'thematic_topic_groupings'")
            assert_true("top_tfidf_keywords" in data, "Briefings analysis contains 'top_tfidf_keywords'")
            assert_true("extractive_summary_sample" in data, "Briefings analysis contains 'extractive_summary_sample'")


def main():
    print("=================================================");
    print("   VALIDATING ENGINE JSON & AI ANALYZER SCHEMAS   ");
    print("=================================================");

    test_engine_schema_and_reproducibility()
    test_ai_analyzer_schema()

    print("\n=================================================");
    print(f"   TEST SUMMARY: {TESTS_PASSED}/{TESTS_TOTAL} TESTS PASSED");
    print("=================================================\n");


if __name__ == "__main__":
    main()
