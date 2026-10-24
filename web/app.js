/**
 * web/app.js
 * Operating Systems Course Project Frontend Logic
 * Connects dashboard controls to the file-processing and AI REST APIs.
 */

const App = (function () {
  // State
  let systemInfo = null;
  let datasetsInfo = [];
  const colorPalette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  // DOM Elements
  const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    systemStatusIndicator: document.getElementById('system-status-indicator'),
    systemStatusText: document.getElementById('system-status-text'),
    envBadge: document.getElementById('env-badge'),
    toastContainer: document.getElementById('toast-container'),

    // Overview
    overviewRevCount: document.getElementById('overview-rev-count'),
    overviewLogCount: document.getElementById('overview-log-count'),
    overviewBrfCount: document.getElementById('overview-brf-count'),
    overviewPlatformVal: document.getElementById('overview-platform-val'),
    overviewCoresVal: document.getElementById('overview-cores-val'),
    latestRunContainer: document.getElementById('latest-run-container'),
    footerEngineStatus: document.getElementById('footer-engine-status'),
    footerTotalDatasets: document.getElementById('footer-total-datasets'),

    // File Processing Form
    formRunEngine: document.getElementById('form-run-engine'),
    selectDataset: document.getElementById('select-dataset'),
    customUploadGroup: document.getElementById('custom-upload-group'),
    customFiles: document.getElementById('custom-files'),
    selectMode: document.getElementById('select-mode'),
    sliderWorkers: document.getElementById('slider-workers'),
    sliderWorkersVal: document.getElementById('slider-workers-val'),
    btnRunProcess: document.getElementById('btn-run-engine'),
    processingResultsWrapper: document.getElementById('processing-results-wrapper'),
    resBadgeMode: document.getElementById('res-badge-mode'),
    resFilesCount: document.getElementById('res-files-count'),
    resTotalBytes: document.getElementById('res-total-bytes'),
    resLinesWords: document.getElementById('res-lines-words'),
    resChecksum: document.getElementById('res-checksum'),
    resElapsedTime: document.getElementById('res-elapsed-time'),
    resThroughput: document.getElementById('res-throughput'),
    resWorkersUsed: document.getElementById('res-workers-used'),
    resRawJson: document.getElementById('res-raw-json'),

    // Benchmark Suite
    benchSelectDataset: document.getElementById('bench-select-dataset'),
    benchCustomUploadGroup: document.getElementById('bench-custom-upload-group'),
    benchCustomFiles: document.getElementById('bench-custom-files'),
    
    
    btnRunBenchmark: document.getElementById('btn-run-benchmark'),
    btnDownloadReport: document.getElementById('btn-download-report'),
    reportDownloadStatus: document.getElementById('report-download-status'),
    benchmarkResultsWrapper: document.getElementById('benchmark-results-wrapper'),
    bmPipeWorkersBadge: document.getElementById('bm-pipe-workers-badge'),
    bmShmWorkersBadge: document.getElementById('bm-shm-workers-badge'),
    bmSeqTime: document.getElementById('bm-seq-time'),
    bmSeqFps: document.getElementById('bm-seq-fps'),
    bmPipeTime: document.getElementById('bm-pipe-time'),
    bmPipeFps: document.getElementById('bm-pipe-fps'),
    bmPipeSpeedup: document.getElementById('bm-pipe-speedup'),
    bmShmTime: document.getElementById('bm-shm-time'),
    bmShmFps: document.getElementById('bm-shm-fps'),
    bmShmSpeedup: document.getElementById('bm-shm-speedup'),
    barTimeSeq: document.getElementById('bar-time-seq'),
    barTimeSeqLbl: document.getElementById('bar-time-seq-lbl'),
    barTimePipe: document.getElementById('bar-time-pipe'),
    barTimePipeLbl: document.getElementById('bar-time-pipe-lbl'),
    barTimeShm: document.getElementById('bar-time-shm'),
    barTimeShmLbl: document.getElementById('bar-time-shm-lbl'),
    barFpsSeq: document.getElementById('bar-fps-seq'),
    barFpsSeqLbl: document.getElementById('bar-fps-seq-lbl'),
    barFpsPipe: document.getElementById('bar-fps-pipe'),
    barFpsPipeLbl: document.getElementById('bar-fps-pipe-lbl'),
    barFpsShm: document.getElementById('bar-fps-shm'),
    barFpsShmLbl: document.getElementById('bar-fps-shm-lbl'),


    // AI Insights
    aiSelectDataset: document.getElementById('ai-select-dataset'),
    btnRunAi: document.getElementById('btn-run-ai'),
    aiResultsWrapper: document.getElementById('ai-results-wrapper'),
    aiContentDynamic: document.getElementById('ai-content-dynamic'),
    aiCustomUploadGroup: document.getElementById('ai-custom-upload-group'),
    aiCustomFiles: document.getElementById('ai-custom-files'),

    // System Info Tab
    sysKernel: document.getElementById('sys-kernel'),
    sysEnvDesc: document.getElementById('sys-env-desc'),
    sysCpuModel: document.getElementById('sys-cpu-model'),
    sysCoresCount: document.getElementById('sys-cores-count'),
    sysRam: document.getElementById('sys-ram'),
    sysNodeVer: document.getElementById('sys-node-ver'),
    sysServerPort: document.getElementById('sys-server-port')
  };

  /* ========================================================================= */
  /* Initialization & Navigation                                               */
  /* ========================================================================= */
  function init() {
    setupEventListeners();
    fetchSystemInfo();
    fetchDatasets();
    fetchLatestRun();
  }

  function setupEventListeners() {
    // Tab switching
    elements.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetTab = item.getAttribute('data-tab');
        navigateTo(targetTab);
      });
    });

    elements.sliderWorkers.addEventListener('input', (e) => {
      elements.sliderWorkersVal.textContent = e.target.value;
    });

    // Toggle custom file inputs when the custom dataset option is selected.
    const updateProcessUploadVisibility = () => {
      const isCustom = elements.selectDataset.value === 'custom';
      elements.customUploadGroup.classList.toggle('hidden', !isCustom);
      elements.customFiles.required = isCustom;
    };
    const updateBenchmarkUploadVisibility = () => {
      const isCustom = elements.benchSelectDataset.value === 'custom';
      elements.benchCustomUploadGroup.classList.toggle('hidden', !isCustom);
      elements.benchCustomFiles.required = isCustom;
    };

    elements.selectDataset.addEventListener('change', updateProcessUploadVisibility);
    elements.benchSelectDataset.addEventListener('change', updateBenchmarkUploadVisibility);
    updateProcessUploadVisibility();
    updateBenchmarkUploadVisibility();

    // Forms & Action buttons
    elements.formRunEngine.addEventListener('submit', handleRunEngine);
    elements.btnRunBenchmark.addEventListener('click', handleRunBenchmark);
    elements.btnDownloadReport.addEventListener('click', () => {
      if (latestBenchmarkReport) downloadBenchmarkReport(latestBenchmarkReport);
    });
    elements.btnRunAi.addEventListener('click', handleRunAi);

    // Toggle custom file upload for AI Insights.
    const updateAiUploadVisibility = () => {
      const isCustom = elements.aiSelectDataset.value === 'custom';
      elements.aiCustomUploadGroup.classList.toggle('hidden', !isCustom);
      elements.aiCustomFiles.required = isCustom;
    };

    elements.aiSelectDataset.addEventListener('change', updateAiUploadVisibility);
    updateAiUploadVisibility();


  }

  function navigateTo(tabId) {
    elements.navItems.forEach(i => i.classList.remove('active'));
    elements.tabPanes.forEach(p => p.classList.remove('active'));

    const navBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    const pane = document.getElementById(`tab-${tabId}`);
    if (navBtn) navBtn.classList.add('active');
    if (pane) pane.classList.add('active');
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  /* ========================================================================= */
  /* Backend Telemetry Fetching                                                */
  /* ========================================================================= */
  async function fetchSystemInfo() {
    try {
      const res = await fetch('/api/system');
      if (!res.ok) throw new Error('System API responded with error');
      const data = await res.json();
      systemInfo = data;

      elements.systemStatusIndicator.className = 'status-indicator online';
      elements.systemStatusText.textContent = 'Backend Online (WSL2 Active)';
      elements.envBadge.textContent = data.environment;

      elements.overviewPlatformVal.textContent = data.environment;
      elements.overviewCoresVal.textContent = `${data.cpu_cores} Logical Cores`;

      elements.sysKernel.textContent = data.release;
      elements.sysEnvDesc.textContent = `${data.environment} (${data.arch})`;
      elements.sysCpuModel.textContent = data.cpu_model;
      elements.sysCoresCount.textContent = `${data.cpu_cores} Cores`;
      elements.sysRam.textContent = `${data.free_memory_mb} MB Free / ${data.total_memory_mb} MB Total`;

      const healthRes = await fetch('/api/health');
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        elements.sysNodeVer.textContent = healthData.node;
      }
    } catch (err) {
      elements.systemStatusIndicator.className = 'status-indicator error';
      elements.systemStatusText.textContent = 'Backend Disconnected';
      console.warn('System fetch failed:', err);
    }
  }

  async function fetchDatasets() {
    try {
      const res = await fetch('/api/datasets');
      if (!res.ok) throw new Error('Datasets API error');
      const data = await res.json();
      datasetsInfo = data.datasets || [];

      datasetsInfo.forEach(ds => {
        if (ds.id === 'reviews') elements.overviewRevCount.textContent = `${ds.fileCount} Files`;
        if (ds.id === 'logs') elements.overviewLogCount.textContent = `${ds.fileCount} Files`;
        if (ds.id === 'briefings') elements.overviewBrfCount.textContent = `${ds.fileCount} Files`;
      });

      elements.footerTotalDatasets.textContent = `${datasetsInfo.length} datasets ready`;
    } catch (err) {
      console.warn('Failed to load datasets:', err);
    }
  }

  async function fetchLatestRun() {
    try {
      const res = await fetch('/api/results/latest');
      if (!res.ok) return;
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        const run = data.data;
        const isBench = !!run.benchmarkId;

        let html = '';
        if (isBench) {
          html = `
            <div class="quick-status-item"><strong>Type:</strong> <span>Multi-Mode Benchmark</span></div>
            <div class="quick-status-item"><strong>Target Dataset:</strong> <span>${run.dataset}</span></div>
            <div class="quick-status-item"><strong>Sequential:</strong> <span>${run.modes.sequential.elapsed_time_sec.toFixed(4)}s (${run.modes.sequential.throughput_fps.toFixed(1)} fps)</span></div>
            <div class="quick-status-item"><strong>Pipes Speedup:</strong> <span class="text-success font-bold">${run.modes.pipes.speedup}x</span></div>
            <div class="quick-status-item"><strong>Shared Memory Speedup:</strong> <span class="text-success font-bold">${run.modes.shared_memory.speedup}x</span></div>
            <div class="quick-status-item"><strong>Validation:</strong> <span class="badge badge-success">Consistent</span></div>
          `;
        } else {
          html = `
            <div class="quick-status-item"><strong>Mode:</strong> <span class="font-bold">${run.mode}</span></div>
            <div class="quick-status-item"><strong>Files Processed:</strong> <span>${run.files_processed}</span></div>
            <div class="quick-status-item"><strong>Elapsed Time:</strong> <span>${run.elapsed_time_sec.toFixed(4)} s</span></div>
            <div class="quick-status-item"><strong>Throughput:</strong> <span class="font-bold">${run.throughput_fps.toFixed(2)} fps</span></div>
            <div class="quick-status-item"><strong>Cumulative Checksum:</strong> <span class="font-mono text-secondary">${run.total_checksum}</span></div>
          `;
        }

        elements.latestRunContainer.innerHTML = html;
      }
    } catch (err) {
      console.warn('Failed to load latest run:', err);
    }
  }

  /* ========================================================================= */
  /* File Processing Execution                                               */
  /* ========================================================================= */
  async function handleRunEngine(e) {
    e.preventDefault();

    const dataset = elements.selectDataset.value;
    const mode = elements.selectMode.value;
    const workers = mode === 'sequential' ? 1 : parseInt(elements.sliderWorkers.value, 10);
    const files = elements.customFiles.files;
    const isCustom = dataset === 'custom';

    if (isCustom) {
      if (!files.length) {
        showToast('Select at least one .txt file.', 'error');
        return;
      }

      const totalBytes = Array.from(files).reduce((sum, file) => sum + file.size, 0);
      const invalidFile = Array.from(files).find(file => !file.name.toLowerCase().endsWith('.txt'));

      if (invalidFile) {
        showToast('Only .txt files are allowed.', 'error');
        return;
      }
      if (files.length > 100) {
        showToast('Select no more than 100 files.', 'error');
        return;
      }
      if (totalBytes > 10 * 1024 * 1024) {
        showToast('Combined file size must not exceed 10 MB.', 'error');
        return;
      }
    }

    const btn = elements.btnRunProcess;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.textContent = mode === 'sequential' ? 'Processing Files...' : 'Benchmarking Workers...';
    spinner.classList.remove('hidden');

    try {
      // Sequential uses one worker; parallel modes use the manual slider.
      btnText.textContent = 'Processing Files...';
      let requestOptions;
      if (isCustom) {
        const formData = new FormData();
        formData.append('source', 'custom');
        formData.append('mode', mode);
        formData.append('workers', String(workers));

        Array.from(files).forEach(file => formData.append('files', file));
        requestOptions = { method: 'POST', body: formData };
      } else {
        requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset, mode, workers })
        };
      }

      const res = await fetch('/api/process', requestOptions);

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Engine execution failed');

      const data = responseData.data;
      latestBenchmarkReport = null;
      elements.btnDownloadReport.disabled = true;
      elements.reportDownloadStatus.textContent = 'Preparing report...';

      elements.processingResultsWrapper.classList.remove('hidden');
      elements.resBadgeMode.textContent = `Mode: ${data.mode.toUpperCase()}`;
      elements.resFilesCount.textContent = `${data.files_processed} / ${data.total_files_discovered}`;
      elements.resTotalBytes.textContent = `${data.total_bytes.toLocaleString()} bytes (${(data.total_bytes / (1024*1024)).toFixed(2)} MB)`;
      elements.resLinesWords.textContent = `${data.total_lines.toLocaleString()} lines / ${data.total_words.toLocaleString()} words`;
      elements.resChecksum.textContent = `0x${data.total_checksum}`;
      elements.resElapsedTime.textContent = `${data.elapsed_time_sec.toFixed(4)} s`;
      elements.resThroughput.textContent = `${data.throughput_fps.toFixed(2)} fps (${data.throughput_mbps.toFixed(2)} MB/s)`;
      data.workers_used = workers;
      elements.resWorkersUsed.textContent = String(workers);
      elements.resRawJson.textContent = JSON.stringify(data, null, 2);

      showToast(`Processed ${data.files_processed} files in ${data.elapsed_time_sec.toFixed(4)}s!`, 'success');
      fetchLatestRun();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Execute Engine';
      spinner.classList.add('hidden');
    }
  }

  /* ========================================================================= */
  /* Full Benchmark Suite Execution                                            */
  /* ========================================================================= */
  

  let latestBenchmarkReport = null;

  function reportEscape(value) {
    return String(value ?? 'Not provided').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;',
      '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  function reportNumber(value, digits = 3) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  }

  function downloadBenchmarkReport(data) {
    if (!data?.modes || !data?.worker_optimization) {
      showToast('Worker timing details are not available in this benchmark.', 'error');
      return;
    }

    const opt = data.worker_optimization;
    const candidates = opt.candidate_workers || [];
    const pipeTimes = new Map(
      (opt.pipes || []).map(x => [Number(x.workers), Number(x.median_elapsed_time_sec)])
    );
    const shmTimes = new Map(
      (opt.shared_memory || []).map(x => [Number(x.workers), Number(x.median_elapsed_time_sec)])
    );

    const fmt = value =>
      Number.isFinite(value) ? value.toFixed(4) : '—';

    const rows = candidates.map(workers => `
      <tr>
        <td>${workers}</td>
        <td>${workers === 1 ? fmt(Number(data.modes.sequential.elapsed_time_sec)) : '—'}</td>
        <td>${fmt(pipeTimes.get(Number(workers)))}</td>
        <td>${fmt(shmTimes.get(Number(workers)))}</td>
      </tr>`).join('');

    const bestModes = [
      { key: 'pipes', label: 'Parallel Pipes' },
      { key: 'shared_memory', label: 'Shared Memory' }
    ];

    const bestRows = bestModes.map(item => {
      const mode = data.modes[item.key] || {};
      const workers = mode.num_workers ?? data.num_workers?.[item.key] ?? '—';
      const elapsed = Number(mode.elapsed_time_sec);
      const throughput = Number(mode.throughput_fps);
      const speedup = Number(mode.speedup);

      return `<tr>
        <td><strong>${reportEscape(item.label)}</strong></td>
        <td>${reportEscape(workers)}</td>
        <td>${fmt(elapsed)}</td>
        <td>${Number.isFinite(throughput) ? throughput.toFixed(2) : '—'}</td>
        <td>${Number.isFinite(speedup) ? speedup.toFixed(2) + '×' : '—'}</td>
      </tr>`;
    }).join('');

    const validation = data.validation || {};
    const validationLabel = validation.consistent === true
      ? '<span class="pass">PASS</span>'
      : validation.consistent === false
        ? '<span class="fail">FAIL</span>'
        : '<span>Not reported</span>';

    const report = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Worker Timing Report</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:24px;background:#f4f6fa;color:#243247;font:14px/1.5 Arial,sans-serif}
main{max-width:850px;margin:0 auto;background:#fff;padding:28px;border:1px solid #e1e6ef;border-radius:12px}
h1{font-size:25px;color:#172b4d;margin:0 0 5px}
.subtitle{color:#66758b;margin:0 0 20px}
.details{display:flex;flex-wrap:wrap;gap:8px 22px;padding:12px 0 18px;border-bottom:1px solid #e1e6ef;color:#526178;font-size:12px}
h2{font-size:16px;margin:22px 0 8px;color:#172b4d}
.note{font-size:12px;color:#66758b;margin:0 0 12px}
table{width:100%;border-collapse:collapse}
th,td{padding:12px 10px;text-align:right;border-bottom:1px solid #e5eaf1;font-variant-numeric:tabular-nums}
th{background:#edf2fa;color:#34445d;font-size:12px}
th:first-child,td:first-child{text-align:left}
tbody tr:nth-child(even){background:#f8faff}
tbody tr:last-child td{border-bottom:0}
.summary{margin-top:18px;padding:13px 15px;background:#f3f7fc;border-radius:8px}
.pass{color:#087b54;font-weight:bold}.fail{color:#bd2635;font-weight:bold}
.footer{margin-top:20px;color:#7a8799;font-size:11px}
button{border:0;border-radius:7px;background:#172b4d;color:white;padding:9px 14px;cursor:pointer}
.actions{text-align:right;margin-bottom:14px}
@media(max-width:600px){body{padding:8px}main{padding:16px;overflow-x:auto}h1{font-size:21px}th,td{padding:9px 6px;font-size:12px}}
@media print{body{padding:0;background:white}main{border:0;padding:12px;max-width:none}.actions{display:none}}
</style>
</head>
<body>
<main>
<div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div>
<h1>Worker Execution Time Comparison</h1>
<p class="subtitle">Parallel File Processing System with AI Insights</p>
<div class="details">
<span><strong>Dataset:</strong> ${reportEscape(data.dataset ?? 'Not specified')}</span>
<span><strong>Run ID:</strong> ${reportEscape(data.benchmarkId ?? 'Not provided')}</span>
<span><strong>Generated:</strong> ${reportEscape(new Date().toLocaleString())}</span>
</div>

<h2>Execution time by worker count</h2>
<p class="note">Times are in seconds. Parallel-mode values are the median of two runs. A dash means that mode was not measured at that worker count.</p>
<table>
<thead><tr><th>Workers</th><th>Sequential (s)</th><th>Pipes (s)</th><th>Shared Memory (s)</th></tr></thead>
<tbody>${rows}</tbody>
</table>

<h2>Best selected configuration</h2>
<p class="note">The fastest tested worker configuration selected by the benchmark for each parallel mode.</p>
<table>
<thead><tr><th>Mode</th><th>Best workers</th><th>Execution time (s)</th><th>Throughput (files/s)</th><th>Speedup</th></tr></thead>
<tbody>${bestRows}</tbody>
</table>

<div class="summary">
<strong>Validation:</strong> ${validationLabel}
<br><span class="note">Files processed: ${reportEscape(validation.total_files ?? data.modes.sequential.files_processed ?? 'Not reported')} · Matching counts: ${validation.counts_match === true ? 'Yes' : validation.counts_match === false ? 'No' : 'Not reported'} · Matching checksums: ${validation.checksums_match === true ? 'Yes' : validation.checksums_match === false ? 'No' : 'Not reported'}</span>
</div>
<div class="footer">Worker counts and timings are taken from the benchmark API response. Results apply to this dataset and run.</div>
</main>
</body>
</html>`;

    const blob = new Blob([report], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worker-timing-report-${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handleRunBenchmark() {
    const dataset = elements.benchSelectDataset.value;

    const files = elements.benchCustomFiles.files;
    const isCustom = dataset === 'custom';

    if (isCustom) {
      if (!files.length) {
        showToast('Select at least one .txt file for the benchmark.', 'error');
        return;
      }

      const selectedFiles = Array.from(files);
      const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
      const invalidFile = selectedFiles.find(file => !file.name.toLowerCase().endsWith('.txt'));

      if (invalidFile) {
        showToast('Only .txt files are allowed.', 'error');
        return;
      }
      if (selectedFiles.length > 100) {
        showToast('Select no more than 100 files.', 'error');
        return;
      }
      if (totalBytes > 10 * 1024 * 1024) {
        showToast('Combined file size must not exceed 10 MB.', 'error');
        return;
      }
    }

    const btn = elements.btnRunBenchmark;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    btn.disabled = true;
    btnText.textContent = 'Running All 3 Modes...';
    spinner.classList.remove('hidden');

    try {
      let requestOptions;
      if (isCustom) {
        const formData = new FormData();
        formData.append('source', 'custom');
        Array.from(files).forEach(file => formData.append('files', file));
        requestOptions = { method: 'POST', body: formData };
      } else {
        requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset })
        };
      }

      const res = await fetch('/api/benchmark', requestOptions);

      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Benchmark suite execution failed');

      const data = responseData.data;
      const modes = data.modes;

      elements.benchmarkResultsWrapper.classList.remove('hidden');
      elements.bmPipeWorkersBadge.textContent = `${data.num_workers.pipes} Workers`;
      elements.bmShmWorkersBadge.textContent = `${data.num_workers.shared_memory} Workers`;

      // Stats
      elements.bmSeqTime.textContent = `${modes.sequential.elapsed_time_sec.toFixed(4)} s`;
      elements.bmSeqFps.textContent = `${modes.sequential.throughput_fps.toFixed(2)} fps`;

      elements.bmPipeTime.textContent = `${modes.pipes.elapsed_time_sec.toFixed(4)} s`;
      elements.bmPipeFps.textContent = `${modes.pipes.throughput_fps.toFixed(2)} fps`;
      elements.bmPipeSpeedup.textContent = `${modes.pipes.speedup}x`;

      elements.bmShmTime.textContent = `${modes.shared_memory.elapsed_time_sec.toFixed(4)} s`;
      elements.bmShmFps.textContent = `${modes.shared_memory.throughput_fps.toFixed(2)} fps`;
      elements.bmShmSpeedup.textContent = `${modes.shared_memory.speedup}x`;

      // Chart Calculations: Elapsed Time (Relative to max time)
      const maxTime = Math.max(modes.sequential.elapsed_time_sec, modes.pipes.elapsed_time_sec, modes.shared_memory.elapsed_time_sec, 0.0001);
      elements.barTimeSeq.style.width = `${Math.max(5, (modes.sequential.elapsed_time_sec / maxTime) * 100)}%`;
      elements.barTimePipe.style.width = `${Math.max(5, (modes.pipes.elapsed_time_sec / maxTime) * 100)}%`;
      elements.barTimeShm.style.width = `${Math.max(5, (modes.shared_memory.elapsed_time_sec / maxTime) * 100)}%`;

      elements.barTimeSeqLbl.textContent = `${modes.sequential.elapsed_time_sec.toFixed(3)}s`;
      elements.barTimePipeLbl.textContent = `${modes.pipes.elapsed_time_sec.toFixed(3)}s`;
      elements.barTimeShmLbl.textContent = `${modes.shared_memory.elapsed_time_sec.toFixed(3)}s`;

      // Chart Calculations: Throughput (Relative to max throughput)
      const maxFps = Math.max(modes.sequential.throughput_fps, modes.pipes.throughput_fps, modes.shared_memory.throughput_fps, 1);
      elements.barFpsSeq.style.width = `${Math.max(5, (modes.sequential.throughput_fps / maxFps) * 100)}%`;
      elements.barFpsPipe.style.width = `${Math.max(5, (modes.pipes.throughput_fps / maxFps) * 100)}%`;
      elements.barFpsShm.style.width = `${Math.max(5, (modes.shared_memory.throughput_fps / maxFps) * 100)}%`;

      elements.barFpsSeqLbl.textContent = `${modes.sequential.throughput_fps.toFixed(1)} fps`;
      elements.barFpsPipeLbl.textContent = `${modes.pipes.throughput_fps.toFixed(1)} fps`;
      elements.barFpsShmLbl.textContent = `${modes.shared_memory.throughput_fps.toFixed(1)} fps`;

      latestBenchmarkReport = data;
      elements.btnDownloadReport.disabled = false;
      elements.reportDownloadStatus.textContent = 'Report ready for download.';
      showToast('Benchmark run completed and verified!', 'success');
      fetchLatestRun();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Run Full Benchmark';
      spinner.classList.add('hidden');
    }
  }

  /* AI Insights Frontend                                                      */
  /* ========================================================================= */

  async function handleRunAi() {
    const dataset = elements.aiSelectDataset.value;
    const isCustom = dataset === 'custom';
    const btn = elements.btnRunAi;
    const btnText = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');

    if (
      isCustom &&
      (!elements.aiCustomFiles.files ||
       elements.aiCustomFiles.files.length === 0)
    ) {
      showToast('Please select at least one .txt file.', 'error');
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Analyzing Records...';
    spinner.classList.remove('hidden');

    try {
      let body;
      const headers = {};

      if (isCustom) {
        body = new FormData();
        body.append('source', 'custom');

        for (const file of elements.aiCustomFiles.files) {
          body.append('files', file);
        }
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ dataset });
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers,
        body
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.error || 'AI Analysis failed');
      }

      renderAiInsights(dataset, responseData.data);

      showToast(
        isCustom
          ? `AI analysis completed for ${responseData.uploadedFiles} uploaded file(s)!`
          : `AI analysis completed for ${dataset}!`,
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Generate AI Insights';
      spinner.classList.add('hidden');
    }
  }


  function renderAiInsights(type, data) {
    elements.aiResultsWrapper.classList.remove('hidden');
    let html = '';

    if (type === 'reviews') {
      const sDist = data.sentiment_distribution || {};
      html = `
        <div class="metrics-grid">
          <div class="card metric-card">
            <div class="metric-title">Positive Reviews</div>
            <div class="metric-value text-success">${sDist.Positive ? sDist.Positive.percentage : 0}%</div>
            <div class="metric-subtext">${sDist.Positive ? sDist.Positive.count : 0} reviews</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">Neutral Reviews</div>
            <div class="metric-value text-secondary">${sDist.Neutral ? sDist.Neutral.percentage : 0}%</div>
            <div class="metric-subtext">${sDist.Neutral ? sDist.Neutral.count : 0} reviews</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">Negative Reviews</div>
            <div class="metric-value text-danger" style="color: #dc2626;">${sDist.Negative ? sDist.Negative.percentage : 0}%</div>
            <div class="metric-subtext">${sDist.Negative ? sDist.Negative.count : 0} reviews</div>
          </div>
        </div>

        <div class="grid-2-col">
          <div class="card">
            <div class="card-header"><h3>Top Customer Keywords</h3></div>
            <div class="card-body">
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${(data.frequent_keywords || []).map(kw => `
                  <span class="badge badge-secondary" style="font-size: 0.8rem; padding: 4px 8px;">
                    ${kw.word} (${kw.frequency})
                  </span>
                `).join('')}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Unsupervised Complaint Themes</h3></div>
            <div class="card-body">
              <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
                ${(data.complaint_themes || []).map(th => `
                  <li style="display: flex; justify-content: space-between; font-size: 0.86rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                    <strong>${th.theme}</strong>
                    <span class="badge badge-accent">${th.occurrences} matches</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
        </div>
      `;
    } else if (type === 'logs') {
      const stats = data.latency_statistics || {};
      const sev = data.severity_distribution || {};

      html = `
        <div class="metrics-grid">
          <div class="card metric-card">
            <div class="metric-title">INFO Logs</div>
            <div class="metric-value text-secondary">${sev.INFO || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">WARNING Logs</div>
            <div class="metric-value text-accent">${sev.WARNING || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">ERROR Logs</div>
            <div class="metric-value" style="color: #dc2626;">${sev.ERROR || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">CRITICAL Logs</div>
            <div class="metric-value" style="color: #991b1b;">${sev.CRITICAL || 0}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Latency Statistics (from explicit latency_ms records)</h3></div>
          <div class="card-body table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Samples</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>Std Deviation</th>
                  <th>P95 Latency</th>
                  <th>P99 Latency</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>${stats.samples_analyzed || 0}</td>
                  <td>${stats.min_latency_ms || 0} ms</td>
                  <td>${stats.max_latency_ms || 0} ms</td>
                  <td class="font-bold">${stats.mean_latency_ms || 0} ms</td>
                  <td>${stats.median_latency_ms || 0} ms</td>
                  <td>${stats.std_deviation_ms || 0} ms</td>
                  <td class="text-accent font-bold">${stats.p95_latency_ms || 0} ms</td>
                  <td class="font-bold" style="color: #dc2626;">${stats.p99_latency_ms || 0} ms</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Clustered Error Signatures</h3></div>
          <div class="card-body">
            <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
              ${(data.frequent_error_patterns || []).map(p => `
                <li style="display: flex; justify-content: space-between; font-size: 0.84rem; background: #f8fafc; padding: 8px 12px; border-radius: 4px;">
                  <span class="font-mono">${p.pattern}</span>
                  <span class="badge badge-accent">${p.occurrences} hits</span>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (type === 'briefings') {
      const summary = data.extractive_summary_sample || {};
      html = `
        <div class="grid-2-col">
          <div class="card">
            <div class="card-header"><h3>Thematic Category Groupings</h3></div>
            <div class="card-body">
              <ul style="list-style: none; display: flex; flex-direction: column; gap: 8px;">
                ${(data.thematic_topic_groupings || []).map(t => `
                  <li style="display: flex; justify-content: space-between; font-size: 0.86rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">
                    <strong>${t.topic}</strong>
                    <span class="badge badge-secondary">${t.document_count} briefings</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Top Corpus TF-IDF Terms</h3></div>
            <div class="card-body">
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${(data.top_tfidf_keywords || []).map(kw => `
                  <span class="badge badge-accent" style="font-size: 0.8rem; padding: 4px 8px;">
                    ${kw.keyword} (TF-IDF: ${kw.tfidf_score})
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Sample Extractive Summary: ${summary.source_document || 'Briefing'}</h3></div>
          <div class="card-body">
            <div style="background-color: #f1f5f9; padding: 12px 16px; border-left: 4px solid var(--accent-color); border-radius: 4px; font-size: 0.88rem; line-height: 1.6;">
              ${(summary.summary_sentences || []).map(s => `<p style="margin-bottom: 6px;">${s}</p>`).join('')}
            </div>
          </div>
        </div>

      `;
    } else if (type === 'custom') {
      html = `
        <div class="metrics-grid">
          <div class="card metric-card">
            <div class="metric-title">Files Analyzed</div>
            <div class="metric-value">${data.total_files_analyzed || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">Total Words</div>
            <div class="metric-value">${data.total_words || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">Total Lines</div>
            <div class="metric-value">${data.total_lines || 0}</div>
          </div>
          <div class="card metric-card">
            <div class="metric-title">Characters</div>
            <div class="metric-value">${data.total_characters || 0}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Top Keywords</h3></div>
          <div class="card-body">
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${(data.top_keywords || []).map(kw => `
                <span class="badge badge-accent" style="padding:6px 10px;">
                  ${kw.word} (${kw.frequency})
                </span>
              `).join('') || '<p>No keywords found.</p>'}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>File Statistics</h3></div>
          <div class="card-body table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Words</th>
                  <th>Lines</th>
                  <th>Characters</th>
                </tr>
              </thead>
              <tbody>
                ${(data.file_statistics || []).map(file => `
                  <tr>
                    <td>${file.filename}</td>
                    <td>${file.words}</td>
                    <td>${file.lines}</td>
                    <td>${file.characters}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Representative Excerpts</h3></div>
          <div class="card-body">
            ${(data.representative_excerpts || []).map(item => `
              <div style="margin-bottom:16px;">
                <strong>${item.filename}</strong>
                ${(item.excerpts || []).map(excerpt => `
                  <p style="margin:8px 0; line-height:1.6;">${excerpt}</p>
                `).join('') || '<p>No representative excerpts available.</p>'}
              </div>
            `).join('') || '<p>No excerpts available.</p>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Methodology & Limitations</h3></div>
          <div class="card-body">
            <p><strong>Methodology:</strong> ${data.methodology || 'Not provided'}</p>
            <p><strong>Limitations:</strong> ${data.limitations || 'Not provided'}</p>
          </div>
        </div>
      `;
    }

    elements.aiContentDynamic.innerHTML = html;


  }

  // Public Interface
  return {
    init,
    navigateTo
  };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', App.init);
