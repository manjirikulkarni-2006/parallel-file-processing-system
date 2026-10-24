# CPU Scheduling Algorithms & Mathematical Formulations

This document specifies the algorithmic rules, mathematical definitions, and edge-case handling implemented in the project's **CPU Scheduling Simulator**.

> **Educational Simulation Notice:** This simulator models discrete-event operating system CPU scheduling mechanics. It does not replace or alter the real-time Linux kernel scheduler (`sched_yield`, `CFS`).

---

## 1. Metric Definitions & Formulas

Let a workload be defined by a set of processes $P = \{P_1, P_2, \dots, P_n\}$.  
Each process $P_i$ has:
- **Arrival Time ($AT_i$):** The time instant when the process enters the ready queue ($AT_i \ge 0$).
- **Burst Time ($BT_i$):** Total CPU execution time required by the process ($BT_i > 0$).
- **Priority ($Pr_i$):** Priority rating (integer).

### A. Per-Process Metrics
1. **Completion Time ($CT_i$):**
   The instant at which $P_i$ completes its final CPU burst.
2. **Turnaround Time ($TAT_i$):**
   Total time spent from arrival to completion:
   $$TAT_i = CT_i - AT_i$$
3. **Waiting Time ($WT_i$):**
   Total time spent in the ready queue awaiting CPU execution:
   $$WT_i = TAT_i - BT_i$$
4. **Response Time ($RT_i$):**
   Time elapsed from arrival until the process first receives CPU execution:
   $$RT_i = \text{Time}_{\text{first\_dispatch}} - AT_i$$

### B. System-Wide Averages & Telemetry
1. **Average Turnaround Time:**
   $$\text{Avg TAT} = \frac{1}{n} \sum_{i=1}^n TAT_i$$
2. **Average Waiting Time:**
   $$\text{Avg WT} = \frac{1}{n} \sum_{i=1}^n WT_i$$
3. **Average Response Time:**
   $$\text{Avg RT} = \frac{1}{n} \sum_{i=1}^n RT_i$$
4. **CPU Utilization Percentage:**
   $$\text{CPU Utilization} = \left( \frac{\text{Total Busy Time}}{\text{Total Elapsed Time}} \right) \times 100\%$$
   $$\text{where } \text{Total Elapsed Time} = \text{Total Busy Time} + \text{Total Idle Time}$$
5. **System Throughput:**
   $$\text{Throughput} = \frac{n}{\text{Total Elapsed Time}} \quad (\text{processes per unit time})$$

---

## 2. Implemented Scheduling Algorithms

### A. First-Come, First-Served (FCFS)
- **Type:** Non-preemptive.
- **Rule:** Processes are dispatched in the exact chronological order of their arrival time ($AT$).
- **Tie-Breaking:** If two processes arrive at the same instant, tie-breaking defaults to Process ID order.
- **Idle Periods:** If the CPU completes all active jobs and the next process has $AT > \text{Current Time}$, the interval is designated as an **IDLE** state in the Gantt chart.

### B. Non-preemptive Priority Scheduling
- **Type:** Non-preemptive.
- **Priority Convention:** **Lower numerical value indicates higher priority** (e.g., Priority 1 is higher than Priority 5).
- **Rule:** Once a process begins execution, it runs to completion without interruption. When the CPU becomes free, the ready process with the highest priority (lowest numerical rating) is selected.
- **Tie-Breaking:** If two ready processes share the same priority, the one with earlier arrival time is scheduled; if still equal, PID order is used.

### C. Preemptive Round Robin (RR)
- **Type:** Preemptive.
- **Time Quantum ($q$):** User-configurable time slice allocated to each process before mandatory preemption ($q \ge 1$).
- **Rule:**
  1. Arriving processes are placed in a FIFO Ready Queue.
  2. The process at the head of the queue runs for $\min(q, \text{remaining\_time})$.
  3. Any new processes arriving during this time slice are enqueued into the ready queue.
  4. If the active process still has remaining execution time, it is placed at the tail of the ready queue.
  5. If the process finishes its burst, it is marked as completed and removed.
- **Significance of Response Time ($RT$):**
  In Round Robin, $RT$ is often significantly lower than $WT$, demonstrating why interactive operating systems employ preemptive time-slicing for responsiveness.

---

## 3. Verified Edge Cases in Test Suite
The simulator has been validated against textbook benchmark scenarios:
- **Simultaneous Arrivals ($AT = 0$ for all processes)**.
- **CPU Idle Periods** (e.g., $P_1$ finishes at $t=4$, $P_2$ arrives at $t=8$).
- **Single Process Isolation** (ensuring clean termination without infinite loops).
- **Multiple Time Quantum Cycles** where remaining burst spans several preemption rounds.
