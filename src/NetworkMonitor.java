package engine;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

class ServerCheckResult {
    String serverAddress;
    long timestampMillis;
    long latencyMillis;
    double packetLossPercent;
    boolean reachable;

    ServerCheckResult(String serverAddress, long timestampMillis, long latencyMillis,
                      double packetLossPercent, boolean reachable) {
        this.serverAddress = serverAddress;
        this.timestampMillis = timestampMillis;
        this.latencyMillis = latencyMillis;
        this.packetLossPercent = packetLossPercent;
        this.reachable = reachable;
    }
}

class NetworkChecker {
    public static long checkLatency(String host, int port, int timeoutMillis) {
        if (host == null || host.trim().isEmpty()) return -1;
        long t0 = System.currentTimeMillis();
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), Math.max(100, timeoutMillis));
            return System.currentTimeMillis() - t0;
        } catch (Exception e) {
            return -1;
        }
    }

    public static double checkPacketLoss(String host, int port, int attempts, int timeoutMillis) {
        if (attempts <= 0 || host == null) return 0.0;
        int failed = 0;
        for (int i = 0; i < attempts; i++) {
            long lat = checkLatency(host, port, timeoutMillis);
            if (lat < 0) {
                failed++;
            }
        }
        return ((double) failed / attempts) * 100.0;
    }
}

class TelemetryQueue {
    private final ConcurrentLinkedQueue<ServerCheckResult> queue = new ConcurrentLinkedQueue<>();

    public void add(ServerCheckResult result) {
        if (result != null && result.serverAddress != null) {
            queue.add(result);
        }
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
