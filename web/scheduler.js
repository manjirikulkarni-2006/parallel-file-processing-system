/**
 * web/scheduler.js
 * CPU Scheduling Simulator Core Algorithms
 * Implements:
 *   1. First-Come, First-Served (FCFS)
 *   2. Non-preemptive Priority Scheduling (Lower numerical value = Higher priority)
 *   3. Preemptive Round Robin (RR) with configurable time quantum
 *
 * Computes:
 *   - Gantt chart time slices (including IDLE periods)
 *   - Completion Time (CT), Turnaround Time (TAT), Waiting Time (WT), Response Time (RT)
 *   - Averages: Avg TAT, Avg WT, Avg RT, CPU Utilization, Throughput
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CPUScheduler = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    /**
     * Input validation
     */
    function validateProcesses(processes) {
        if (!Array.isArray(processes) || processes.length === 0) {
            throw new Error("Process list must be a non-empty array.");
        }

        const sanitized = [];
        const seenPids = new Set();

        for (let i = 0; i < processes.length; i++) {
            const p = processes[i];
            const pid = String(p.pid || `P${i + 1}`).trim();
            if (seenPids.has(pid)) {
                throw new Error(`Duplicate Process ID detected: '${pid}'`);
            }
            seenPids.add(pid);

            const arrivalTime = Number(p.arrivalTime !== undefined ? p.arrivalTime : p.at);
            const burstTime = Number(p.burstTime !== undefined ? p.burstTime : p.bt);
            const priority = Number(p.priority !== undefined ? p.priority : (p.prio || 0));

            if (isNaN(arrivalTime) || arrivalTime < 0) {
                throw new Error(`Invalid Arrival Time for ${pid}: must be a non-negative number.`);
            }
            if (isNaN(burstTime) || burstTime <= 0) {
                throw new Error(`Invalid Burst Time for ${pid}: must be greater than zero.`);
            }
            if (isNaN(priority)) {
                throw new Error(`Invalid Priority for ${pid}: must be an integer.`);
            }

            sanitized.push({
                pid,
                arrivalTime,
                burstTime,
                priority,
                originalIndex: i
            });
        }

        return sanitized;
    }

    /**
     * Consolidates consecutive identical intervals in Gantt chart
     */
    function mergeGantt(rawGantt) {
        const merged = [];
        for (const slice of rawGantt) {
            if (slice.startTime >= slice.endTime) continue;
            if (merged.length > 0 && merged[merged.length - 1].pid === slice.pid) {
                merged[merged.length - 1].endTime = slice.endTime;
            } else {
                merged.push({ ...slice });
            }
        }
        return merged;
    }

    /**
     * First Come, First Served (FCFS)
     */
    function scheduleFCFS(inputProcesses) {
        const processes = validateProcesses(inputProcesses);
        // Sort primarily by arrival time, tie-break by original index
        processes.sort((a, b) => a.arrivalTime - b.arrivalTime || a.originalIndex - b.originalIndex);

        let currentTime = 0;
        const gantt = [];
        const results = [];

        for (const p of processes) {
            if (currentTime < p.arrivalTime) {
                gantt.push({
                    pid: "IDLE",
                    startTime: currentTime,
                    endTime: p.arrivalTime
                });
                currentTime = p.arrivalTime;
            }

            const startTime = currentTime;
            const completionTime = startTime + p.burstTime;
            currentTime = completionTime;

            gantt.push({
                pid: p.pid,
                startTime,
                endTime: completionTime
            });

            const turnaroundTime = completionTime - p.arrivalTime;
            const waitingTime = turnaroundTime - p.burstTime;
            const responseTime = startTime - p.arrivalTime;

            results.push({
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                completionTime,
                turnaroundTime,
                waitingTime,
                responseTime
            });
        }

        return formatSummary("First Come, First Served (FCFS)", mergeGantt(gantt), results);
    }

    /**
     * Non-preemptive Priority Scheduling
     * Documented convention: Lower numerical priority value = Higher priority (e.g., 1 is higher priority than 5)
     * Deterministic tie-breaker: Arrival Time, then Original Order
     */
    function schedulePriority(inputProcesses) {
        const processes = validateProcesses(inputProcesses);
        const n = processes.length;
        const completed = new Set();
        let currentTime = 0;
        const gantt = [];
        const results = [];

        // Track minimum arrival time to start
        const minArrival = Math.min(...processes.map(p => p.arrivalTime));
        if (currentTime < minArrival) {
            gantt.push({ pid: "IDLE", startTime: currentTime, endTime: minArrival });
            currentTime = minArrival;
        }

        while (completed.size < n) {
            // Find arrived and uncompleted processes
            const available = processes.filter(p => !completed.has(p.pid) && p.arrivalTime <= currentTime);

            if (available.length === 0) {
                // CPU idle until next process arrival
                const remaining = processes.filter(p => !completed.has(p.pid));
                const nextArrival = Math.min(...remaining.map(p => p.arrivalTime));
                gantt.push({
                    pid: "IDLE",
                    startTime: currentTime,
                    endTime: nextArrival
                });
                currentTime = nextArrival;
                continue;
            }

            // Pick highest priority (lowest numerical value), tie-break by arrival time, then originalIndex
            available.sort((a, b) => 
                a.priority - b.priority || 
                a.arrivalTime - b.arrivalTime || 
                a.originalIndex - b.originalIndex
            );

            const selected = available[0];
            const startTime = currentTime;
            const completionTime = startTime + selected.burstTime;
            currentTime = completionTime;

            gantt.push({
                pid: selected.pid,
                startTime,
                endTime: completionTime
            });

            completed.add(selected.pid);

            const turnaroundTime = completionTime - selected.arrivalTime;
            const waitingTime = turnaroundTime - selected.burstTime;
            const responseTime = startTime - selected.arrivalTime;

            results.push({
                pid: selected.pid,
                arrivalTime: selected.arrivalTime,
                burstTime: selected.burstTime,
                priority: selected.priority,
                completionTime,
                turnaroundTime,
                waitingTime,
                responseTime
            });
        }

        // Restore original order in results table
        results.sort((a, b) => {
            const pa = processes.find(p => p.pid === a.pid);
            const pb = processes.find(p => p.pid === b.pid);
            return pa.originalIndex - pb.originalIndex;
        });

        return formatSummary("Non-preemptive Priority Scheduling", mergeGantt(gantt), results);
    }

    /**
     * Preemptive Round Robin (RR)
     */
    function scheduleRoundRobin(inputProcesses, timeQuantum = 2) {
        const quantum = Number(timeQuantum);
        if (isNaN(quantum) || quantum <= 0) {
            throw new Error("Time Quantum must be a positive number.");
        }

        const processes = validateProcesses(inputProcesses);
        const n = processes.length;

        // Sort by arrival time initially
        const queueProcesses = processes.map(p => ({
            ...p,
            remainingTime: p.burstTime,
            firstResponseTime: -1,
            completionTime: 0
        })).sort((a, b) => a.arrivalTime - b.arrivalTime || a.originalIndex - b.originalIndex);

        let currentTime = 0;
        const gantt = [];
        const readyQueue = [];
        let completedCount = 0;
        let pIndex = 0;

        // Push processes arriving at time 0
        while (pIndex < n && queueProcesses[pIndex].arrivalTime <= currentTime) {
            readyQueue.push(queueProcesses[pIndex]);
            pIndex++;
        }

        while (completedCount < n) {
            if (readyQueue.length === 0) {
                // If ready queue is empty, jump to next arriving process
                if (pIndex < n) {
                    const nextArrival = queueProcesses[pIndex].arrivalTime;
                    if (nextArrival > currentTime) {
                        gantt.push({
                            pid: "IDLE",
                            startTime: currentTime,
                            endTime: nextArrival
                        });
                        currentTime = nextArrival;
                    }
                    while (pIndex < n && queueProcesses[pIndex].arrivalTime <= currentTime) {
                        readyQueue.push(queueProcesses[pIndex]);
                        pIndex++;
                    }
                }
                continue;
            }

            const current = readyQueue.shift();

            // Record response time on first CPU dispatch
            if (current.firstResponseTime === -1) {
                current.firstResponseTime = currentTime;
            }

            const executionTime = Math.min(quantum, current.remainingTime);
            const startTime = currentTime;
            currentTime += executionTime;
            current.remainingTime -= executionTime;

            gantt.push({
                pid: current.pid,
                startTime,
                endTime: currentTime
            });

            // Enqueue newly arrived processes during this time slice
            while (pIndex < n && queueProcesses[pIndex].arrivalTime <= currentTime) {
                readyQueue.push(queueProcesses[pIndex]);
                pIndex++;
            }

            if (current.remainingTime > 0) {
                readyQueue.push(current);
            } else {
                current.completionTime = currentTime;
                completedCount++;
            }
        }

        const results = queueProcesses.map(p => {
            const turnaroundTime = p.completionTime - p.arrivalTime;
            const waitingTime = turnaroundTime - p.burstTime;
            const responseTime = p.firstResponseTime - p.arrivalTime;

            return {
                pid: p.pid,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                completionTime: p.completionTime,
                turnaroundTime,
                waitingTime,
                responseTime
            };
        }).sort((a, b) => {
            const pa = processes.find(p => p.pid === a.pid);
            const pb = processes.find(p => p.pid === b.pid);
            return pa.originalIndex - pb.originalIndex;
        });

        return formatSummary(`Round Robin (Quantum = ${quantum})`, mergeGantt(gantt), results, quantum);
    }

    /**
     * Calculates aggregate metrics: Avg TAT, Avg WT, Avg RT, CPU Utilization
     */
    function formatSummary(algorithmName, gantt, processResults, quantum = null) {
        const totalProcesses = processResults.length;
        const totalTAT = processResults.reduce((sum, p) => sum + p.turnaroundTime, 0);
        const totalWT = processResults.reduce((sum, p) => sum + p.waitingTime, 0);
        const totalRT = processResults.reduce((sum, p) => sum + p.responseTime, 0);

        const totalExecutionTime = gantt.length > 0 ? gantt[gantt.length - 1].endTime : 0;
        const totalIdleTime = gantt
            .filter(slice => slice.pid === "IDLE")
            .reduce((sum, slice) => sum + (slice.endTime - slice.startTime), 0);
        const totalBusyTime = totalExecutionTime - totalIdleTime;
        const cpuUtilization = totalExecutionTime > 0 ? (totalBusyTime / totalExecutionTime) * 100 : 0;
        const throughput = totalExecutionTime > 0 ? totalProcesses / totalExecutionTime : 0;

        return {
            algorithm: algorithmName,
            timeQuantum: quantum,
            totalProcesses,
            totalExecutionTime,
            totalBusyTime,
            totalIdleTime,
            cpuUtilization: Number(cpuUtilization.toFixed(2)),
            throughput: Number(throughput.toFixed(4)),
            averages: {
                turnaroundTime: Number((totalTAT / totalProcesses).toFixed(2)),
                waitingTime: Number((totalWT / totalProcesses).toFixed(2)),
                responseTime: Number((totalRT / totalProcesses).toFixed(2))
            },
            ganttChart: gantt,
            processes: processResults
        };
    }

    return {
        scheduleFCFS,
        schedulePriority,
        scheduleRoundRobin,
        validateProcesses
    };
}));
