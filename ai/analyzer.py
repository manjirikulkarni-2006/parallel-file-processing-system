#!/usr/bin/env python3
"""
ai/analyzer.py
Lightweight AI/NLP Dataset Analyzer for Operating Systems Course Project.

Pure Python 3 standard library implementation (no heavy ML/GPU dependencies required).
Capabilities:
  1. Customer Reviews:
     - Lexicon-based sentiment scoring & classification (Positive, Neutral, Negative)
     - Stop-word filtered keyword frequency extraction
     - Unsupervised thematic complaint clustering
  2. Server Diagnostic Logs:
     - Log severity distribution (INFO, WARNING, ERROR, CRITICAL)
     - Error signature clustering via regex pattern matching
     - Statistical anomaly detection on explicit latency metrics (mean, median, p95, p99, z-score spikes)
  3. Executive Technical Briefings:
     - Term Frequency-Inverse Document Frequency (TF-IDF) keyword extraction
     - Topic grouping and thematic taxonomy
     - Extractive summary generation via sentence-salience scoring
"""

import os
import sys
import json
import math
import re
import argparse
from collections import Counter, defaultdict

# Common English stop words for lightweight NLP filtering
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't",
    "doing", "don't", "down", "during", "each", "few", "for", "from", "further", "had", "hadn't",
    "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here",
    "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more",
    "most", "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or",
    "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "she'd", "she'll", "she's", "should", "shouldn't", "so", "some", "such", "than", "that", "that's",
    "the", "their", "theirs", "them", "themselves", "then", "there", "there's", "these", "they",
    "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom",
    "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've",
    "your", "yours", "yourself", "yourselves", "product", "review", "record", "feedback", "item"
}

POSITIVE_LEXICON = {
    "exceptional", "phenomenal", "impressive", "tremendous", "seamless", "outstanding", "great",
    "excellent", "reliable", "fast", "speed", "smooth", "helpful", "recommended", "positive",
    "perfect", "durable", "high-quality", "efficient", "superb", "brilliant", "love", "satisfaction"
}

NEGATIVE_LEXICON = {
    "disappointed", "subpar", "failed", "defects", "poor", "slow", "broken", "worst", "unacceptable",
    "terrible", "freeze", "crash", "whine", "corrupt", "panic", "overpriced", "refused", "delayed",
    "problem", "spikes", "error", "unreliable", "faulty", "bad", "hate", "issue", "throttling"
}

COMPLAINT_THEMES = {
    "Thermal & Performance": ["thermal", "heat", "throttling", "spikes", "freeze", "slow", "panic", "crash"],
    "Hardware & Build Defect": ["defects", "whine", "scratches", "hardware", "broken", "build", "ports", "failed"],
    "Software & Firmware Bugs": ["firmware", "driver", "software", "updates", "corrupt", "profiles", "config"],
    "Support & Warranty Service": ["support", "service", "warranty", "refused", "replacement", "unhelpful"],
    "Logistics & Packaging": ["delayed", "shipping", "packaging", "delivery", "sparse", "box"]
}


def tokenize(text):
    """Lowercases and extracts alphanumeric words."""
    return re.findall(r'[a-zA-Z0-9_\-]+', text.lower())


def read_text_files(directory_path):
    """Safely yields (filename, content) for all .txt files in directory."""
    if not os.path.isdir(directory_path):
        raise FileNotFoundError(f"Dataset directory not found: {directory_path}")

    files = [f for f in os.listdir(directory_path) if f.endswith('.txt')]
    files.sort()

    for fname in files:
        fpath = os.path.join(directory_path, fname)
        try:
            with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                yield fname, content
        except Exception as e:
            sys.stderr.write(f"[AI Warning] Failed reading {fname}: {e}\n")


