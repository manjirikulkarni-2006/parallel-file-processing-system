/**
 * server.js
 * Express.js Backend Server for Operating Systems Course Project:
 * "Parallel File Processing System with CPU Scheduling and AI Insights"
 *
 * Exposes REST APIs for:
 *   - Application health and system diagnostic metrics
 *   - Dataset discovery and statistics
 *   - Invoking the C file processing engine (sequential, pipes, shared memory)
 *   - Running full multi-mode benchmark comparisons
 *   - Running CPU scheduling simulations (FCFS, Priority, Round Robin)
 *   - Running the Python AI dataset analyzer
 *   - Retrieving latest run and benchmark results
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

const scheduler = require('./web/scheduler.js');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Directory constants
const ROOT_DIR = __dirname;
const ENGINE_BIN = path.join(ROOT_DIR, 'engine', 'bin', 'engine');
const DATASETS_DIR = path.join(ROOT_DIR, 'datasets');
const RESULTS_DIR = path.join(ROOT_DIR, 'results');
const AI_SCRIPT = path.join(ROOT_DIR, 'ai', 'analyzer.py');

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(ROOT_DIR, 'web')));

// Helper: execute child process safely with argument array
function runExecutable(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(executable, args, { cwd: ROOT_DIR, maxBuffer: 10 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
            if (error) {
                return reject({
                    error,
                    stderr: stderr ? stderr.toString() : '',
                    stdout: stdout ? stdout.toString() : ''
                });
            }
            resolve({
                stdout: stdout ? stdout.toString() : '',
                stderr: stderr ? stderr.toString() : ''
            });
        });
    });
}

const MAX_UPLOAD_FILES = 100;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: MAX_UPLOAD_FILES
    },
    fileFilter: (req, file, callback) => {
        if (path.extname(file.originalname).toLowerCase() !== '.txt') {
            return callback(new Error('Only .txt files are allowed.'));
        }
        callback(null, true);
    }
});

function receiveCustomFiles(req, res, next) {
    upload.array('files', MAX_UPLOAD_FILES)(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                error: err.code === 'LIMIT_FILE_SIZE'
                    ? 'Each uploaded file must be 10 MB or smaller.'
                    : err.code === 'LIMIT_FILE_COUNT'
                        ? `Upload no more than ${MAX_UPLOAD_FILES} files.`
                        : err.message || 'Upload failed.'
            });
        }
        next();
    });
}

function stageCustomFiles(files) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error('Select at least one .txt file.');
    }

    if (files.length > MAX_UPLOAD_FILES) {
        throw new Error(`Upload no more than ${MAX_UPLOAD_FILES} files.`);
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > MAX_UPLOAD_BYTES) {
        throw new Error('The combined upload size must not exceed 10 MB.');
    }

    const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'os-custom-'));

    try {
        files.forEach((file, index) => {
            if (path.extname(file.originalname).toLowerCase() !== '.txt') {
                throw new Error('Only .txt files are allowed.');
            }

            // Generated names prevent path traversal and filename collisions.
            const safeName = `file_${String(index + 1).padStart(3, '0')}.txt`;
            fs.writeFileSync(path.join(stagingDir, safeName), file.buffer, {
                flag: 'wx'
            });
        });

        return {
            directory: stagingDir,
            cleanup: () => fs.rmSync(stagingDir, { recursive: true, force: true }),
            fileCount: files.length,
            totalBytes
        };
    } catch (err) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
        throw err;
    }
}

// Helper: Scan dataset directory stats
function getDatasetStats(subDir) {
    const fullPath = path.join(DATASETS_DIR, subDir);
    if (!fs.existsSync(fullPath)) {
        return { exists: false, count: 0, totalBytes: 0, path: fullPath };
    }
    const files = fs.readdirSync(fullPath).filter(f => f.endsWith('.txt'));
    let totalBytes = 0;
    for (const f of files) {
        try {
            const st = fs.statSync(path.join(fullPath, f));
            totalBytes += st.size;
        } catch (_) {}
    }
    return { exists: true, count: files.length, totalBytes, path: fullPath };
}

/* ========================================================================= */
/* API ROUTES                                                                */
/* ========================================================================= */

