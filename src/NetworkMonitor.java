package engine;

import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

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
                writer.write("timestamp,server,latency_ms,packet_loss_pct,reachable");
                writer.newLine();
                writer.flush();
            }
        } catch (IOException e) {
        }
    }

    private void asyncWriteLoop() {
        while (running.get() || !queue.isEmpty()) {
            try {
                ServerCheckResult res = queue.poll();
                if (res != null && writer != null) {
                    writer.write(res.toCsvRow());
                    writer.newLine();
                    writer.flush();
                } else {
                    Thread.sleep(50);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            } catch (IOException e) {
            }
        }
    }

    @Override
    public void close() {
        running.set(false);
        try {
            writerThread.join(1000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (writer != null) {
            try {
                writer.close();
            } catch (IOException e) {
            }
        }
    }
}
