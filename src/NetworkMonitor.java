package engine;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

final class ServerCheckResult {
    final String serverAddress;
    final long timestampMillis;
    final long latencyMillis;
    final double packetLossPercent;
    final boolean reachable;
    final String statusDetail; // "REACHABLE", "TIMEOUT", "DNS_FAILURE", "CONNECTION_REFUSED", "NETWORK_ERROR"

    ServerCheckResult(String serverAddress, long timestampMillis, long latencyMillis,
                      double packetLossPercent, boolean reachable, String statusDetail) {
        this.serverAddress = serverAddress;
        this.timestampMillis = timestampMillis;
        this.latencyMillis = latencyMillis;
        this.packetLossPercent = packetLossPercent;
        this.reachable = reachable;
        this.statusDetail = statusDetail;
    }

    public String toCsvRow() {
        return timestampMillis + "," + serverAddress + "," + latencyMillis + "," + String.format(Locale.US, "%.2f", packetLossPercent) + "," + reachable + "," + statusDetail;
    }

    public String toJsonRow() {
        return String.format(Locale.US, "{\"timestamp\":%d,\"server\":\"%s\",\"latency_ms\":%d,\"packet_loss_pct\":%.2f,\"reachable\":%b,\"status_detail\":\"%s\"}",
                timestampMillis, serverAddress, latencyMillis, packetLossPercent, reachable, statusDetail);
    }

    @Override
    public String toString() {
        if (!reachable) {
            return "[" + serverAddress + "] UNREACHABLE (" + statusDetail + ", loss=" + String.format(Locale.US, "%.1f", packetLossPercent) + "%)";
        }
        return "[" + serverAddress + "] reachable in " + latencyMillis + "ms (loss=" + String.format(Locale.US, "%.1f", packetLossPercent) + "%)";
    }
}

class NetworkChecker {

    public static class ProbeResult {
        public final long latencyMs;
        public final String statusDetail;

        public ProbeResult(long latencyMs, String statusDetail) {
            this.latencyMs = latencyMs;
            this.statusDetail = statusDetail;
        }
    }

    public static ProbeResult checkLatency(String host, int port, int timeoutMillis) {
        long t0 = System.currentTimeMillis();
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), timeoutMillis);
            long elapsed = System.currentTimeMillis() - t0;
            return new ProbeResult(elapsed, "REACHABLE");
        } catch (UnknownHostException e) {
            return new ProbeResult(-1, "DNS_FAILURE");
        } catch (SocketTimeoutException e) {
            return new ProbeResult(-1, "TIMEOUT");
        } catch (ConnectException e) {
            return new ProbeResult(-1, "CONNECTION_REFUSED");
        } catch (IOException e) {
            return new ProbeResult(-1, "NETWORK_ERROR");
        } catch (Exception e) {
            return new ProbeResult(-1, "UNKNOWN_ERROR");
        }
    }

    public static double checkPacketLoss(String host, int port, int attempts, int timeoutMillis) {
        if (attempts <= 0) return 0.0;
        int failed = 0;
        for (int i = 0; i < attempts; i++) {
            ProbeResult res = checkLatency(host, port, timeoutMillis);
            if (res.latencyMs < 0) {
                failed++;
            }
        }
        return ((double) failed / attempts) * 100.0;
    }
}

/**
 * Thread-safe blocking queue holding area for telemetry records.
 * Uses LinkedBlockingQueue to allow consumer thread blocking/waiting
 * rather than CPU-spinning or sleep polling.
 */
class TelemetryQueue {
    private final LinkedBlockingQueue<ServerCheckResult> queue = new LinkedBlockingQueue<>();

    public void add(ServerCheckResult result) {
        if (result != null) {
            queue.add(result);
        }
    }

    public ServerCheckResult poll(long timeout, TimeUnit unit) throws InterruptedException {
        return queue.poll(timeout, unit);
    }

