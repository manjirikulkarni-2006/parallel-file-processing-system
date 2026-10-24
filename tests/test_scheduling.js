/**
 * tests/test_scheduling.js
 * Automated unit and integration test suite for CPU Scheduling Simulator.
 * Verifies algorithms against standard textbook operating system test cases.
 */

const scheduler = require('../web/scheduler.js');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`  [FAIL] ${message}`);
        process.exitCode = 1;
    } else {
        console.log(`  [PASS] ${message}`);
        passedTests++;
    }
}

function assertEquals(actual, expected, message) {
    assert(Math.abs(actual - expected) < 0.001, `${message} (Expected: ${expected}, Got: ${actual})`);
}

console.log("=================================================");
console.log("   RUNNING CPU SCHEDULING SIMULATION TESTS       ");
console.log("=================================================\n");

// TEST CASE 1: Standard FCFS (Textbook example)
console.log("--- Test Case 1: FCFS Standard Execution ---");
{
    const procs = [
        { pid: "P1", arrivalTime: 0, burstTime: 5, priority: 2 },
        { pid: "P2", arrivalTime: 1, burstTime: 3, priority: 1 },
        { pid: "P3", arrivalTime: 2, burstTime: 8, priority: 3 },
        { pid: "P4", arrivalTime: 3, burstTime: 6, priority: 4 }
    ];

    const res = scheduler.scheduleFCFS(procs);

    // Completion times: P1: 5, P2: 8, P3: 16, P4: 22
    // TAT: P1: 5-0=5, P2: 8-1=7, P3: 16-2=14, P4: 22-3=19. Avg TAT = (5+7+14+19)/4 = 45/4 = 11.25
    // WT:  P1: 5-5=0, P2: 7-3=4, P3: 14-8=6, P4: 19-6=13. Avg WT = (0+4+6+13)/4 = 23/4 = 5.75
    // RT:  P1: 0, P2: 5-1=4, P3: 8-2=6, P4: 16-3=13. Avg RT = 5.75
    assertEquals(res.averages.turnaroundTime, 11.25, "FCFS Avg Turnaround Time matches 11.25");
    assertEquals(res.averages.waitingTime, 5.75, "FCFS Avg Waiting Time matches 5.75");
    assertEquals(res.averages.responseTime, 5.75, "FCFS Avg Response Time matches 5.75");
    assertEquals(res.totalExecutionTime, 22, "FCFS Total execution time is 22");
    assertEquals(res.cpuUtilization, 100, "FCFS CPU Utilization is 100%");
}

// TEST CASE 2: FCFS with CPU Idle Periods
console.log("\n--- Test Case 2: FCFS with CPU Idle Interval ---");
{
    const procs = [
        { pid: "P1", arrivalTime: 0, burstTime: 4 },
        { pid: "P2", arrivalTime: 8, burstTime: 4 } // CPU idle from 4 to 8
    ];

    const res = scheduler.scheduleFCFS(procs);
    const idleSlice = res.ganttChart.find(s => s.pid === "IDLE");
    assert(idleSlice !== undefined, "Idle slice is detected in Gantt chart");
    assertEquals(idleSlice.startTime, 4, "Idle begins at 4");
    assertEquals(idleSlice.endTime, 8, "Idle ends at 8");
    assertEquals(res.totalExecutionTime, 12, "Total execution time is 12");
    assertEquals(res.totalIdleTime, 4, "Total idle time is 4");
    assertEquals(res.cpuUtilization, 66.67, "CPU utilization is 66.67%");
}

// TEST CASE 3: Non-preemptive Priority Scheduling
console.log("\n--- Test Case 3: Priority Scheduling (Lower number = Higher priority) ---");
{
    const procs = [
        { pid: "P1", arrivalTime: 0, burstTime: 4, priority: 3 },
        { pid: "P2", arrivalTime: 1, burstTime: 2, priority: 1 },
        { pid: "P3", arrivalTime: 2, burstTime: 5, priority: 4 },
        { pid: "P4", arrivalTime: 3, burstTime: 1, priority: 2 }
    ];

    // At t=0: Only P1 is here -> runs 0..4
    // At t=4: P2(prio 1), P3(prio 4), P4(prio 2) are ready.
    // Highest priority is P2 (prio 1) -> runs 4..6
    // At t=6: P4(prio 2), P3(prio 4) ready. Next is P4 -> runs 6..7
    // At t=7: P3 runs 7..12
    const res = scheduler.schedulePriority(procs);

    const order = res.ganttChart.map(g => g.pid);
    assert(JSON.stringify(order) === JSON.stringify(["P1", "P2", "P4", "P3"]), 
           "Execution order matches P1 -> P2 -> P4 -> P3");

    // Check P2 completion: 6, TAT: 6-1=5, WT: 5-2=3
    const p2 = res.processes.find(p => p.pid === "P2");
    assertEquals(p2.completionTime, 6, "P2 completion time is 6");
    assertEquals(p2.waitingTime, 3, "P2 waiting time is 3");
}

