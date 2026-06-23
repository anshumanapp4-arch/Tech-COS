"use client";

import { Play, Globe, TerminalSquare, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { authFetch } from "@/lib/auth";

interface AgentStep {
  step: number;
  action: string;
  timestamp: string;
}

export default function AgentControl() {
  const [instruction, setInstruction] = useState("");
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [taskStatus, setTaskStatus] = useState<"idle" | "running" | "completed" | "error">("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const pollTaskStatus = (taskId: string) => {
    let pollCount = 0;
    const maxPolls = 60; // Max 2 minutes at 2s intervals

    pollingRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setLogs(prev => [...prev, "> ⏱️ Polling timeout. Task may still be running in background."]);
        setTaskStatus("completed");
        setLoading(false);
        return;
      }

      try {
        const res = await authFetch(`/api/agent/status/${taskId}`);
        if (!res.ok) {
          // Don't crash on polling errors — just retry
          return;
        }
        
        const data = await res.json();

        // Add any new steps to logs
        if (data.steps && Array.isArray(data.steps)) {
          const newSteps = data.steps.slice(logs.length > 1 ? logs.length - 1 : 0);
          for (const step of newSteps) {
            const stepAction = step.action || "Processing...";
            const prefix = step.step === -1 ? "❌" : `[${step.step}]`;
            setLogs(prev => {
              const newLog = `> ${prefix} ${stepAction}`;
              // Avoid duplicate entries
              if (prev[prev.length - 1] === newLog) return prev;
              return [...prev, newLog];
            });
          }
        }

        if (data.status === "completed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setLogs(prev => [...prev, `> ✅ Task completed successfully. Mode: ${data.mode}`]);
          if (data.result) {
            setLogs(prev => [...prev, `> 📋 Result: ${data.result.substring(0, 200)}`]);
          }
          setTaskStatus("completed");
          setLoading(false);
        } else if (data.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setLogs(prev => [...prev, `> ❌ Task failed: ${data.result || "Unknown error"}`]);
          setTaskStatus("error");
          setLoading(false);
        }
      } catch {
        // Network error during polling — don't crash, just retry
      }
    }, 2000);
  };

  const handleExecute = async () => {
    if (!instruction || !url) return;
    setLoading(true);
    setTaskStatus("running");
    setLogs(["> 🚀 Sending command to Web Agent..."]);
    
    try {
      const res = await authFetch("/api/agent/execute", {
        method: "POST",
        body: JSON.stringify({ instruction, target_url: url })
      });

      if (!res.ok) {
        let errorMsg = "Failed to start agent.";
        try {
          const errData = await res.json();
          errorMsg = errData.detail || errorMsg;
        } catch {
          errorMsg = `Server error (${res.status})`;
        }
        setLogs(prev => [...prev, `> ❌ ${errorMsg}`]);
        setTaskStatus("error");
        setLoading(false);
        return;
      }

      let data: { task_id?: string; mode?: string };
      try {
        data = await res.json();
      } catch {
        setLogs(prev => [...prev, "> ❌ Invalid response from server."]);
        setTaskStatus("error");
        setLoading(false);
        return;
      }

      setLogs(prev => [
        ...prev, 
        `> 📡 Agent tasked — ID: ${data.task_id?.substring(0, 8)}...`,
        `> 🔧 Mode: ${data.mode === "full" ? "Full (Playwright + Gemini)" : "Simulation"}`,
        "> ⏳ Polling for progress..."
      ]);

      // Start polling for status
      pollTaskStatus(data.task_id || "");

    } catch (err) {
      setLogs(prev => [...prev, "> ❌ Cannot connect to backend. Is the server running?"]);
      setTaskStatus("error");
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (taskStatus) {
      case "running": return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case "completed": return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "error": return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <TerminalSquare className="w-4 h-4" />;
    }
  };

  return (
    <div className="glass-panel p-8 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg">
          <Globe className="w-6 h-6 text-purple-400" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold">Web Agent Navigation</h2>
          <p className="text-white/60 text-sm">Autonomous browser control via LLM</p>
        </div>
      </div>

      <div className="space-y-4 flex-1">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Target URL</label>
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="glass-input w-full py-2" 
            placeholder="https://"
          />
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Agent Instruction</label>
          <textarea 
            className="glass-input w-full h-24 resize-none"
            placeholder="e.g. Go to the pricing page and click the 'Start Trial' button..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
        </div>
        
        <button 
          onClick={handleExecute}
          disabled={loading || !instruction.trim() || !url.trim()}
          className="glass-button w-full bg-purple-500 hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Agent Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" /> Execute Web Agent
            </>
          )}
        </button>
      </div>

      <div className="mt-6 bg-black/40 rounded-xl p-4 border border-white/5 h-40 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
          {getStatusIcon()} Live Execution Logs
          {taskStatus === "running" && (
            <span className="ml-auto text-blue-400/60 text-[10px] animate-pulse">LIVE</span>
          )}
        </div>
        <div className="font-mono text-xs text-green-400/80 space-y-1 overflow-y-auto flex-1">
          <p>{"> System ready."}</p>
          {logs.map((l, i) => (
            <p key={i} className={
              l.includes("❌") ? "text-red-400/80" :
              l.includes("✅") ? "text-emerald-400/80" :
              l.includes("⏳") || l.includes("📡") ? "text-blue-400/80" :
              ""
            }>
              {l}
            </p>
          ))}
          {taskStatus === "idle" && (
            <p className="text-white/20 animate-pulse">Waiting for commands...</p>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