// 1. Health Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        node: process.version,
        engine_compiled: fs.existsSync(ENGINE_BIN)
    });
});

// 2. System Diagnostic Information
app.get('/api/system', (req, res) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    let isWsl = false;
    let kernelInfo = os.release();

    try {
        const procVersion = fs.readFileSync('/proc/version', 'utf8');
        if (/microsoft/i.test(procVersion)) {
            isWsl = true;
        }
    } catch (_) {}

    res.json({
        platform: os.platform(),
        release: kernelInfo,
        arch: os.arch(),
        is_wsl: isWsl,
        cpu_model: cpus.length > 0 ? cpus[0].model : 'Unknown CPU',
        cpu_cores: cpus.length,
        total_memory_mb: Math.round(totalMem / (1024 * 1024)),
        free_memory_mb: Math.round(freeMem / (1024 * 1024)),
        engine_binary_present: fs.existsSync(ENGINE_BIN),
        environment: isWsl ? 'WSL2 Ubuntu' : (os.platform() === 'linux' ? 'Linux' : os.platform())
    });
});

// 3. Available Datasets
app.get('/api/datasets', (req, res) => {
    const categories = [
        { id: 'reviews', name: 'Customer Reviews', description: 'Product reviews with ratings, sentiments, and text feedback' },
        { id: 'logs', name: 'Server Diagnostic Logs', description: 'Real-time telemetry streams with INFO/WARN/ERROR/CRITICAL & latency' },
        { id: 'briefings', name: 'Executive Briefings', description: 'Structured technical briefings on systems engineering topics' }
    ];

    const datasets = categories.map(cat => {
        const stats = getDatasetStats(cat.id);
        return {
            ...cat,
            fileCount: stats.count,
            totalBytes: stats.totalBytes,
            totalSizeFormatted: `${(stats.totalBytes / (1024 * 1024)).toFixed(2)} MB`,
            isReady: stats.count > 0,
            path: `datasets/${cat.id}`
        };
    });

    res.json({
        status: 'success',
        datasets,
        totalDatasets: datasets.length
    });
});

