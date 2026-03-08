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

    public String toCsvRow() {
        return timestampMillis + "," + serverAddress + "," + latencyMillis + "," + String.format(Locale.US, "%.2f", packetLossPercent) + "," + reachable;
    }
}

class CsvLogger {
    private String filePath;

    public CsvLogger(String filePath) {
        this.filePath = filePath;
        initHeader();
    }

    private void initHeader() {
        File file = new File(filePath);
        if (!file.exists()) {
            try (BufferedWriter bw = new BufferedWriter(new FileWriter(file, true))) {
                bw.write("timestamp,server,latency_ms,packet_loss_pct,reachable");
                bw.newLine();
                bw.flush();
            } catch (IOException e) {
            }
        }
    }

    public synchronized void logResult(ServerCheckResult result) {
        if (result == null) return;
        try (BufferedWriter bw = new BufferedWriter(new FileWriter(filePath, true))) {
            bw.write(result.toCsvRow());
            bw.newLine();
            bw.flush();
        } catch (IOException e) {
        }
    }
}
