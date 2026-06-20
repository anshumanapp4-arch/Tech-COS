"use client";

import { useState, useEffect } from "react";
import UploadSection from "@/components/dashboard/UploadSection";
import AgentPlatform from "@/components/dashboard/AgentPlatform";
import AgentControl from "@/components/dashboard/AgentControl";
import { Activity, Database, Zap, TrendingUp, CreditCard } from "lucide-react";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface Usage {
  organization_name: string;
  plan: string;
  chatbots: { used: number; max: number };
  documents: { used: number; max: number };
  queries: { used: number; max: number };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await authFetch("/api/billing/usage");
        if (res.ok) {
          setUsage(await res.json());
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUsage();
  }, []);

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold mb-2">Platform Overview</h1>
          <p className="text-white/50">Manage your AI agents, media ingestion, and custom chatbots.</p>
        </div>
        <div className="flex gap-4">
          {usage && (
            <Link
              href="/billing"
              className="glass-panel px-4 py-2 flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium capitalize">{usage.plan} Plan</span>
            </Link>
          )}
          <div className="glass-panel px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium">System Online</span>
          </div>
        </div>
      </header>

      {/* Quick Stats — now showing real data */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-xl">
            <Database className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-white/50 text-sm">Media Ingested</p>
            <p className="text-2xl font-bold">
              {usage ? usage.documents.used : "—"}{" "}
              <span className="text-sm font-normal text-white/40">
                / {usage ? usage.documents.max : "—"}
              </span>
            </p>
          </div>
        </div>
        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 rounded-xl">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-white/50 text-sm">Active Chatbots</p>
            <p className="text-2xl font-bold">
              {usage ? usage.chatbots.used : "—"}{" "}
              <span className="text-sm font-normal text-white/40">
                / {usage ? usage.chatbots.max : "—"}
              </span>
            </p>
          </div>
        </div>
        <div className="glass-panel p-6 flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-xl">
            <Zap className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-white/50 text-sm">Queries This Month</p>
            <p className="text-2xl font-bold">
              {usage ? usage.queries.used.toLocaleString() : "—"}{" "}
              <span className="text-sm font-normal text-white/40">
                / {usage ? usage.queries.max.toLocaleString() : "—"}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="space-y-8">
          <UploadSection />
          <AgentControl />
        </div>
        <div>
          <AgentPlatform />
        </div>
      </div>
    </div>
  );
}