    public ServerCheckResult poll() {
        return queue.poll();
    }

    public boolean isEmpty() {
        return queue.isEmpty();
    }

    public int size() {
        return queue.size();
    }
}

/**
 * Real Asynchronous Logger decoupling I/O write operations.
 * Keeps a single BufferedWriter open on a dedicated consumer background thread,
 * pulling from TelemetryQueue via BlockingQueue wait semantics.
 */
class CsvLogger implements AutoCloseable {
    private final String filePath;
    private final TelemetryQueue queue;
    private final AtomicBoolean running = new AtomicBoolean(true);
    private final Thread writerThread;
    private BufferedWriter writer;

    public CsvLogger(String filePath, TelemetryQueue queue) {
        this.filePath = filePath;
        this.queue = queue;
        initWriter();

        // Dedicated Async Consumer Thread
        this.writerThread = new Thread(this::asyncWriteLoop, "Telemetry-Async-Writer");
        this.writerThread.setDaemon(true);
        this.writerThread.start();
    }

    private void initWriter() {
        try {
            File file = new File(filePath);
            boolean isNew = !file.exists() || file.length() == 0;
            this.writer = new BufferedWriter(new FileWriter(file, true));
            if (isNew) {
                writer.write("timestamp,server,latency_ms,packet_loss_pct,reachable,status_detail");
                writer.newLine();
                writer.flush();
            }
        } catch (IOException e) {
            System.err.println("[CsvLogger] Failed to initialize file writer: " + e.getMessage());
        }
    }

