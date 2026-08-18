# Network Latency Observability Engine & Web Dashboard

A full-stack, high-throughput network monitoring service and real-time observability dashboard. Built with a multithreaded Java backend engine for TCP socket probing and non-blocking I/O logging, integrated with a React 18 web dashboard deployed live on Vercel cloud and AWS EC2.

---

## 🌟 Architecture Overview

```text
+------------------------------------+      +------------------------------------+      +------------------------------------+
|  1. Multithreaded Java Engine      | ---> |  2. Asynchronous Telemetry Buffer   | ---> |  3. React Observability Web UI     |
|  - java.net.Socket TCP Probes      |      |  - LinkedBlockingQueue (Lock-Free) |      |  - React 18 + Vite + Tailwind CSS  |
|  - ExecutorService Thread Pool     |      |  - Daemon Async CSV Writer Thread  |      |  - Recharts Live Time-Series Chart |
|  - REST API (localhost:8080)       |      |  - Zero Thread-Blocking I/O        |      |  - Vercel Cloud + AWS EC2 Service  |
+------------------------------------+      +------------------------------------+      +------------------------------------+
```

---

## ✨ Core Features

- **Socket-Level TCP Latency Probing**: Uses low-level `java.net.Socket` to measure true round-trip TCP connection latency in milliseconds across configured host endpoints.
- **Differentiated Socket Failure Matrix**: Classifies network failure diagnostics (`REACHABLE`, `TIMEOUT`, `CONNECTION_REFUSED`, `DNS_FAILURE`).
- **Asynchronous Lock-Free Disk Logging**: Decoupled `LinkedBlockingQueue` telemetry buffer that streams telemetry data to disk without thread-blocking I/O overhead.
- **Built-in REST API Endpoint**: Serves live JSON telemetry at `http://localhost:8080/api/telemetry` for real-time web UI synchronization.
- **Full-Stack React Observability UI**: Time-series latency charts, diagnostic matrix tables, active KPI metric cards, and interactive 3-node visual architecture visualizer.
- **AWS EC2 Cloud & Docker Support**: Includes `Dockerfile`, `systemd` background service daemon (`network-monitor.service`), and automated bash deployment scripts.

---

## 🚀 Live Demo & Web Dashboard

- **Live Dashboard**: [https://network-latency-dashboard-bhasu333s-projects.vercel.app](https://network-latency-dashboard-bhasu333s-projects.vercel.app)
- **Dual Data Modes**:
  - **Mode 1 (Edge Stream Simulator)**: Public Vercel demo streaming live simulated socket metrics.
  - **Mode 2 (Live Java Sync)**: Auto-connects to your local Java backend (`localhost:8080`) when running `java engine.NetworkMonitor --continuous`.

---

## 🛠️ Local Build & Execution

### 1. Run Java Backend Engine
```bash
# Compile Java source
javac -d . src/NetworkMonitor.java

# Run continuous monitoring service with live REST API
java engine.NetworkMonitor --continuous
```

### 2. Run Local Web Dashboard
```bash
cd dashboard
npm install
npm run dev
```

---

## ☁️ AWS EC2 Cloud Deployment

To deploy the Java engine as an always-on background daemon on an AWS EC2 instance:

```bash
# Clone repository on EC2 instance
git clone https://github.com/Bhasu333/network-latency-engine.git
cd network-latency-engine

# Run automated deployment script
chmod +x scripts/deploy_ec2.sh
./scripts/deploy_ec2.sh
```

Or deploy using Docker:
```bash
docker build -t network-monitor .
docker run -d -p 8080:8080 --name network-engine network-monitor
```

---

## 📊 Telemetry Log Schema (`network_telemetry.csv`)

```csv
timestamp,server,latency_ms,packet_loss_pct,reachable
1785133266442,1.1.1.1,32,0.00,true
1785133266469,google.com,54,0.00,true
```

---

## 👤 Author

**Bhaswath Datla**  
B.S. in Computer Science | University of Washington, Seattle  
GitHub: [@Bhasu333](https://github.com/Bhasu333)
