"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Bot, User, Sparkles, AlertCircle, WifiOff } from "lucide-react";
import { authFetch } from "@/lib/auth";

export default function ChatWidget({ theme = "glass", primaryColor = "#10b981" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: "assistant", content: "Hi there! I'm your dedicated AI Assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isEscalated, setIsEscalated] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [chatbotId, setChatbotId] = useState("default");

  useEffect(() => {
    const loadConfig = () => {
      const configStr = localStorage.getItem("chatbot_config");
      if (configStr) {
        try {
          const config = JSON.parse(configStr);
          setChatbotId(config.selectedFileId || "default");
        } catch {
          // Invalid JSON in localStorage
        }
      }
    };
    loadConfig();
    window.addEventListener('chatbot_config_updated', loadConfig);
    
    const openChat = () => setIsOpen(true);
    window.addEventListener('open_chatbot', openChat);
    
    return () => {
      window.removeEventListener('chatbot_config_updated', loadConfig);
      window.removeEventListener('open_chatbot', openChat);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);
    setIsOffline(false);
    
    try {
      const configStr = localStorage.getItem("chatbot_config");
      let config: Record<string, unknown> = {};
      try {
        config = configStr ? JSON.parse(configStr) : {};
      } catch {
        config = {};
      }
      
      const res = await authFetch("/api/chat/", {
        method: "POST",
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          chatbot_id: chatbotId,
          temperature: (config.temperature as number) ?? 0.7,
          system_prompt: (config.systemPrompt as string) ?? "You are AuraOS Assistant. Use the provided context to answer.",
          enable_escalation: (config.enableEscalation as boolean) ?? false
        })
      });

      if (!res.ok) {
        // Handle non-200 responses
        let errorMessage = "Sorry, I encountered an error. Please try again.";
        try {
          const errData = await res.json();
          if (errData.detail) {
            errorMessage = typeof errData.detail === "string" 
              ? errData.detail 
              : "Authentication required. Please log in.";
          }
        } catch {
          errorMessage = `Server error (${res.status}). Please check that the backend is running.`;
        }
        setMessages(prev => [...prev, { role: "assistant", content: errorMessage }]);
        return;
      }

      let data: { response?: string; requires_human?: boolean };
      try {
        data = await res.json();
      } catch {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: "Received an invalid response from the server. Please try again." 
        }]);
        return;
      }
      
      if (data.requires_human) {
        setIsEscalated(true);
      }
      
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response || "I received your message but couldn't generate a response. Please try again." 
      }]);
    } catch (err) {
      console.error("Chat error:", err);
      setIsOffline(true);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "⚠️ Unable to reach the AI service. Please check that the backend server is running on http://localhost:8000 and try again." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const isDark = theme === "dark" || theme === "glass";

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {isOpen ? (
        <div 
          className={`w-[400px] h-[650px] flex flex-col rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-500 animate-in slide-in-from-bottom-10 fade-in ${
            theme === "glass" ? "bg-white/10 backdrop-blur-3xl border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.3)]" : 
            isDark ? "bg-[#0f172a] border border-slate-800" : "bg-slate-50 border border-slate-200"
          }`}
        >
          {/* Header */}
          <div 
            className="p-5 flex justify-between items-center text-white relative overflow-hidden shrink-0"
            style={{ backgroundColor: isEscalated ? "#f97316" : isOffline ? "#ef4444" : primaryColor }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30">
                  {isEscalated ? <AlertCircle className="w-5 h-5 text-white" /> : 
                   isOffline ? <WifiOff className="w-5 h-5 text-white" /> :
                   <Bot className="w-5 h-5 text-white" />}
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-transparent rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)] ${
                  isOffline ? "bg-red-400" : "bg-emerald-400"
                }`} />
              </div>
              <div>
                <div className="font-semibold text-base leading-tight drop-shadow-sm">
                  {isEscalated ? "Live Support" : isOffline ? "Offline" : "AI Assistant"}
                </div>
                <div className="text-xs text-white/80 font-medium tracking-wide">
                  {isEscalated ? "Connecting..." : isOffline ? "Backend unreachable" : chatbotId === "default" ? "Global Knowledge" : "Specialized Memory"}
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)} 
              className="relative z-10 hover:bg-black/20 p-2 rounded-full transition-colors backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 overflow-y-auto p-5 space-y-6 ${isDark ? "text-white" : "text-slate-800"}`}>
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === "user" 
                    ? "bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 text-white" 
                    : isEscalated ? "bg-orange-500 text-white" : "bg-gradient-to-br from-white to-slate-200 border border-slate-300 text-slate-800"
                }`}>
                  {m.role === "user" ? <User className="w-4 h-4" /> : isEscalated ? <AlertCircle className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                
                <div className="flex flex-col gap-1 max-w-[75%]">
                  <div className={`text-[10px] font-medium opacity-50 px-1 ${m.role === "user" ? "text-right" : "text-left"}`}>
                    {m.role === "user" ? "You" : isEscalated ? "Operator" : "Aura"}
                  </div>
                  <div 
                    className={`rounded-2xl px-4 py-3 shadow-sm text-[14px] leading-relaxed whitespace-pre-wrap ${
                      m.role === "user" 
                        ? "text-white rounded-tr-sm" 
                        : isDark ? "bg-white/10 backdrop-blur-md border border-white/5 rounded-tl-sm" : "bg-white border border-slate-100 rounded-tl-sm shadow-md"
                    }`}
                    style={m.role === "user" ? { backgroundColor: primaryColor } : {}}
                  >
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-3 flex-row">
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-gradient-to-br from-white to-slate-200 border border-slate-300 text-slate-800">
                  <Bot className="w-4 h-4" />
                </div>
                <div className={`rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1 ${
                  isDark ? "bg-white/10 backdrop-blur-md border border-white/5" : "bg-white border border-slate-100 shadow-md"
                }`}>
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                  <div className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length === 1 && !isEscalated && (
            <div className="px-5 pb-2 flex flex-wrap gap-2">
              {["Summarize the key points", "What is the main topic?"].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105 ${
                    isDark ? "border-white/20 hover:bg-white/10 text-white/80" : "border-slate-300 hover:bg-slate-100 text-slate-600"
                  }`}
                  style={{ color: primaryColor, borderColor: primaryColor }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className={`p-5 ${isDark ? "bg-black/20 backdrop-blur-md" : "bg-white border-t border-slate-100"}`}>
            {isEscalated ? (
              <div className="text-center text-sm font-medium text-orange-400 py-3 bg-orange-400/10 rounded-2xl border border-orange-400/20 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                Connecting to live operator...
              </div>
            ) : (
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                className={`flex items-center gap-2 rounded-full px-4 py-3 border shadow-inner transition-all ${
                  isDark ? "border-white/10 bg-black/40 text-white focus-within:border-white/30 focus-within:bg-black/60" : "border-slate-200 bg-slate-50 text-slate-900 focus-within:border-slate-400 focus-within:bg-white"
                }`}
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isOffline ? "Backend offline..." : "Type your message..."} 
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-[14px]"
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || isTyping}
                  className="p-2 rounded-full disabled:opacity-30 disabled:scale-100 hover:scale-110 transition-all text-white shadow-md"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="relative group w-16 h-16 rounded-full flex items-center justify-center text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] hover:scale-110 transition-all duration-300"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="absolute inset-0 bg-white/20 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300" />
          <MessageSquare className="w-7 h-7 relative z-10" />
          
          {/* Notification dot */}
          <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-slate-900 rounded-full animate-pulse" />
        </button>
      )}
    </div>
  );
}