    private void asyncWriteLoop() {
        while (running.get() || !queue.isEmpty()) {
            try {
                ServerCheckResult res = queue.poll(200, TimeUnit.MILLISECONDS);
                if (res != null && writer != null) {
                    writer.write(res.toCsvRow());
                    writer.newLine();
                    writer.flush();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
                System.err.println("[CsvLogger] Async write error: " + e.getMessage());
            }
        }
        flushRemaining();
    }

    private void flushRemaining() {
        if (writer != null) {
            try {
                while (!queue.isEmpty()) {
                    ServerCheckResult res = queue.poll();
                    if (res != null) {
                        writer.write(res.toCsvRow());
                        writer.newLine();
                    }
                }
                writer.flush();
            } catch (IOException e) {
                System.err.println("[CsvLogger] Flush error: " + e.getMessage());
            }
        }
    }

    @Override
    public void close() {
        running.set(false);
        try {
            writerThread.join(2000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (writer != null) {
            try {
                flushRemaining();
                writer.close();
            } catch (IOException e) {
            }
        }
    }
}

class ReportGenerator {

    public static void generateReport(String csvFilePath) {
        File file = new File(csvFilePath);
        if (!file.exists()) {
            System.out.println("Log file not found: " + csvFilePath);
            return;
        }

        Map<String, List<Long>> latencyMap = new HashMap<>();
        Map<String, List<Double>> lossMap = new HashMap<>();
        Map<String, Map<String, Integer>> statusMap = new HashMap<>();
        Map<String, Integer> totalCount = new HashMap<>();

        try (BufferedReader br = new BufferedReader(new FileReader(file))) {
            String header = br.readLine(); // skip header
            String line;
            int lineNumber = 1;

            while ((line = br.readLine()) != null) {
                lineNumber++;
                if (line == null || line.trim().isEmpty()) continue;

                try {
                    String[] parts = line.split(",");
                    if (parts.length < 5) continue;

                    String server = parts[1].trim();
                    long lat = Long.parseLong(parts[2].trim());
                    double loss = Double.parseDouble(parts[3].trim());
                    boolean reachable = Boolean.parseBoolean(parts[4].trim());
                    String status = (parts.length >= 6) ? parts[5].trim() : (reachable ? "REACHABLE" : "UNREACHABLE");

                    latencyMap.putIfAbsent(server, new ArrayList<>());
                    lossMap.putIfAbsent(server, new ArrayList<>());
                    statusMap.putIfAbsent(server, new HashMap<>());
                    totalCount.putIfAbsent(server, 0);

                    totalCount.put(server, totalCount.get(server) + 1);
                    if (reachable && lat >= 0) {
                        latencyMap.get(server).add(lat);
                    }
                    lossMap.get(server).add(loss);

                    Map<String, Integer> sMap = statusMap.get(server);
                    sMap.put(status, sMap.getOrDefault(status, 0) + 1);

                } catch (Exception rowEx) {
                    System.err.println("[ReportGenerator] Warning: Skipping malformed row at line " + lineNumber + ": " + rowEx.getMessage());
                }
            }
        } catch (Exception e) {
            System.out.println("Error opening CSV log: " + e.getMessage());
            return;
        }

        System.out.println("\n==============================================");
        System.out.println("     NETWORK TELEMETRY & HEALTH REPORT        ");
        System.out.println("==============================================");

        String worstServer = null;
        double maxAvgLat = -1;

        String highestLossServer = null;
        double maxAvgLoss = -1;

        for (String s : totalCount.keySet()) {
            List<Long> lats = latencyMap.get(s);
            long sum = 0;
            for (long l : lats) sum += l;
            double avgLat = lats.isEmpty() ? 0 : (double) sum / lats.size();

            List<Double> losses = lossMap.get(s);
            double lossSum = 0;
            for (double d : losses) lossSum += d;
            double avgLoss = losses.isEmpty() ? 0 : lossSum / losses.size();

            int total = totalCount.get(s);
            Map<String, Integer> statusBreakdown = statusMap.get(s);

            System.out.printf(Locale.US, "Server: %-25s | Checks: %3d | Avg Latency: %6.1f ms | Loss: %5.1f%% | Statuses: %s%n",
                    s, total, avgLat, avgLoss, statusBreakdown.toString());

            if (avgLat > maxAvgLat) {
                maxAvgLat = avgLat;
                worstServer = s;
            }
            if (avgLoss > maxAvgLoss) {
                maxAvgLoss = avgLoss;
                highestLossServer = s;
            }
        }

        System.out.println("----------------------------------------------");
        if (worstServer != null) {
            System.out.printf(Locale.US, "Worst Avg Latency Host : %s (%.1f ms)%n", worstServer, maxAvgLat);
        }
        if (highestLossServer != null) {
            System.out.printf(Locale.US, "Highest Packet Loss Host: %s (%.1f%%)%n", highestLossServer, maxAvgLoss);
        }
        System.out.println("==============================================\n");
    }
}

/**
 * Continuous Multithreaded Network Latency & Stability Service
 */
public class NetworkMonitor {
    private static final String[] TARGET_HOSTS = {
        "google.com", "1.1.1.1", "8.8.8.8", "127.0.0.1", "unreachable.test.invalid"
    };
    private static final int TARGET_PORT = 80;
    private static final int TIMEOUT_MS = 1000;
    private static final int PACKET_LOSS_PROBES = 5;
    private static final String LOG_FILE = "network_telemetry.csv";
    private static final int CHECK_INTERVAL_SECONDS = 5;
    private static final Map<String, ServerCheckResult> latestResultsMap = new ConcurrentHashMap<>();
    private static HttpServer httpServer;

    public static void main(String[] args) {
        System.out.println("=== Starting Continuous Network Health Monitor Service ===");

        startHttpServer(8080);

        TelemetryQueue queue = new TelemetryQueue();

        // Start Real Async Consumer Writer Thread
        CsvLogger logger = new CsvLogger(LOG_FILE, queue);

        // Single-thread scheduler for cycle timing + worker pool for parallel probes
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
        ExecutorService workerPool = Executors.newFixedThreadPool(TARGET_HOSTS.length);

        // Graceful shutdown hook (runs on Ctrl+C or process exit)
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\nShutting down monitor service...");
            if (httpServer != null) httpServer.stop(0);
            scheduler.shutdown();
            workerPool.shutdown();
            logger.close();
            System.out.println("Generating final telemetry summary...");
            ReportGenerator.generateReport(LOG_FILE);
            System.out.println("Service stopped cleanly.");
        }));

        boolean continuousMode = args.length > 0 && "--continuous".equalsIgnoreCase(args[0]);

        if (continuousMode) {
            System.out.println("Running in continuous monitoring mode (Interval: " + CHECK_INTERVAL_SECONDS + "s)... Press Ctrl+C to stop.");
            // scheduleWithFixedDelay prevents overlapping cycles if a probe cycle takes longer than the interval
            scheduler.scheduleWithFixedDelay(() -> runProbeCycle(workerPool, queue), 0, CHECK_INTERVAL_SECONDS, TimeUnit.SECONDS);
        } else {
            System.out.println("Running telemetry probe cycle...");
            runProbeCycle(workerPool, queue);

            workerPool.shutdown();
            try {
                if (!workerPool.awaitTermination(10, TimeUnit.SECONDS)) {
                    workerPool.shutdownNow();
                }
            } catch (InterruptedException e) {
                workerPool.shutdownNow();
                Thread.currentThread().interrupt();
            }

            scheduler.shutdown();
            logger.close();

            System.out.println("\nGenerating summary report...");
            ReportGenerator.generateReport(LOG_FILE);
        }
    }

