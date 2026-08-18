#!/bin/bash
# AWS EC2 Deployment Script for Network Latency Observability Engine

echo "=== Deploying Network Latency Engine to AWS EC2 ==="

# Install OpenJDK 17 if not installed
if ! command -v java &> /dev/null; then
    echo "Installing OpenJDK 17..."
    sudo yum update -y
    sudo yum install -y java-17-amazon-corretto-headless
fi

# Compile Java application
echo "Compiling Java sources..."
javac -d . src/NetworkMonitor.java

# Copy systemd service file
echo "Configuring systemd background service..."
sudo cp scripts/network-monitor.service /etc/systemd/system/network-monitor.service
sudo systemctl daemon-reload
sudo systemctl enable network-monitor
sudo systemctl restart network-monitor

echo "=== Deployment Successful! ==="
echo "Status: sudo systemctl status network-monitor"
echo "REST API: http://$(curl -s http://checkip.amazonaws.com):8080/api/telemetry"