// TEST CASE 4: Preemptive Round Robin with Quantum = 2
console.log("\n--- Test Case 4: Round Robin (Preemptive, Quantum = 2) ---");
{
    const procs = [
        { pid: "P1", arrivalTime: 0, burstTime: 5 },
        { pid: "P2", arrivalTime: 1, burstTime: 4 },
        { pid: "P3", arrivalTime: 2, burstTime: 2 },
        { pid: "P4", arrivalTime: 4, burstTime: 1 }
    ];

    // Timeline:
    // t=0..2: P1 runs (rem: 3). At t=1 P2 arrives, at t=2 P3 arrives. Queue: P2, P3, P1
    // t=2..4: P2 runs (rem: 2). At t=4 P4 arrives. Queue: P3, P1, P4, P2
    // t=4..6: P3 runs (rem: 0, completes at 6!). Queue: P1, P4, P2
    // t=6..8: P1 runs (rem: 1). Queue: P4, P2, P1
    // t=8..9: P4 runs (rem: 0, completes at 9!). Queue: P2, P1
    // t=9..11: P2 runs (rem: 0, completes at 11!). Queue: P1
    // t=11..12: P1 runs (rem: 0, completes at 12!).
    const res = scheduler.scheduleRoundRobin(procs, 2);

    const p3 = res.processes.find(p => p.pid === "P3");
    const p4 = res.processes.find(p => p.pid === "P4");
    const p2 = res.processes.find(p => p.pid === "P2");
    const p1 = res.processes.find(p => p.pid === "P1");

    assertEquals(p3.completionTime, 6, "P3 completes at 6");
    assertEquals(p4.completionTime, 9, "P4 completes at 9");
    assertEquals(p2.completionTime, 11, "P2 completes at 11");
    assertEquals(p1.completionTime, 12, "P1 completes at 12");

    // Response times:
    // P1: first CPU at 0 -> RT = 0 - 0 = 0
    // P2: first CPU at 2 -> RT = 2 - 1 = 1
    // P3: first CPU at 4 -> RT = 4 - 2 = 2
    // P4: first CPU at 8 -> RT = 8 - 4 = 4
    assertEquals(p1.responseTime, 0, "P1 response time is 0");
    assertEquals(p2.responseTime, 1, "P2 response time is 1");
    assertEquals(p3.responseTime, 2, "P3 response time is 2");
    assertEquals(p4.responseTime, 4, "P4 response time is 4");
}

// TEST CASE 5: Single Process Execution
console.log("\n--- Test Case 5: Single Process Edge Case ---");
{
    const procs = [{ pid: "P_SOLO", arrivalTime: 3, burstTime: 7 }];
    const res = scheduler.scheduleRoundRobin(procs, 4);

    assertEquals(res.totalExecutionTime, 10, "Total execution time is 10 (3 idle + 7 burst)");
    assertEquals(res.totalIdleTime, 3, "Total idle time is 3");
    assertEquals(res.processes[0].completionTime, 10, "P_SOLO completes at 10");
    assertEquals(res.processes[0].turnaroundTime, 7, "P_SOLO TAT is 7");
    assertEquals(res.processes[0].waitingTime, 0, "P_SOLO WT is 0");
}

// TEST CASE 6: Input Validation Errors
console.log("\n--- Test Case 6: Input Validation & Boundary Checks ---");
{
    let caughtDuplicate = false;
    try {
        scheduler.validateProcesses([
            { pid: "P1", arrivalTime: 0, burstTime: 2 },
            { pid: "P1", arrivalTime: 1, burstTime: 3 }
        ]);
    } catch (e) {
        caughtDuplicate = true;
    }
    assert(caughtDuplicate, "Rejects duplicate process IDs");

    let caughtNegativeArrival = false;
    try {
        scheduler.validateProcesses([{ pid: "P1", arrivalTime: -5, burstTime: 3 }]);
    } catch (e) {
        caughtNegativeArrival = true;
    }
    assert(caughtNegativeArrival, "Rejects negative arrival time");

    let caughtZeroBurst = false;
    try {
        scheduler.validateProcesses([{ pid: "P1", arrivalTime: 0, burstTime: 0 }]);
    } catch (e) {
        caughtZeroBurst = true;
    }
    assert(caughtZeroBurst, "Rejects zero/negative burst time");

    let caughtInvalidQuantum = false;
    try {
        scheduler.scheduleRoundRobin([{ pid: "P1", arrivalTime: 0, burstTime: 4 }], -2);
    } catch (e) {
        caughtInvalidQuantum = true;
    }
    assert(caughtInvalidQuantum, "Rejects negative quantum");
}

console.log("\n=================================================");
console.log(`   TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
console.log("=================================================\n");

if (passedTests !== totalTests) {
    process.exit(1);
}
