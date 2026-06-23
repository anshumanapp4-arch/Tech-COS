"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileAudio, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/lib/auth";

export default function UploadSection() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [transcription, setTranscription] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus("idle");
      setErrorMessage(null);
      setTranscription(null);
    }
  };

  const resetUpload = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setFile(null);
    setStatus("idle");
    setTranscription(null);
    setErrorMessage(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setErrorMessage(null);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await authFetch("/api/upload/", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        let detail = "Upload failed.";
        try {
          const errData = await res.json();
          detail = errData.detail || detail;
        } catch {
          detail = `Server error (${res.status}). Is the backend running?`;
        }
        setStatus("error");
        setErrorMessage(detail);
        return;
      }

      let data: { file_id?: string; message?: string };
      try {
        data = await res.json();
      } catch {
        setStatus("error");
        setErrorMessage("Invalid response from server.");
        return;
      }

      if (!data.file_id) {
        setStatus("error");
        setErrorMessage("No file ID returned from server.");
        return;
      }

      setStatus("processing");
      
      // Poll for transcription with timeout
      let pollCount = 0;
      const maxPolls = 60; // Max 2 minutes at 2s intervals

      pollingRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > maxPolls) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setStatus("error");
          setErrorMessage("Processing timed out. The file may still be processing in the background. Refresh to check.");
          return;
        }

        try {
          const transRes = await authFetch(`/api/upload/${data.file_id}/transcription`);
          
          if (!transRes.ok) {
            // Don't crash on poll error — just retry
            return;
          }

          let transData: { error?: string; transcription?: string; status?: string };
          try {
            transData = await transRes.json();
          } catch {
            return; // retry next poll
          }

          if (transData.error) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setStatus("error");
            setErrorMessage(transData.error);
          } else if (transData.transcription) {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setTranscription(transData.transcription);
            setStatus("done");
          }
          // else: still processing, keep polling
        } catch {
          // Network error during polling — don't crash, retry next interval
        }
      }, 2000);

    } catch (error) {
      console.error("Upload error:", error);
      setStatus("error");
      setErrorMessage("Cannot connect to the backend server. Please ensure it's running on http://localhost:8000.");
    }
  };

  return (
    <div className="glass-panel p-8 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 z-0" />
      
      <div className="relative z-10">
        <h2 className="text-2xl font-semibold mb-2">Ingest Media</h2>
        <p className="text-white/60 mb-6 text-sm">Upload limitless MP3/MP4 files for multilingual transcription & embedding.</p>

        <div 
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
            isDragging ? "border-blue-400 bg-blue-400/5 scale-[1.02]" : "border-white/20 hover:border-white/40"
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input 
            type="file" 
            id="file-upload" 
            className="hidden" 
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setStatus("idle");
                setErrorMessage(null);
                setTranscription(null);
              }
            }}
            accept="audio/*,video/*,.txt,.csv,.text"
          />
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div key="empty" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center">
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="text-lg font-medium">Click or Drag & Drop your media here</p>
                  <p className="text-white/40 text-sm mt-2">Supports audio, video, and text files • No duration limits</p>
                </label>
              </motion.div>
            ) : (
              <motion.div key="file" initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="flex flex-col items-center">
                <FileAudio className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="font-medium text-lg">{file.name}</p>
                <p className="text-white/50 text-sm mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                
                {status === "idle" && (
                  <div className="flex gap-3 mt-6">
                    <button onClick={handleUpload} className="glass-button max-w-xs">
                      Start Processing
                    </button>
                    <button onClick={resetUpload} className="px-4 py-2 text-white/50 hover:text-white/80 text-sm transition-colors">
                      Cancel
                    </button>
                  </div>
                )}
                {status === "uploading" && (
                  <div className="mt-6 flex items-center gap-3 text-blue-400">
                    <Loader2 className="w-5 h-5 animate-spin" /> Uploading to secure vault...
                  </div>
                )}
                {status === "processing" && (
                  <div className="mt-6 flex items-center gap-3 text-purple-400">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing & transcribing...
                  </div>
                )}
                {status === "error" && (
                  <div className="mt-6 w-full max-w-md">
                    <div className="flex items-center gap-3 text-red-400 font-medium mb-3 justify-center">
                      <AlertCircle className="w-5 h-5" /> Processing Error
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-300">
                      {errorMessage || "An unknown error occurred."}
                    </div>
                    <button 
                      onClick={resetUpload}
                      className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      ← Try another file
                    </button>
                  </div>
                )}
                {status === "done" && transcription && (
                  <div className="mt-6 text-left w-full">
                    <div className="flex items-center gap-3 text-emerald-400 font-medium mb-3 justify-center">
                      <CheckCircle className="w-5 h-5" /> Media ingested & transcribed!
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2 text-sm text-white/80">
                      <h4 className="text-white/40 text-xs uppercase tracking-wider mb-2 font-semibold">Transcription Output</h4>
                      {transcription.split(/(?<=[.?!])\s+/).map((line, idx) => (
                        <p key={idx} className="border-b border-white/5 pb-1">{line}</p>
                      ))}
                    </div>
                    <button 
                      onClick={resetUpload}
                      className="mt-4 text-sm text-white/50 hover:text-white/80 transition-colors"
                    >
                      ← Upload another file
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