// 4. Run Single Processing Mode
app.post('/api/process', receiveCustomFiles, async (req, res) => {
    let staged = null;

    try {
        const { dataset, mode, workers } = req.body || {};
        const custom = req.body?.source === 'custom';

        const validModes = ['sequential', 'pipes', 'shared_memory'];
        if (!validModes.includes(mode)) {
            return res.status(400).json({ error: `Invalid mode '${mode}'.` });
        }

        const workerCount = Math.max(1, Math.min(32, parseInt(workers, 10) || os.cpus().length || 4));

        let datasetDir;
        let datasetLabel;

        if (custom) {
            staged = stageCustomFiles(req.files);
            datasetDir = staged.directory;
            datasetLabel = 'custom';
        } else {
            const validDatasets = ['reviews', 'logs', 'briefings'];
            if (!validDatasets.includes(dataset)) {
                return res.status(400).json({ error: `Invalid dataset '${dataset}'.` });
            }

            datasetDir = path.join(DATASETS_DIR, dataset);
            datasetLabel = dataset;

            if (!fs.existsSync(datasetDir) ||
                fs.readdirSync(datasetDir).filter(f => f.endsWith('.txt')).length === 0) {
                return res.status(400).json({ error: `Dataset '${dataset}' is empty. Generate datasets first.` });
            }
        }

        if (!fs.existsSync(ENGINE_BIN)) {
            return res.status(500).json({ error: "C engine binary not compiled. Run 'make' in the project root." });
        }

        const runId = `run_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const resultFile = path.join(RESULTS_DIR, `${runId}.json`);

        await runExecutable(ENGINE_BIN, [
            '--mode', mode,
            '--dir', datasetDir,
            '--workers', workerCount.toString(),
            '--output', resultFile,
            '--json'
        ]);

        if (!fs.existsSync(resultFile)) {
            throw new Error('Processing completed but result file was not created.');
        }

        const summary = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
        summary.runId = runId;
        summary.timestamp = new Date().toISOString();
        summary.dataset = datasetLabel;
        if (custom) {
            summary.custom_upload = {
                file_count: staged.fileCount,
                total_bytes: staged.totalBytes
            };
        }

        fs.writeFileSync(resultFile, JSON.stringify(summary, null, 2), 'utf8');
        return res.json({ status: 'success', data: summary });
    } catch (err) {
        console.error('Error running engine:', err);
        return res.status(err.statusCode || 500).json({
            error: err.message === 'Only .txt files are allowed.' ||
                   err.message === 'Select at least one .txt file.' ||
                   err.message.includes('upload') ||
                   err.message.includes('Upload')
                ? err.message
                : 'Failed to execute processing engine',
            details: err.stderr || err.message || String(err)
        });
    } finally {
        if (staged) staged.cleanup();
    }
});

// 5. Run Full Benchmark Comparison (Sequential vs Pipes vs Shared Memory)
app.post('/api/benchmark', receiveCustomFiles, async (req, res) => {
    let staged = null;
    const tempFiles = [];

    try {
        const { dataset } = req.body || {};
        const custom = req.body?.source === 'custom';

        let datasetDir;
        let datasetLabel;

        if (custom) {
            staged = stageCustomFiles(req.files);
            datasetDir = staged.directory;
            datasetLabel = 'custom';
        } else {
            const validDatasets = ['reviews', 'logs', 'briefings'];
            if (!validDatasets.includes(dataset)) {
                return res.status(400).json({ error: `Invalid dataset '${dataset}'.` });
            }

            datasetDir = path.join(DATASETS_DIR, dataset);
            datasetLabel = dataset;

            if (!fs.existsSync(datasetDir)) {
                return res.status(400).json({ error: `Dataset '${dataset}' does not exist.` });
            }
        }

        if (!fs.existsSync(ENGINE_BIN)) {
            return res.status(500).json({
                error: "C engine binary not found. Please compile with 'make'."
            });
        }

        const txtFiles = fs.readdirSync(datasetDir)
            .filter(name => name.toLowerCase().endsWith('.txt'))
            .filter(name => {
                try {
                    return fs.statSync(path.join(datasetDir, name)).isFile();
                } catch {
                    return false;
                }
            });

        if (txtFiles.length === 0) {
            return res.status(400).json({ error: 'The selected dataset has no .txt files.' });
        }

        const benchmarkId = `benchmark_${Date.now()}`;
        const maxWorkers = Math.max(
            1,
            Math.min(16, os.cpus().length || 1, txtFiles.length)
        );

        const candidates = [];
        for (let n = 1; n <= maxWorkers; n *= 2) {
            candidates.push(n);
        }
        if (candidates[candidates.length - 1] !== maxWorkers) {
            candidates.push(maxWorkers);
        }

        const runEngine = async (mode, workers, label) => {
            const output = path.join(
                RESULTS_DIR,
                `${benchmarkId}_${label}_${Date.now()}_${Math.random().toString(16).slice(2)}.json`
            );
            tempFiles.push(output);

            const args = [
                '--mode', mode,
                '--dir', datasetDir,
                '--output', output,
                '--json'
            ];

            if (mode !== 'sequential') {
                args.push('--workers', String(workers));
            }

            await runExecutable(ENGINE_BIN, args);

            if (!fs.existsSync(output)) {
                throw new Error(`${mode} (${workers} workers) did not produce JSON output.`);
            }

            const result = JSON.parse(fs.readFileSync(output, 'utf8'));

            if (
                result.success !== true ||
                !Number.isFinite(Number(result.elapsed_time_sec)) ||
                Number(result.elapsed_time_sec) <= 0 ||
                !Number.isFinite(Number(result.files_processed)) ||
                !Number.isFinite(Number(result.total_bytes)) ||
                result.total_checksum == null ||
                Number(result.files_failed) !== 0 ||
                Number(result.files_processed) !== txtFiles.length
            ) {
                throw new Error(
                    `${mode} (${workers} workers) returned incomplete or failed metrics.`
                );
            }

            return result;
        };

        const seqResult = await runEngine('sequential', 1, 'seq');

        const validateAgainstBaseline = result =>
            Number(result.files_processed) === Number(seqResult.files_processed) &&
            Number(result.total_bytes) === Number(seqResult.total_bytes) &&
            String(result.total_checksum) === String(seqResult.total_checksum) &&
            Number(result.files_failed) === 0;

        const benchmarkMode = async mode => {
            const measurements = [];

            for (const workers of candidates) {
                const runs = [];

                // Repeat each candidate twice and use the median runtime.
                for (let repeat = 0; repeat < 2; repeat++) {
                    const result = await runEngine(
                        mode,
                        workers,
                        `${mode}_${workers}_${repeat + 1}`
                    );

                    if (!validateAgainstBaseline(result)) {
                        throw new Error(
                            `${mode} (${workers} workers) failed validation against sequential baseline.`
                        );
                    }

                    runs.push(result);
                }

                const times = runs
                    .map(result => Number(result.elapsed_time_sec))
                    .sort((x, y) => x - y);

                const medianTime = (times[0] + times[1]) / 2;

                measurements.push({
                    workers,
                    elapsed_time_sec: medianTime,
                    result: runs[1]
                });
            }

            measurements.sort(
                (x, y) => x.elapsed_time_sec - y.elapsed_time_sec
            );

            return {
                best: measurements[0],
                measurements
            };
        };

        const pipeOptimization = await benchmarkMode('pipes');
        const shmOptimization = await benchmarkMode('shared_memory');

        const pipeResult = pipeOptimization.best.result;
        const shmResult = shmOptimization.best.result;

        const seqTime = Number(seqResult.elapsed_time_sec);
        const pipeTime = Number(pipeOptimization.best.elapsed_time_sec);
        const shmTime = Number(shmOptimization.best.elapsed_time_sec);

        const benchmarkComparison = {
            benchmarkId,
            dataset: datasetLabel,
            timestamp: new Date().toISOString(),
            num_workers: {
                sequential: 1,
                pipes: pipeOptimization.best.workers,
                shared_memory: shmOptimization.best.workers
            },
            worker_optimization: {
                candidate_workers: candidates,
                selection_metric: 'median elapsed_time_sec across 2 runs',
                pipes: pipeOptimization.measurements.map(m => ({
                    workers: m.workers,
                    median_elapsed_time_sec: Number(m.elapsed_time_sec.toFixed(6))
                })),
                shared_memory: shmOptimization.measurements.map(m => ({
                    workers: m.workers,
                    median_elapsed_time_sec: Number(m.elapsed_time_sec.toFixed(6))
                }))
            },
            validation: {
                consistent: validateAgainstBaseline(pipeResult) &&
                    validateAgainstBaseline(shmResult),
                checksums_match: String(seqResult.total_checksum) ===
                    String(pipeResult.total_checksum) &&
                    String(seqResult.total_checksum) === String(shmResult.total_checksum),
                counts_match: Number(seqResult.files_processed) ===
                    Number(pipeResult.files_processed) &&
                    Number(seqResult.files_processed) === Number(shmResult.files_processed) &&
                    Number(seqResult.total_bytes) === Number(pipeResult.total_bytes) &&
                    Number(seqResult.total_bytes) === Number(shmResult.total_bytes),
                total_checksum: seqResult.total_checksum,
                total_files: seqResult.files_processed,
                total_bytes: seqResult.total_bytes
            },
            modes: {
                sequential: { ...seqResult, speedup: 1.00 },
                pipes: {
                    ...pipeResult,
                    num_workers: pipeOptimization.best.workers,
                    elapsed_time_sec: pipeTime,
                    throughput_fps: Number((pipeResult.files_processed / pipeTime).toFixed(2)),
                    speedup: Number((seqTime / pipeTime).toFixed(2))
                },
                shared_memory: {
                    ...shmResult,
                    num_workers: shmOptimization.best.workers,
                    elapsed_time_sec: shmTime,
                    throughput_fps: Number((shmResult.files_processed / shmTime).toFixed(2)),
                    speedup: Number((seqTime / shmTime).toFixed(2))
                }
            }
        };

        if (!benchmarkComparison.validation.consistent) {
            throw new Error('Final benchmark results did not pass validation.');
        }

        if (custom) {
            benchmarkComparison.custom_upload = {
                file_count: staged.fileCount,
                total_bytes: staged.totalBytes
            };
        }

        fs.writeFileSync(
            path.join(RESULTS_DIR, `${benchmarkId}_summary.json`),
            JSON.stringify(benchmarkComparison, null, 2),
            'utf8'
        );

        return res.json({ status: 'success', data: benchmarkComparison });
    } catch (err) {
        console.error('Error running benchmark:', err);
        return res.status(500).json({
            error: 'Failed to execute benchmark suite',
            details: err.stderr || err.message || String(err)
        });
    } finally {
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            } catch (cleanupError) {
                console.warn('Could not remove temporary benchmark file:', cleanupError.message);
            }
        }
        if (staged) staged.cleanup();
    }
});

// 6. Retrieve Latest Run or Benchmark Result
app.get('/api/results/latest', (req, res) => {
    try {
        if (!fs.existsSync(RESULTS_DIR)) {
            return res.json({ status: 'empty', message: 'No run records available.' });
        }

        const files = fs.readdirSync(RESULTS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => ({
                name: f,
                fullPath: path.join(RESULTS_DIR, f),
                mtime: fs.statSync(path.join(RESULTS_DIR, f)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);

        if (files.length === 0) {
            return res.json({ status: 'empty', message: 'No run records available.' });
        }

        const latestFile = files[0];
        const raw = fs.readFileSync(latestFile.fullPath, 'utf8');
        const data = JSON.parse(raw);

        res.json({
            status: 'success',
            file: latestFile.name,
            timestamp: latestFile.mtime,
            data
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to retrieve latest result', details: err.message });
    }
});

// 7. List Historical Results
app.get('/api/results', (req, res) => {
    try {
        if (!fs.existsSync(RESULTS_DIR)) {
            return res.json({ status: 'success', results: [] });
        }

        const files = fs.readdirSync(RESULTS_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const fullPath = path.join(RESULTS_DIR, f);
                const stat = fs.statSync(fullPath);
                let meta = {};
                try {
                    const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    meta = {
                        mode: parsed.mode || (parsed.benchmarkId ? 'benchmark' : 'unknown'),
                        dataset: parsed.dataset || path.basename(parsed.dataset_dir || ''),
                        workers: parsed.num_workers || 1,
                        files_processed: parsed.files_processed || parsed.validation?.total_files || 0,
                        elapsed_time_sec: parsed.elapsed_time_sec || null
                    };
                } catch (_) {}

                return {
                    filename: f,
                    timestamp: stat.mtime,
                    sizeBytes: stat.size,
                    ...meta
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);

        res.json({ status: 'success', count: files.length, results: files });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list results', details: err.message });
    }
});

// 8. CPU Scheduling Simulation
app.post('/api/simulate', (req, res) => {
    try {
        const { algorithm, processes, quantum } = req.body;

        if (!algorithm) {
            return res.status(400).json({ error: "Missing required parameter: 'algorithm'." });
        }
        if (!processes || !Array.isArray(processes) || processes.length === 0) {
            return res.status(400).json({ error: "Parameter 'processes' must be a non-empty array." });
        }

        let result;
        const algoLower = algorithm.toLowerCase().trim();

        if (algoLower === 'fcfs') {
            result = scheduler.scheduleFCFS(processes);
        } else if (algoLower === 'priority') {
            result = scheduler.schedulePriority(processes);
        } else if (algoLower === 'rr' || algoLower === 'round_robin') {
            const q = Number(quantum) || 2;
            result = scheduler.scheduleRoundRobin(processes, q);
        } else {
            return res.status(400).json({
                error: `Unknown algorithm '${algorithm}'. Choose from: 'fcfs', 'priority', 'rr'.`
            });
        }

        res.json({
            status: 'success',
            simulation: result
        });
    } catch (err) {
        res.status(400).json({
            error: 'Scheduling simulation failed',
            details: err.message
        });
    }
});


/* 9. Python AI Dataset Analysis */
app.post('/api/analyze', receiveCustomFiles, async (req, res) => {
    let staged = null;

    try {
        const source = req.body.source;
        let dataset;
        let datasetDir;

        if (source === 'custom') {
            staged = stageCustomFiles(req.files);
            dataset = 'custom';
            datasetDir = staged.directory;
        } else {
            dataset = req.body.dataset;
            const validDatasets = ['reviews', 'logs', 'briefings'];

            if (!validDatasets.includes(dataset)) {
                return res.status(400).json({
                    error: `Invalid dataset '${dataset}'. Must be one of: ${validDatasets.join(', ')}`
                });
            }

            datasetDir = path.join(DATASETS_DIR, dataset);

            if (
                !fs.existsSync(datasetDir) ||
                !fs.readdirSync(datasetDir).some(
                    f => f.toLowerCase().endsWith('.txt')
                )
            ) {
                return res.status(400).json({
                    error: `Dataset '${dataset}' contains no .txt files. Generate datasets first.`
                });
            }
        }

        const args = [
            AI_SCRIPT,
            '--dataset', dataset,
            '--dir', datasetDir
        ];

        const { stdout } = await runExecutable('python3', args);
        const analysis = JSON.parse(stdout);

        res.json({
            status: 'success',
            dataset,
            source: source === 'custom' ? 'custom' : 'builtin',
            ...(staged ? {
                uploadedFiles: staged.fileCount,
                uploadedBytes: staged.totalBytes
            } : {}),
            data: analysis
        });
    } catch (err) {
        console.error('AI Analysis error:', err);

        const message = err.stderr || err.message || String(err);
        const statusCode = err.message && (
            err.message.includes('Select at least one') ||
            err.message.includes('Upload no more than') ||
            err.message.includes('combined upload size') ||
            err.message.includes('Only .txt')
        ) ? 400 : 500;

        res.status(statusCode).json({
            error: statusCode === 400
                ? message
                : 'Failed to run AI analyzer',
            details: message
        });
    } finally {
        if (staged) {
            try {
                staged.cleanup();
            } catch (cleanupError) {
                console.error('Failed to clean up AI upload:', cleanupError);
            }
        }
    }
});


/* ========================================================================= */
/* STATIC SERVE & FALLBACK                                                   */
/* ========================================================================= */

app.get('*', (req, res) => {
    res.sendFile(path.join(ROOT_DIR, 'web', 'index.html'));
});

// Start listening
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=============================================================`);
    console.log(` Operating Systems Project Server running on port ${PORT}`);
    console.log(` Access Dashboard locally: http://localhost:${PORT}`);
    console.log(` Windows Browser (WSL2):   http://127.0.0.1:${PORT}`);
    console.log(`=============================================================`);
});
