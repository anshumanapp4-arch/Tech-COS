"use client";

import { Play, Globe, TerminalSquare } from "lucide-react";
import { useState } from "react";
import { authFetch } from "@/lib/auth";

export default function AgentControl() {
  const [instruction, setInstruction] = useState("");
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const handleExecute = async () => {
    if (!instruction || !url) return;
    setLoading(true);
    setLogs(prev => [...prev, "> Sending command to Web Agent..."]);
    
    try {
      const res = await authFetch("/api/agent/execute", {
        method: "POST",
        body: JSON.stringify({ instruction, target_url: url })
      });
      const data = await res.json();
      setLogs(prev => [...prev, `> Agent tasked with ID: ${data.task_id}`, "> Executing in background... Check backend logs for detailed Playwright output."]);
    } catch (e) {
      setLogs(prev => [...prev, "> Error connecting to Agent service."]);
    }
    setLoading(false);
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
          disabled={loading}
          className="glass-button w-full bg-purple-500 hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" /> {loading ? "Launching Agent..." : "Execute Web Agent"}
        </button>
      </div>

      <div className="mt-6 bg-black/40 rounded-xl p-4 border border-white/5 h-32 overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
          <TerminalSquare className="w-4 h-4" /> Live Execution Logs
        </div>
        <div className="font-mono text-xs text-green-400/80 space-y-1 overflow-y-auto">
          <p>{">"} System ready.</p>
          {logs.map((l, i) => <p key={i}>{l}</p>)}
          <p className="text-white/20 animate-pulse">Waiting for commands...</p>
        </div>
      </div>
    </div>
  );
}
