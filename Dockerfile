# Production Dockerfile for Network Latency Observability Engine
FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

# Copy Java source code
COPY src/ ./src/

# Compile Java application
RUN javac -d . src/NetworkMonitor.java

# Expose Telemetry REST API Port
EXPOSE 8080

# Run continuous background monitoring service
CMD ["java", "engine.NetworkMonitor", "--continuous"]
