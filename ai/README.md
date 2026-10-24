# AI & NLP Analyzer Module

This module provides CPU-efficient, lightweight natural language processing and statistical telemetry analytics for the processed datasets.

## Methodologies Implemented

1. **Customer Reviews Analysis**:
   - **Lexicon Valence Scoring**: Computes net sentiment polarity by evaluating positive and negative word occurrences against a sentiment lexicon.
   - **Keyword Extraction**: Identifies high-frequency tokens with standard English stop-word filtering.
   - **Unsupervised Complaint Clustering**: Groups negative feedback into common engineering categories (Thermal/Performance, Hardware Defect, Software/Firmware, Customer Support, Logistics).

2. **Server Diagnostic Logs Analysis**:
   - **Severity Tally**: Tabulates log levels (`INFO`, `WARNING`, `ERROR`, `CRITICAL`).
   - **Regex Signature Clustering**: Normalizes variable fields (timestamps, IPs, thread IDs) to cluster recurring crash/error patterns.
   - **Latency Parametric Statistics**: Computes Min, Max, Mean, Median, Standard Deviation, P95, and P99 latencies directly from real `latency_ms=XX` log tags.
   - **Anomaly Detection**: Surfaces high-latency outliers ($\ge 2500$ ms) and authentication error bursts.

3. **Executive Technical Briefings**:
   - **Corpus TF-IDF**: Evaluates Term Frequency-Inverse Document Frequency to highlight domain terms distinguishing key briefing topics.
   - **Thematic Grouping**: Categorizes documents by systems domain (Memory Management, IPC, CPU Scheduling, File I/O).
   - **Extractive Summarization**: Extracts key executive summary observations directly from section headings.

## Execution

Run from the project root:

```bash
# Analyze customer reviews
python3 ai/analyzer.py --dataset reviews --dir datasets/reviews --output results/ai_reviews.json

# Analyze server logs
python3 ai/analyzer.py --dataset logs --dir datasets/logs --output results/ai_logs.json

# Analyze executive briefings
python3 ai/analyzer.py --dataset briefings --dir datasets/briefings --output results/ai_briefings.json
```

## Limitations & Academic Scope
- Uses rule-based and frequency-based NLP techniques rather than large language models (LLMs) or transformers.
- Highly deterministic, rapid execution on commodity CPUs with zero GPU requirements and zero external pip dependencies.
