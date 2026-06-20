"use client";

import { useState, useEffect } from "react";
import { Plus, ArrowLeft, Terminal, Copy, Check, CheckCircle2, Database } from "lucide-react";
import { authFetch } from "@/lib/auth";

type Agent = {
  bot_id: string;
  name: string;
  description: string;
  department: string;
  tags: string;
  file_id: string;
  status: string;
  api_key: string;
  created_at: string;
};

export default function AgentPlatform() {
  const [view, setView] = useState<"list" | "create" | "integration">("list");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  
  // Create Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState("");
  const [tags, setTags] = useState("");
  const [fileId, setFileId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("You are an expert AI assistant.");
  const [temperature, setTemperature] = useState(0.7);
  const [enableEscalation, setEnableEscalation] = useState(false);
  const [availableFiles, setAvailableFiles] = useState<any[]>([]);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAgents();
    fetchFiles();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await authFetch("/api/chatbots/");
      const data = await res.json();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await authFetch("/api/upload/files");
      const data = await res.json();
      setAvailableFiles(data.files || []);
      if (data.files && data.files.length > 0) {
        setFileId(data.files[0].file_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await authFetch("/api/chatbots/", {
        method: "POST",
        body: JSON.stringify({
          name, description, department, tags, file_id: fileId, system_prompt: systemPrompt, temperature, enable_escalation: enableEscalation
        })
      });
      const newAgent = await res.json();
      setAgents([...agents, newAgent]);
      setSelectedAgent(newAgent);
      
      // Select this agent for the global chat widget too
      localStorage.setItem("chatbot_config", JSON.stringify({ selectedFileId: newAgent.bot_id }));
      window.dispatchEvent(new Event('chatbot_config_updated'));
      
      setView("integration");
    } catch (e) {
      console.error(e);
      alert("Failed to create agent");
    }
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (view === "list") {
    return (
      <div className="max-w-6xl mx-auto text-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-end mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold tracking-widest uppercase mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Neural Network Hub
            </div>
            <h1 className="text-5xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-500 tracking-tight">
              Agent Matrix
            </h1>
            <p className="text-slate-400 text-lg">Deploy and monitor isolated AI entities across your ecosystem.</p>
          </div>
          <button 
            onClick={() => setView("create")}
            className="relative overflow-hidden group bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-6 py-3 rounded-xl text-cyan-300 font-bold flex items-center gap-2 transition-all"
          >
            <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
            <Plus className="w-5 h-5" /> Initialize Agent
          </button>
        </div>

        {agents.length === 0 ? (
          <div className="relative py-32 flex flex-col items-center justify-center text-center rounded-3xl border border-white/5 bg-gradient-to-b from-white/[0.02] to-transparent overflow-hidden mt-8">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-slate-900/0 to-slate-900/0"></div>
            <div className="w-24 h-24 mb-8 relative flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-cyan-500/20 rounded-full animate-[spin_4s_linear_infinite]" />
              <div className="absolute inset-2 border-2 border-dashed border-cyan-400/40 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
              <Terminal className="w-8 h-8 text-cyan-400 relative z-10" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-white">No Entities Detected</h3>
            <p className="text-slate-400 text-base mb-8 max-w-md leading-relaxed">
              Your matrix is empty. Initialize your first specialized AI agent to begin automating knowledge retrieval.
            </p>
            <button 
              onClick={() => setView("create")}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-8 py-3 rounded-full font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] hover:-translate-y-0.5"
            >
              Construct Entity
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
            {agents.map(agent => (
              <div 
                key={agent.bot_id} 
                onClick={() => { setSelectedAgent(agent); setView("integration"); }}
                className="group relative bg-[#0a0f1c] rounded-2xl p-1 cursor-pointer transition-all hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/20 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-[#0a0f1c] border border-cyan-500/20 group-hover:border-cyan-500/50 rounded-2xl h-full flex flex-col overflow-hidden">
                  
                  {/* Card Header Background */}
                  <div className="h-20 bg-gradient-to-r from-cyan-900/30 to-blue-900/10 border-b border-cyan-500/10 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold tracking-wider flex items-center gap-1.5 backdrop-blur-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        ONLINE
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-6 pt-0 flex-1 flex flex-col">
                    <div className="w-14 h-14 rounded-xl bg-[#0a0f1c] border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] flex items-center justify-center -mt-7 mb-4 relative z-10">
                      <Terminal className="w-6 h-6 text-cyan-400" />
                    </div>
                    
                    <h3 className="font-bold text-xl mb-2 text-white group-hover:text-cyan-300 transition-colors">{agent.name}</h3>
                    <p className="text-sm text-slate-400 line-clamp-2 mb-6 flex-1">
                      {agent.description || "No description provided. Autonomous agent functioning optimally."}
                    </p>

                    <div className="pt-4 border-t border-white/5 flex justify-between items-center mt-auto">
                      <div className="text-[11px] text-slate-500 font-mono">
                        ID: {agent.bot_id.split('_')[1].toUpperCase()}
                      </div>
                      <div className="text-cyan-400 text-sm font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
                        Connect <ArrowLeft className="w-4 h-4 rotate-180" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (view === "create") {
    return (
      <div className="max-w-4xl mx-auto text-slate-100 pb-20 animate-in fade-in slide-in-from-right-8 duration-500">
        <button 
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-sm text-cyan-500 hover:text-cyan-400 mb-8 transition-colors group font-medium"
        >
          <div className="p-1.5 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Return to Matrix
        </button>

        <div className="mb-10">
          <h1 className="text-4xl font-black mb-2 tracking-tight text-white">Construct Entity</h1>
          <p className="text-slate-400">Define the parameters, knowledge bounds, and directives for your new AI agent.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0a0f1c] border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500" />
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" /> Identity Matrix
              </h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Designation *</label>
                  <input 
                    type="text" 
                    value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g., Nexus-1, SupportCore, OnboardingBot" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Primary Directive (Description)</label>
                  <input 
                    type="text" 
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="What is the operational purpose of this entity?" 
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#0a0f1c] border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden hover:border-cyan-500/40 transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-400" /> Knowledge Assimilation
              </h3>
              
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Data Source Binding</label>
              <select 
                value={fileId} onChange={e => setFileId(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all font-medium mb-6 appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em" }}
              >
                {availableFiles.length === 0 && <option value="">NO DATA SOURCES DETECTED</option>}
                {availableFiles.map(f => <option key={f.file_id} value={f.file_id}>{f.filename}</option>)}
              </select>

              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Behavioral Guardrails</label>
              <textarea 
                value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all font-medium h-32 resize-none font-mono text-sm"
              />
            </div>

            <div className="bg-[#0a0f1c] border border-cyan-500/20 rounded-2xl p-6 relative overflow-hidden hover:border-cyan-500/40 transition-colors">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                Parameter Tuning
              </h3>
              
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Cognitive Temperature</label>
                    <span className="text-emerald-400 font-mono text-xs">{temperature}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.1" 
                    value={temperature} onChange={e => setTemperature(parseFloat(e.target.value))}
                    className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-wider">
                    <span>Deterministic</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/40 border border-white/5 rounded-xl">
                  <div>
                    <h4 className="text-sm font-bold text-white">Human Escalation Protocol</h4>
                    <p className="text-xs text-slate-400 mt-1">If query cannot be answered, halt automation.</p>
                  </div>
                  <button 
                    onClick={() => setEnableEscalation(!enableEscalation)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enableEscalation ? 'bg-emerald-500' : 'bg-slate-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enableEscalation ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4 uppercase tracking-wider">Initialization Status</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Identity Matrix</span>
                  {name ? <Check className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Knowledge Bound</span>
                  {fileId ? <Check className="w-4 h-4 text-emerald-400" /> : <div className="w-2 h-2 rounded-full bg-slate-700" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Security Key</span>
                  <span className="text-xs text-amber-500/70 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded font-mono">PENDING</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <button 
                  onClick={handleCreate}
                  disabled={!name || !fileId}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:shadow-none px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all"
                >
                  Compile & Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "integration" && selectedAgent) {
    const curlCommand = `curl -X POST https://auraos.api/v1/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Query initialization."}],
    "api_key": "${selectedAgent.api_key}"
  }'`;

    return (
      <div className="max-w-4xl mx-auto text-slate-100 pb-20 animate-in zoom-in-95 duration-500">
        <button 
          onClick={() => setView("list")}
          className="flex items-center gap-2 text-sm text-cyan-500 hover:text-cyan-400 mb-8 transition-colors group font-medium"
        >
          <div className="p-1.5 rounded-full bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Return to Matrix
        </button>

        <div className="bg-gradient-to-br from-[#0a0f1c] to-black border border-cyan-500/30 rounded-3xl p-10 relative overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.1)]">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 blur-[80px] rounded-full translate-y-1/3 -translate-x-1/3 pointer-events-none" />
          
          <div className="relative z-10 text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight mb-4">Entity Deployed: {selectedAgent.name}</h1>
            <p className="text-lg text-slate-400 max-w-xl mx-auto">
              Your agent is now active and isolated to its data source. Use the credentials below to interface with it externally.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-black/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Status</p>
              <p className="text-emerald-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Online
              </p>
            </div>
            <div className="bg-black/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Data Source</p>
              <p className="text-white font-medium font-mono text-sm truncate">{selectedAgent.file_id}</p>
            </div>
            <div className="bg-black/50 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-colors" />
              <p className="text-xs text-amber-500/70 uppercase tracking-widest font-bold mb-1 relative z-10">Secret API Key</p>
              <div className="flex items-center justify-between relative z-10">
                <p className="text-amber-400 font-bold font-mono text-sm truncate pr-4">{selectedAgent.api_key}</p>
                <button onClick={() => copySnippet(selectedAgent.api_key)} className="text-amber-400/50 hover:text-amber-400 shrink-0">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="bg-black/50 border border-white/5 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden group col-span-1 md:col-span-3">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Live Testing</p>
                  <p className="text-white font-medium text-sm">Interface directly with this entity now.</p>
                </div>
                <button 
                  onClick={() => {
                    localStorage.setItem("chatbot_config", JSON.stringify({ selectedFileId: selectedAgent.bot_id }));
                    window.dispatchEvent(new Event('chatbot_config_updated'));
                    window.dispatchEvent(new Event('open_chatbot'));
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
                >
                  Launch Interface
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black border border-cyan-500/20 rounded-2xl overflow-hidden relative shadow-2xl">
            <div className="bg-[#0a0f1c] px-6 py-4 border-b border-cyan-500/20 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-cyan-400" />
                <span className="text-sm font-bold text-white uppercase tracking-widest">External Interfacing (REST)</span>
              </div>
              <button 
                onClick={() => copySnippet(curlCommand)}
                className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-cyan-500 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 rounded-lg transition-all"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? "Secured" : "Copy Payload"}
              </button>
            </div>
            <div className="p-6 overflow-x-auto bg-[#02040a]">
              <pre className="text-sm font-mono text-cyan-300/80 leading-relaxed">
                <code>{curlCommand}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