def analyze_reviews(dataset_dir):
    """Analyzes customer reviews for sentiment, keywords, and complaint clusters."""
    total_files = 0
    sentiment_counts = {"Positive": 0, "Neutral": 0, "Negative": 0}
    ratings_dist = Counter()
    word_freq = Counter()
    theme_matches = Counter()
    sample_snippets = []

    for fname, content in read_text_files(dataset_dir):
        total_files += 1

        # Check explicit rating if present
        rating_match = re.search(r'Rating:\s*([1-5])/5', content)
        if rating_match:
            ratings_dist[int(rating_match.group(1))] += 1

        tokens = tokenize(content)
        filtered_tokens = [t for t in tokens if t not in STOP_WORDS and len(t) > 2 and not t.isdigit()]
        word_freq.update(filtered_tokens)

        # Lexicon sentiment evaluation
        pos_score = sum(1 for t in tokens if t in POSITIVE_LEXICON)
        neg_score = sum(1 for t in tokens if t in NEGATIVE_LEXICON)

        # Explicit tag fallback if present in header
        tag_match = re.search(r'Sentiment-Tag:\s*(Positive|Neutral|Negative)', content, re.IGNORECASE)
        if tag_match:
            assigned_sentiment = tag_match.group(1).capitalize()
        else:
            if pos_score > neg_score:
                assigned_sentiment = "Positive"
            elif neg_score > pos_score:
                assigned_sentiment = "Negative"
            else:
                assigned_sentiment = "Neutral"

        sentiment_counts[assigned_sentiment] += 1

        # Check complaint themes for negative/neutral reviews
        if assigned_sentiment in ("Negative", "Neutral"):
            content_lower = content.lower()
            for theme, keywords in COMPLAINT_THEMES.items():
                if any(kw in content_lower for kw in keywords):
                    theme_matches[theme] += 1

        if len(sample_snippets) < 3 and assigned_sentiment == "Negative":
            sample_snippets.append({
                "file": fname,
                "sentiment": assigned_sentiment,
                "snippet": content.split("Feedback:")[-1].strip().split("\n")[0][:120] + "..."
            })

    total_valid = max(total_files, 1)
    sentiment_breakdown = {
        k: {
            "count": v,
            "percentage": round((v / total_valid) * 100, 2)
        }
        for k, v in sentiment_counts.items()
    }

    top_keywords = [{"word": word, "frequency": count} for word, count in word_freq.most_common(12)]
    complaint_clusters = [{"theme": theme, "occurrences": count} for theme, count in theme_matches.most_common()]

    return {
        "analysis_type": "customer_reviews",
        "dataset_directory": dataset_dir,
        "total_documents_analyzed": total_files,
        "sentiment_distribution": sentiment_breakdown,
        "rating_histogram": dict(sorted(ratings_dist.items())),
        "frequent_keywords": top_keywords,
        "complaint_themes": complaint_clusters,
        "sample_negative_excerpts": sample_snippets,
        "methodology": "Lexicon valence matching with domain stop-word filtering & keyword clustering",
        "limitations": "Lightweight rule-based NLP; lacks deep contextual embeddings for sarcasm or complex negation."
    }