    private static void startHttpServer(int port) {
        try {
            httpServer = HttpServer.create(new InetSocketAddress(port), 0);
            httpServer.createContext("/api/telemetry", exchange -> {
                StringBuilder jsonBuilder = new StringBuilder("[");
                int count = 0;
                for (ServerCheckResult res : latestResultsMap.values()) {
                    if (count > 0) jsonBuilder.append(",");
                    jsonBuilder.append(res.toJsonRow());
                    count++;
                }
                jsonBuilder.append("]");

                byte[] resp = jsonBuilder.toString().getBytes(StandardCharsets.UTF_8);
                exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
                exchange.getResponseHeaders().add("Content-Type", "application/json");
                exchange.sendResponseHeaders(200, resp.length);
                OutputStream os = exchange.getResponseBody();
                os.write(resp);
                os.close();
            });
            httpServer.setExecutor(Executors.newSingleThreadExecutor());
            httpServer.start();
            System.out.println("Live Telemetry REST API listening on http://localhost:" + port + "/api/telemetry");
        } catch (IOException e) {
            System.err.println("[NetworkMonitor] Could not start HTTP server on port " + port + ": " + e.getMessage());
        }
    }

    private static void runProbeCycle(ExecutorService workerPool, TelemetryQueue queue) {
        List<Future<?>> futures = new ArrayList<>();

        for (String host : TARGET_HOSTS) {
            futures.add(workerPool.submit(() -> {
                NetworkChecker.ProbeResult latencyResult = NetworkChecker.checkLatency(host, TARGET_PORT, TIMEOUT_MS);
                double lossPct = NetworkChecker.checkPacketLoss(host, TARGET_PORT, PACKET_LOSS_PROBES, TIMEOUT_MS);
                boolean reachable = (latencyResult.latencyMs >= 0);
                long now = System.currentTimeMillis();

                ServerCheckResult result = new ServerCheckResult(
                    host, now, latencyResult.latencyMs, lossPct, reachable, latencyResult.statusDetail
                );

                latestResultsMap.put(host, result);
                System.out.println("Probed: " + result);
                queue.add(result);
            }));
        }

        for (Future<?> f : futures) {
            try {
                f.get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                System.err.println("[NetworkMonitor] Probe task interrupted: " + e.getMessage());
            } catch (ExecutionException e) {
                System.err.println("[NetworkMonitor] Probe execution error: " + e.getCause());
            }
        }
    }
}
