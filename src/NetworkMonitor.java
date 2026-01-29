package engine;

import java.io.*;
import java.net.*;
import java.util.*;

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
        long t0 = System.currentTimeMillis();
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress(host, port), timeoutMillis);
            return System.currentTimeMillis() - t0;
        } catch (Exception e) {
            return -1;
        }
    }

    public static double checkPacketLoss(String host, int port, int attempts, int timeoutMillis) {
        if (attempts <= 0) return 0.0;
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

public class NetworkMonitor {
    public static void main(String[] args) {
        String[] hosts = {"google.com", "1.1.1.1", "8.8.8.8"};
        for (String host : hosts) {
            long lat = NetworkChecker.checkLatency(host, 80, 1000);
            double loss = NetworkChecker.checkPacketLoss(host, 80, 3, 1000);
            System.out.println("Host: " + host + " | Latency: " + lat + "ms | Loss: " + loss + "%");
        }
    }
}
