package engine;

import java.io.*;
import java.net.*;
import java.util.*;

class ServerCheckResult {
    String serverAddress;
    long timestampMillis;
    long latencyMillis;
    boolean reachable;

    ServerCheckResult(String serverAddress, long timestampMillis, long latencyMillis, boolean reachable) {
        this.serverAddress = serverAddress;
        this.timestampMillis = timestampMillis;
        this.latencyMillis = latencyMillis;
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
}
