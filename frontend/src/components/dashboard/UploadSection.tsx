"use client";

import { useState } from "react";
import { UploadCloud, FileAudio, CheckCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "@/lib/auth";

export default function UploadSection() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [transcription, setTranscription] = useState<string | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    
    try {
      setStatus("processing");
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/api/upload/", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      // Poll for transcription
      const interval = setInterval(async () => {
        try {
          const transRes = await authFetch(`/api/upload/${data.file_id}/transcription`);
          const transData = await transRes.json();
          if (transData.error) {
            clearInterval(interval);
            setStatus("idle");
            alert(transData.error);
          } else if (transData.transcription) {
            clearInterval(interval);
            setTranscription(transData.transcription);
            setStatus("done");
          }
        } catch (e) {}
      }, 2000);

    } catch (error) {
      console.error(error);
      setStatus("idle");
      alert("Upload failed. Ensure backend is running and keys are valid.");
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
              }
            }}
            accept="audio/*,video/*"
          />
          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div key="empty" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}} className="flex flex-col items-center">
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-8 h-8 text-blue-400" />
                  </div>
                  <p className="text-lg font-medium">Click or Drag & Drop your media here</p>
                  <p className="text-white/40 text-sm mt-2">Supports ANY audio/video format • No duration limits</p>
                </label>
              </motion.div>
            ) : (
              <motion.div key="file" initial={{scale: 0.9, opacity: 0}} animate={{scale: 1, opacity: 1}} className="flex flex-col items-center">
                <FileAudio className="w-12 h-12 text-emerald-400 mb-3" />
                <p className="font-medium text-lg">{file.name}</p>
                <p className="text-white/50 text-sm mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                
                {status === "idle" && (
                  <button onClick={handleUpload} className="glass-button mt-6 w-full max-w-xs">
                    Start Processing
                  </button>
                )}
                {status === "uploading" && (
                  <div className="mt-6 flex items-center gap-3 text-blue-400">
                    <Loader2 className="w-5 h-5 animate-spin" /> Uploading to secure vault...
                  </div>
                )}
                {status === "processing" && (
                  <div className="mt-6 flex items-center gap-3 text-purple-400">
                    <Loader2 className="w-5 h-5 animate-spin" /> Transcribing with Deepgram & Chunking...
                  </div>
                )}
                {status === "done" && transcription && (
                  <div className="mt-6 text-left w-full">
                    <div className="flex items-center gap-3 text-emerald-400 font-medium mb-3 justify-center">
                      <CheckCircle className="w-5 h-5" /> Media ingested & transcribed!
                    </div>
                    <div className="bg-black/40 border border-white/10 rounded-lg p-4 max-h-48 overflow-y-auto space-y-2 text-sm text-white/80">
                      <h4 className="text-white/40 text-xs uppercase tracking-wider mb-2 font-semibold">Live Transcription (Line by Line)</h4>
                      {transcription.split(/(?<=[.?!])\s+/).map((line, idx) => (
                        <p key={idx} className="border-b border-white/5 pb-1">{line}</p>
                      ))}
                    </div>
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