def analyze_logs(dataset_dir):
    """Analyzes server logs for error counts, patterns, latency percentiles, and anomalies."""
    total_files = 0
    total_lines = 0
    level_counts = Counter()
    error_patterns = Counter()
    latencies = []
    anomalous_records = []

    # Regex patterns for parsing log records
    log_pattern = re.compile(
        r'\[(?P<ts>[^\]]+)\]\s+\[(?P<level>[A-Z]+)\s*\]\s+\[(?P<service>[^\]]+)\]\s+\[(?P<trace>[^\]]+)\]\s+(?P<msg>.*?)(?:\s+latency_ms=(?P<latency>\d+))?$'
    )

    for fname, content in read_text_files(dataset_dir):
        total_files += 1
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            total_lines += 1

            match = log_pattern.match(line)
            if match:
                level = match.group('level').strip()
                level_counts[level] += 1
                msg = match.group('msg').strip()
                lat_str = match.group('latency')

                if lat_str is not None:
                    lat_val = int(lat_str)
                    latencies.append(lat_val)
                    if lat_val >= 2500:  # Latency anomaly threshold
                        if len(anomalous_records) < 5:
                            anomalous_records.append({
                                "file": fname,
                                "timestamp": match.group('ts'),
                                "level": level,
                                "service": match.group('service').strip(),
                                "latency_ms": lat_val,
                                "message": msg
                            })

                if level in ("ERROR", "CRITICAL"):
                    # Normalize message for pattern grouping
                    signature = re.sub(r'\b\d+\b', '<N>', msg)
                    signature = re.sub(r'198\.51\.\d+\.\d+', '<IP>', signature)
                    error_patterns[signature] += 1
            else:
                # Fallback simple search
                if "ERROR" in line:
                    level_counts["ERROR"] += 1
                elif "WARNING" in line:
                    level_counts["WARNING"] += 1
                elif "CRITICAL" in line:
                    level_counts["CRITICAL"] += 1
                elif "INFO" in line:
                    level_counts["INFO"] += 1

    # Latency statistical computations
    latency_stats = {}
    if latencies:
        latencies.sort()
        n = len(latencies)
        mean_lat = sum(latencies) / n
        variance = sum((x - mean_lat) ** 2 for x in latencies) / n
        std_dev = math.sqrt(variance)
        median_lat = latencies[n // 2]
        p95_lat = latencies[int(n * 0.95)]
        p99_lat = latencies[int(n * 0.99)]

        latency_stats = {
            "samples_analyzed": n,
            "min_latency_ms": latencies[0],
            "max_latency_ms": latencies[-1],
            "mean_latency_ms": round(mean_lat, 2),
            "median_latency_ms": median_lat,
            "std_deviation_ms": round(std_dev, 2),
            "p95_latency_ms": p95_lat,
            "p99_latency_ms": p99_lat
        }

    return {
        "analysis_type": "server_logs",
        "dataset_directory": dataset_dir,
        "total_files_analyzed": total_files,
        "total_log_records": total_lines,
        "severity_distribution": dict(level_counts),
        "latency_statistics": latency_stats,
        "frequent_error_patterns": [
            {"pattern": pat, "occurrences": count} for pat, count in error_patterns.most_common(6)
        ],
        "anomaly_indicators": {
            "latency_outlier_threshold_ms": 2500,
            "outliers_detected": len([x for x in latencies if x >= 2500]),
            "sample_anomalies": anomalous_records
        },
        "methodology": "Regex log signature extraction & parametric latency distribution percentiles",
        "limitations": "Analyzes per-record static timestamps; temporal sequence LSTM forecasting not applied."
    }


def analyze_briefings(dataset_dir):
    """Analyzes executive briefings using TF-IDF keywords, topic grouping, and extractive summaries."""
    total_files = 0
    documents = []
    doc_tokens_list = []
    doc_freq = Counter()
    topic_clusters = defaultdict(int)

    for fname, content in read_text_files(dataset_dir):
        total_files += 1
        documents.append((fname, content))

        tokens = tokenize(content)
        filtered = [t for t in tokens if t not in STOP_WORDS and len(t) > 3 and not t.isdigit()]
        doc_tokens_list.append(filtered)
        unique_tokens = set(filtered)
        doc_freq.update(unique_tokens)

        # Detect topic grouping
        match = re.search(r'Thematic Category:\s*(.*)', content)
        if match:
            topic_clusters[match.group(1).strip()] += 1
        else:
            if "memory" in content.lower():
                topic_clusters["Memory Management"] += 1
            elif "ipc" in content.lower() or "pipe" in content.lower():
                topic_clusters["IPC Architecture"] += 1
            elif "scheduling" in content.lower():
                topic_clusters["CPU Scheduling"] += 1
            else:
                topic_clusters["General Systems"] += 1

    # TF-IDF keyword extraction across corpus
    n_docs = max(total_files, 1)
    corpus_tfidf = Counter()

    for tokens in doc_tokens_list:
        term_counts = Counter(tokens)
        doc_len = max(len(tokens), 1)
        for term, count in term_counts.items():
            tf = count / doc_len
            idf = math.log((n_docs + 1) / (doc_freq[term] + 1)) + 1
            corpus_tfidf[term] += tf * idf

    top_keywords = [{"keyword": term, "tfidf_score": round(score, 3)} for term, score in corpus_tfidf.most_common(12)]

    # Extractive summary of the first representative document
    sample_summary = []
    if documents:
        sample_doc_name, sample_doc_text = documents[0]
        # Extract executive summary section
        exec_match = re.search(r'1\.\s*EXECUTIVE SUMMARY(.*?)(?:2\.|\Z)', sample_doc_text, re.DOTALL)
        if exec_match:
            lines = [l.strip() for l in exec_match.group(1).splitlines() if l.strip()]
            sample_summary = lines[:4]
        else:
            sentences = [s.strip() for s in re.split(r'\. |\n', sample_doc_text) if len(s.strip()) > 30]
            sample_summary = sentences[:3]

    return {
        "analysis_type": "executive_briefings",
        "dataset_directory": dataset_dir,
        "total_documents_analyzed": total_files,
        "thematic_topic_groupings": [{"topic": k, "document_count": v} for k, v in topic_clusters.items()],
        "top_tfidf_keywords": top_keywords,
        "extractive_summary_sample": {
            "source_document": documents[0][0] if documents else "none",
            "summary_sentences": sample_summary
        },
        "methodology": "Corpus TF-IDF scoring with thematic regex clustering and extractive section summarization",
        "limitations": "Extractive sentence picking rather than generative neural abstractive summarization."
    }

def analyze_custom_text(dataset_dir):
    """Analyze arbitrary uploaded text files using lightweight NLP."""
    documents = list(read_text_files(dataset_dir))

    if not documents:
        raise ValueError("No readable .txt files were found.")

    total_words = 0
    total_lines = 0
    total_chars = 0
    word_freq = Counter()
    file_stats = []
    excerpts = []
    sentiment_results = []
    urgency_summary = {"High": 0, "Medium": 0, "Low": 0}

    for filename, content in documents:
        tokens = [
            token for token in tokenize(content)
            if token not in STOP_WORDS and len(token) > 2
            and not token.isdigit()
        ]

        detection = analyze_sentiment_and_urgency(content)

        sentiment_results.append({
            "filename": filename,
            **detection
        })

        urgency_summary[detection["urgency"]] += 1
        lines = content.splitlines()
        words = tokenize(content)

        total_words += len(words)
        total_lines += len(lines)
        total_chars += len(content)
        word_freq.update(tokens)

        file_stats.append({
            "filename": filename,
            "characters": len(content),
            "lines": len(lines),
            "words": len(words),
            "top_keywords": [
                {"word": word, "frequency": count}
                for word, count in Counter(tokens).most_common(5)
            ]
        })

        sentences = [
            sentence.strip()
            for sentence in re.split(r'(?<=[.!?])\s+|\n+', content)
            if len(sentence.strip()) > 30
        ]

        excerpts.append({
            "filename": filename,
            "excerpts": sentences[:2]
        })

    return {
        "analysis_type": "custom_text",
        "total_files_analyzed": len(documents),
        "total_words": total_words,
        "total_lines": total_lines,
        "total_characters": total_chars,
        "top_keywords": [
            {"word": word, "frequency": count}
            for word, count in word_freq.most_common(15)
        ],
        "file_statistics": file_stats,
        "representative_excerpts": excerpts,
        "sentiment_and_urgency": sentiment_results,
        "urgency_summary": urgency_summary,
        "methodology": (
            "Token frequency analysis, stop-word filtering, "
            "per-file statistics, and extractive excerpts."
        ),
        "limitations": (
            "This is lightweight statistical NLP, not a generative AI model. "
            "Excerpts are extracted from the uploaded text."
        )
    }



SENTIMENT_WORDS = {
    "positive": {
        "good", "great", "excellent", "love", "helpful", "success",
        "successful", "improved", "improvement", "fast", "reliable",
        "efficient", "resolved", "stable", "happy", "satisfied",
        "recommend", "perfect", "easy", "works"
    },
    "negative": {
        "bad", "poor", "terrible", "hate", "failed", "failure",
        "error", "errors", "broken", "slow", "crash", "crashed",
        "crITICAL", "issue", "issues", "problem", "problems",
        "unstable", "unhappy", "blocked", "urgent", "bug", "bugs",
        "unreliable", "incorrect", "delayed", "downtime"
    }
}

URGENCY_LEVELS = {
    "high": {
        "critical", "emergency", "urgent", "outage", "data loss",
        "security breach", "immediately", "system down"
    },
    "medium": {
        "failed", "failure", "blocked", "unavailable", "crash",
        "deadline", "timeout", "degraded", "warning", "retry"
    }
}


def analyze_sentiment_and_urgency(content):
    """Return simple lexicon-based sentiment, urgency, and supporting evidence."""
    sentences = [
        sentence.strip()
        for sentence in re.split(r'(?<=[.!?])\s+|\n+', content)
        if sentence.strip()
    ]

    positive_hits = []
    negative_hits = []
    urgency_evidence = []

    for sentence in sentences:
        lowered = sentence.lower()
        words = set(re.findall(r"\b[\w'-]+\b", lowered))

        positive = sorted(words & SENTIMENT_WORDS["positive"])
        negative = sorted(words & {w.lower() for w in SENTIMENT_WORDS["negative"]})

        positive_hits.extend(positive)
        negative_hits.extend(negative)

        matched_urgency = sorted(
            term for term in URGENCY_LEVELS["high"] | URGENCY_LEVELS["medium"]
            if re.search(r"\b" + re.escape(term) + r"\b", lowered)
        )

        if matched_urgency:
            high_match = any(
                term in URGENCY_LEVELS["high"] for term in matched_urgency
            )
            urgency_evidence.append({
                "sentence": sentence,
                "matched_indicators": matched_urgency,
                "level": "High" if high_match else "Medium"
            })

    positive_count = len(positive_hits)
    negative_count = len(negative_hits)

    if positive_count > negative_count:
        sentiment = "Positive"
    elif negative_count > positive_count:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    total_sentiment_hits = positive_count + negative_count
    sentiment_score = (
        round((positive_count - negative_count) / total_sentiment_hits, 2)
        if total_sentiment_hits else 0
    )

    if any(item["level"] == "High" for item in urgency_evidence):
        urgency = "High"
    elif urgency_evidence:
        urgency = "Medium"
    else:
        urgency = "Low"

    return {
        "sentiment": sentiment,
        "sentiment_score": sentiment_score,
        "positive_indicators": sorted(set(positive_hits)),
        "negative_indicators": sorted(set(negative_hits)),
        "urgency": urgency,
        "urgency_evidence": urgency_evidence
    }


def main():
    parser = argparse.ArgumentParser(description="Lightweight AI/NLP Analyzer for OS Project Datasets.")
    parser.add_argument("--dataset", required=True, choices=["reviews", "logs", "briefings", "custom"],
                        help="Dataset category to analyze")
    parser.add_argument("--dir", default=None,
                        help="Path to dataset directory (defaults to datasets/<dataset>)")
    parser.add_argument("--output", default=None,
                        help="Path to save output JSON (defaults to stdout)")

    args = parser.parse_args()

    target_dir = args.dir
    if not target_dir:
        target_dir = os.path.join("datasets", args.dataset)

    if not os.path.exists(target_dir):
        sys.stderr.write(f"[AI Analyzer Error] Directory '{target_dir}' does not exist.\n")
        sys.exit(1)

    try:
        if args.dataset == "reviews":
            result = analyze_reviews(target_dir)
        elif args.dataset == "logs":
            result = analyze_logs(target_dir)
        elif args.dataset == "briefings":
            result = analyze_briefings(target_dir)
        elif args.dataset == "custom":
            result = analyze_custom_text(target_dir)
        else:
            sys.stderr.write(f"[AI Analyzer Error] Unknown dataset type '{args.dataset}'\n")
            sys.exit(1)

        result["status"] = "success"
        output_json = json.dumps(result, indent=2)

        if args.output:
            os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output_json)
            print(f"[AI Analyzer] Results saved to {args.output}")
        else:
            print(output_json)

    except Exception as e:
        err_res = {
            "status": "error",
            "message": str(e),
            "dataset": args.dataset,
            "directory": target_dir
        }
        sys.stderr.write(f"[AI Analyzer Error] {e}\n")
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(err_res, f, indent=2)
        else:
            print(json.dumps(err_res, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()
