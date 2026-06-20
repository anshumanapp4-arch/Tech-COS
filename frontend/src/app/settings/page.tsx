"use client";

import { Settings, Shield, Key, Building2, Mail, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Platform Settings</h1>
        <p className="text-white/50">Manage your account and organization.</p>
      </header>

      <div className="space-y-6">
        {/* Account Info */}
        <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <User className="w-5 h-5 text-blue-400" />
            </div>
            Account Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Full Name</label>
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white">
                {user?.name || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Email</label>
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/40" />
                {user?.email || "—"}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Role</label>
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="capitalize">{user?.role || "—"}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-white/40 uppercase tracking-widest mb-2">Organization</label>
              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-purple-400" />
                {user?.organization_name || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* API Keys */}
        <div className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl">
              <Key className="w-5 h-5 text-amber-400" />
            </div>
            API Configuration
          </h2>
          <p className="text-white/40 text-sm mb-4">
            API keys for external services are configured via your backend <code className="text-white/50 bg-white/5 px-1.5 py-0.5 rounded text-xs">.env</code> file.
          </p>
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 font-mono text-sm text-white/50 space-y-1">
            <p><span className="text-emerald-400">GEMINI_API_KEY</span>=••••••••••••</p>
            <p><span className="text-blue-400">SARVAM_API_KEY</span>=••••••••••••</p>
            <p><span className="text-amber-400">JWT_SECRET</span>=••••••••••••</p>
            <p><span className="text-purple-400">DATABASE_URL</span>=sqlite:///./auraos.db</p>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#0a0f1c] border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-3">
            <Settings className="w-5 h-5" />
            Production Deployment
          </h2>
          <p className="text-white/40 text-sm leading-relaxed">
            Before going live, ensure you:
          </p>
          <ul className="text-white/40 text-sm mt-3 space-y-2 list-disc list-inside">
            <li>Change the <code className="text-white/50 bg-white/5 px-1 rounded text-xs">JWT_SECRET</code> to a strong random value</li>
            <li>Switch <code className="text-white/50 bg-white/5 px-1 rounded text-xs">DATABASE_URL</code> to PostgreSQL</li>
            <li>Configure Razorpay/Stripe API keys for payment processing</li>
            <li>Restrict CORS origins in <code className="text-white/50 bg-white/5 px-1 rounded text-xs">main.py</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
