"use client";

import { Sliders, ShieldAlert, Sparkles, Code2, Database } from "lucide-react";
import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth";

export default function ChatbotConfig() {
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("You are an expert AI assistant. Answer strictly based on the provided audio transcriptions.");
  const [enableEscalation, setEnableEscalation] = useState(true);
  const [files, setFiles] = useState<{file_id: string, filename: string, snippet: string}[]>([]);
  const [selectedFileId, setSelectedFileId] = useState("default");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await authFetch("/api/upload/files");
        const data = await res.json();
        setFiles(data.files || []);
      } catch (e) {
        console.error("Failed to fetch files", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const handleSave = () => {
    localStorage.setItem("chatbot_config", JSON.stringify({ 
      temperature, 
      systemPrompt, 
      enableEscalation,
      selectedFileId 
    }));
    alert("✅ AI Agent Chatbot successfully created and guardrails applied!");
    window.dispatchEvent(new Event('chatbot_config_updated'));
  };

  return (
    <div className="glass-panel p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] pointer-events-none rounded-full mix-blend-screen" />

      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Bot Configuration</h2>
          <p className="text-white/60 text-sm">Tune behavior, guardrails, and UI</p>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Database className="w-4 h-4 text-blue-400" /> Knowledge Base Context
          </label>
          <div className="relative">
            <select 
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="glass-input w-full py-3 px-4 appearance-none cursor-pointer"
            >
              <option value="default">Use All Available Context (Global)</option>
              {files.map(f => (
                <option key={f.file_id} value={f.file_id}>
                  {f.filename}
                </option>
              ))}
            </select>
            {isLoading && <div className="absolute right-4 top-3 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
          </div>
          <p className="text-xs text-white/50">Restricts the AI's memory exclusively to the selected transcription.</p>
        </div>

        <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl shadow-inner">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/80">
              <ShieldAlert className="w-4 h-4 text-orange-400" /> Hybrid Fail-Safe Escalation
            </label>
            <p className="text-xs text-white/50 mt-1">Halt automation and escalate if AI lacks context.</p>
          </div>
          <button 
            onClick={() => setEnableEscalation(!enableEscalation)}
            className={`w-12 h-6 rounded-full transition-all duration-300 relative ${enableEscalation ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-white/20'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform duration-300 shadow-md ${enableEscalation ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-white/80">
            <ShieldAlert className="w-4 h-4 text-red-400" /> System Prompt & Guardrails
          </label>
          <textarea 
            className="glass-input w-full h-32 resize-none focus:border-emerald-500/50 focus:bg-emerald-500/5 transition-colors"
            placeholder="E.g., You are a helpful assistant. Only answer questions based on the uploaded media context."
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between text-sm font-medium text-white/80">
            <span className="flex items-center gap-2"><Sliders className="w-4 h-4 text-purple-400" /> Temperature ({temperature})</span>
          </label>
          <input 
            type="range" min="0" max="1" step="0.1" value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-emerald-400 bg-white/10 h-2 rounded-lg appearance-none cursor-pointer hover:bg-white/20 transition-colors"
          />
          <div className="flex justify-between text-xs text-white/40 font-medium">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/10">
          <label className="flex items-center gap-2 text-sm font-medium text-white/80">
            <Code2 className="w-4 h-4 text-blue-400" /> Widget Appearance
          </label>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-white/50 mb-1">Primary Color</p>
              <div className="flex items-center gap-2 glass-input p-2">
                <input type="color" defaultValue="#10b981" className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
                <span className="text-sm font-mono">#10b981</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-white/50 mb-1">Theme</p>
              <select className="glass-input w-full py-3">
                <option value="glass">Glassmorphism</option>
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
              </select>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="glass-button w-full mt-6 bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all duration-300 py-4 text-base font-semibold"
        >
          Create AI Agent Chatbot
        </button>
      </div>
    </div>
  );
}
