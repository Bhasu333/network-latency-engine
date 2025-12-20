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
