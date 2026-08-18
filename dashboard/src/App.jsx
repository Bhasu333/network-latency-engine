import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Server, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Clock, 
  Zap, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Sliders,
  Layers,
  Database,
  Radio,
  Info,
  Terminal,
  Copy,
  Check
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

const INITIAL_SERVERS = [
  { id: '1', name: 'google.com', port: 80, baseLatency: 28, loss: 0, status: 'REACHABLE', color: '#06b6d4' },
  { id: '2', name: '1.1.1.1', port: 80, baseLatency: 14, loss: 0, status: 'REACHABLE', color: '#10b981' },
  { id: '3', name: '8.8.8.8', port: 80, baseLatency: 45, loss: 100, status: 'TIMEOUT', color: '#f59e0b' },
  { id: '4', name: '127.0.0.1', port: 80, baseLatency: 0, loss: 100, status: 'CONNECTION_REFUSED', color: '#ef4444' },
  { id: '5', name: 'unreachable.invalid', port: 80, baseLatency: 0, loss: 100, status: 'DNS_FAILURE', color: '#a855f7' },
];

export default function App() {
  const [streamData, setStreamData] = useState([]);
  const [servers, setServers] = useState(INITIAL_SERVERS);
  const [intervalSec, setIntervalSec] = useState(3);
  const [isLive, setIsLive] = useState(true);
  const [showArchModal, setShowArchModal] = useState(false);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [totalProbes, setTotalProbes] = useState(1420);
  const [isJavaConnected, setIsJavaConnected] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    const initialHistory = [];
    const now = Date.now();
    for (let i = 12; i >= 0; i--) {
      const timeStr = new Date(now - i * intervalSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      initialHistory.push({
        time: timeStr,
        'google.com': Math.max(10, Math.floor(28 + (Math.random() * 8 - 4))),
        '1.1.1.1': Math.max(8, Math.floor(14 + (Math.random() * 4 - 2))),
        '8.8.8.8': 0,
        '127.0.0.1': 0,
        'unreachable.invalid': 0,
      });
    }
    setStreamData(initialHistory);
  }, []);

  // Poll local Java REST API (http://localhost:8080/api/telemetry) with automatic simulation fallback
  useEffect(() => {
    if (!isLive) return;

    const timer = setInterval(async () => {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('http://localhost:8080/api/telemetry', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const telemetryList = await res.json();
          if (Array.isArray(telemetryList) && telemetryList.length > 0) {
            setIsJavaConnected(true);

            let googleLat = 28;
            let cloudflareLat = 14;

            setServers(prev => prev.map(s => {
              const item = telemetryList.find(t => t.server === s.name);
              if (item) {
                if (s.name === 'google.com') googleLat = item.latency_ms > 0 ? item.latency_ms : 0;
                if (s.name === '1.1.1.1') cloudflareLat = item.latency_ms > 0 ? item.latency_ms : 0;
                return {
                  ...s,
                  baseLatency: item.latency_ms > 0 ? item.latency_ms : 0,
                  loss: item.packet_loss_pct,
                  status: item.status_detail
                };
              }
              return s;
            }));

            setStreamData(prev => {
              const updated = [...prev.slice(1)];
              updated.push({
                time: timeStr,
                'google.com': googleLat,
                '1.1.1.1': cloudflareLat,
                '8.8.8.8': 0,
                '127.0.0.1': 0,
                'unreachable.invalid': 0,
              });
              return updated;
            });
            setTotalProbes(p => p + 5);
            return;
          }
        }
      } catch (e) {
        setIsJavaConnected(false);
      }

      // Edge Stream Simulation Fallback (when local Java service is not running)
      const newGoogleLat = Math.max(10, Math.floor(28 + (Math.random() * 12 - 6)));
      const newCloudflareLat = Math.max(8, Math.floor(14 + (Math.random() * 6 - 3)));

      setStreamData(prev => {
        const updated = [...prev.slice(1)];
        updated.push({
          time: timeStr,
          'google.com': newGoogleLat,
          '1.1.1.1': newCloudflareLat,
          '8.8.8.8': 0,
          '127.0.0.1': 0,
          'unreachable.invalid': 0,
        });
        return updated;
      });

      setTotalProbes(p => p + 5);

      setServers(prev => prev.map(s => {
        if (s.name === 'google.com') return { ...s, baseLatency: newGoogleLat };
        if (s.name === '1.1.1.1') return { ...s, baseLatency: newCloudflareLat };
        return s;
      }));

    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [isLive, intervalSec]);

  const copyTerminalCmd = () => {
    navigator.clipboard.writeText('javac -d . src/NetworkMonitor.java; java engine.NetworkMonitor --continuous');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const activeReachable = servers.filter(s => s.status === 'REACHABLE').length;
  const avgLatency = Math.round(
    servers.filter(s => s.status === 'REACHABLE').reduce((acc, s) => acc + s.baseLatency, 0) / (activeReachable || 1)
  );

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      {/* Top Navigation Header */}
      <header className="border-b border-slate-800/80 bg-[#111827]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">Network Latency Observability Engine</h1>
                <span className="px-2 py-0.5 text-xs font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded-full">
                  v2.4 Full-Stack
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Multithreaded Java Engine + LinkedBlockingQueue Async Writer + React Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Clickable Data Source Mode Badge */}
            <button
              onClick={() => setShowDataSourceModal(true)}
              className="group relative focus:outline-none"
              title="Click to view Data Source & Local Integration guide"
            >
              {isJavaConnected ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 transition shadow-sm">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> JAVA ENGINE LIVE
                  <Info className="w-3 h-3 text-emerald-400/70 opacity-60 group-hover:opacity-100" />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 transition shadow-sm">
                  <Radio className="w-3.5 h-3.5" /> EDGE SIMULATOR MODE
                  <Info className="w-3 h-3 text-cyan-300/70 opacity-60 group-hover:opacity-100" />
                </span>
              )}
            </button>

            {/* How Live Sync Works Button */}
            <button 
              onClick={() => setShowDataSourceModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-lg text-slate-200 transition"
            >
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              Data Source Info
            </button>

            {/* Architecture Modal Trigger */}
            <button 
              onClick={() => setShowArchModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-lg text-slate-200 transition"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              Architecture Flow
            </button>

            <a 
              href="https://github.com/Bhasu333/network-latency-engine" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition shadow-lg shadow-cyan-600/20"
            >
              GitHub Source
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-cyan-500/40 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg TCP Latency</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white">{avgLatency}</span>
              <span className="text-xs font-mono text-cyan-400">ms</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {activeReachable} Edge Targets Active
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Telemetry Points</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-white">{totalProbes.toLocaleString()}</span>
              <span className="text-xs font-mono text-emerald-400">pts</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              10,000+ daily log throughput
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Async Writer Buffer</span>
              <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-purple-300">LinkedBlockingQueue</span>
            </div>
            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              Zero thread-blocking I/O overhead
            </p>
          </div>

          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failure Diagnostics</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono text-amber-400">3</span>
              <span className="text-xs font-mono text-slate-400">Flagged Hosts</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Categorized: DNS, Timeout, Refused
            </p>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Live Network Latency Stream (TCP Socket Probes)
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Real-time latency metrics (ms) stream collected across worker thread pool
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[#0b0f19] p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="px-2 text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Interval:
              </span>
              {[1, 3, 5].map(sec => (
                <button
                  key={sec}
                  onClick={() => setIntervalSec(sec)}
                  className={`px-2.5 py-1 rounded transition ${intervalSec === sec ? 'bg-cyan-500 text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCloudflare" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="ms" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  itemStyle={{ fontFamily: 'monospace' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="google.com" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorGoogle)" />
                <Area type="monotone" dataKey="1.1.1.1" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCloudflare)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Target Endpoints & Failure Mode Status Matrix
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Differentiated Socket Failure Classification Engine Output
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
              5 Hosts Probe Batch
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Target Server</th>
                  <th className="py-3 px-4">Port</th>
                  <th className="py-3 px-4">TCP Latency</th>
                  <th className="py-3 px-4">Packet Loss</th>
                  <th className="py-3 px-4">Status Detail</th>
                  <th className="py-3 px-4 text-right">Diagnostic Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {servers.map(server => (
                  <tr key={server.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: server.color }} />
                      {server.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">{server.port}</td>
                    <td className="py-3.5 px-4">
                      {server.status === 'REACHABLE' ? (
                        <span className="text-emerald-400 font-bold">{server.baseLatency} ms</span>
                      ) : (
                        <span className="text-slate-500">---</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${server.loss > 0 ? 'bg-red-500' : 'bg-emerald-400'}`}
                            style={{ width: `${server.loss}%` }}
                          />
                        </div>
                        <span className={server.loss > 0 ? 'text-red-400 font-bold' : 'text-slate-400'}>
                          {server.loss.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {server.status === 'REACHABLE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" /> REACHABLE
                        </span>
                      )}
                      {server.status === 'TIMEOUT' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-[11px]">
                          <Clock className="w-3 h-3" /> TIMEOUT
                        </span>
                      )}
                      {server.status === 'CONNECTION_REFUSED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-[11px]">
                          <XCircle className="w-3 h-3" /> REFUSED
                        </span>
                      )}
                      {server.status === 'DNS_FAILURE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold text-[11px]">
                          <WifiOff className="w-3 h-3" /> DNS_FAILURE
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500">
                      <code>{server.status}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* Data Source & Mode Guide Modal */}
      {showDataSourceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 relative shadow-2xl">
            <button 
              onClick={() => setShowDataSourceModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              ✕
            </button>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-cyan-400" />
                Data Source Modes & Local Java Integration
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                This dashboard supports dual data sources: live Vercel cloud streaming and local Java backend integration.
              </p>
            </div>

            <div className="space-y-4 font-mono text-xs">
              
              {/* Mode A: Standalone Cloud Simulator */}
              <div className="p-4 bg-[#0b0f19] border border-cyan-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-cyan-400" /> Mode 1: Edge Stream Simulator (Active by Default)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/30">
                    Cloud Vercel Demo
                  </span>
                </div>
                <p className="text-slate-400 font-sans text-xs">
                  Runs directly on Vercel without requiring any local software. Simulates real-time telemetry streams for <code className="text-cyan-300">google.com</code>, <code className="text-emerald-300">1.1.1.1</code>, and failure modes so recruiters can test the dashboard instantly online.
                </p>
              </div>

              {/* Mode B: Local Java Backend Live Sync */}
              <div className="p-4 bg-[#0b0f19] border border-emerald-500/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Mode 2: Live Local Java Engine Sync (localhost:8080)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/30">
                    Live Java Socket Probes
                  </span>
                </div>
                <p className="text-slate-400 font-sans text-xs">
                  When you run the Java multithreaded backend engine locally on your machine, it opens a lightweight REST endpoint at <code className="text-emerald-300">http://localhost:8080/api/telemetry</code>. This web dashboard automatically detects the local server and switches to <strong>JAVA ENGINE LIVE</strong>!
                </p>

                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <span className="text-slate-400 block mb-1 text-[11px]">Run command to start Java engine locally:</span>
                  <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 text-emerald-400">
                    <code>javac -d . src/NetworkMonitor.java; java engine.NetworkMonitor --continuous</code>
                    <button 
                      onClick={copyTerminalCmd}
                      className="ml-2 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition flex items-center gap-1 text-[11px]"
                      title="Copy command"
                    >
                      {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="text-right">
              <button 
                onClick={() => setShowDataSourceModal(false)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-lg transition"
              >
                Got It, Close Guide
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Architecture Modal */}
      {showArchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-4 relative shadow-2xl">
            <button 
              onClick={() => setShowArchModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              Full-Stack Architecture Overview
            </h3>
            
            <div className="p-4 bg-[#0b0f19] border border-slate-800 rounded-xl space-y-3 font-mono text-xs text-slate-300">
              <div className="p-2.5 bg-slate-900 border border-cyan-500/30 rounded-lg text-cyan-300">
                1. Multithreaded Java Engine: Socket probes (google.com, 1.1.1.1, etc.)
              </div>
              <div className="text-center text-slate-500">↓ (Telemetry Points)</div>
              <div className="p-2.5 bg-slate-900 border border-purple-500/30 rounded-lg text-purple-300">
                2. LinkedBlockingQueue & Async Writer Thread (Zero Thread Blocking I/O)
              </div>
              <div className="text-center text-slate-500">↓ (REST API: http://localhost:8080/api/telemetry)</div>
              <div className="p-2.5 bg-slate-900 border border-emerald-500/30 rounded-lg text-emerald-300">
                3. React 18 + Vite + Tailwind CSS Dashboard (Vercel Cloud Deployment)
              </div>
            </div>

            <div className="text-right">
              <button 
                onClick={() => setShowArchModal(false)}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-lg transition"
              >
                Close Architecture View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0b0f19] py-4 text-center text-xs text-slate-500 font-mono">
        Bhaswath Datla | UW Computer Science & Engineering | Network Observability Engine
      </footer>
    </div>
  );
}
