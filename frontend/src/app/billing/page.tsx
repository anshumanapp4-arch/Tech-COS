"use client";

import { useState, useEffect } from "react";
import { authFetch } from "@/lib/auth";
import {
  CreditCard,
  Zap,
  Crown,
  Rocket,
  Building2,
  Check,
  ArrowRight,
  TrendingUp,
  Bot,
  FileText,
  MessageSquare,
  Loader2,
} from "lucide-react";

interface Plan {
  plan_id: string;
  name: string;
  price: number;
  max_chatbots: number;
  max_documents: number;
  max_queries_per_month: number;
  features: string[];
}

interface Usage {
  organization_name: string;
  plan: string;
  chatbots: { used: number; max: number };
  documents: { used: number; max: number };
  queries: { used: number; max: number };
}

const PLAN_ICONS: Record<string, any> = {
  free: Zap,
  starter: Rocket,
  growth: Crown,
  enterprise: Building2,
};

const PLAN_COLORS: Record<string, string> = {
  free: "from-slate-600 to-slate-700",
  starter: "from-blue-600 to-cyan-600",
  growth: "from-purple-600 to-pink-600",
  enterprise: "from-amber-500 to-orange-600",
};

const PLAN_GLOW: Record<string, string> = {
  free: "rgba(100,116,139,0.2)",
  starter: "rgba(59,130,246,0.3)",
  growth: "rgba(168,85,247,0.3)",
  enterprise: "rgba(245,158,11,0.3)",
};

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [plansRes, usageRes] = await Promise.all([
          authFetch("/api/billing/plans"),
          authFetch("/api/billing/usage"),
        ]);
        setPlans(await plansRes.json());
        setUsage(await usageRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      const res = await authFetch("/api/billing/upgrade", {
        method: "POST",
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        // Refresh usage
        const usageRes = await authFetch("/api/billing/usage");
        setUsage(await usageRes.json());
      } else {
        alert(data.detail || "Upgrade failed.");
      }
    } catch (e) {
      alert("Network error.");
    } finally {
      setUpgrading(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto pb-12 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const usagePercent = (used: number, max: number) =>
    Math.min(100, Math.round((used / max) * 100));

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <header className="mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-widest uppercase mb-4">
          <CreditCard className="w-3.5 h-3.5" />
          Billing & Plans
        </div>
        <h1 className="text-4xl font-bold mb-2">Subscription Management</h1>
        <p className="text-white/50">
          Manage your plan, track usage, and upgrade to unlock more power.
        </p>
      </header>

      {/* Current Usage Cards */}
      {usage && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              label: "AI Chatbots",
              icon: Bot,
              used: usage.chatbots.used,
              max: usage.chatbots.max,
              color: "blue",
            },
            {
              label: "Knowledge Documents",
              icon: FileText,
              used: usage.documents.used,
              max: usage.documents.max,
              color: "emerald",
            },
            {
              label: "Monthly Queries",
              icon: MessageSquare,
              used: usage.queries.used,
              max: usage.queries.max,
              color: "purple",
            },
          ].map((stat) => {
            const pct = usagePercent(stat.used, stat.max);
            return (
              <div
                key={stat.label}
                className="bg-[#0a0f1c] border border-white/5 rounded-2xl p-6 relative overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 bg-${stat.color}-500/10 rounded-xl`}>
                      <stat.icon
                        className={`w-5 h-5 text-${stat.color}-400`}
                      />
                    </div>
                    <span className="text-sm font-medium text-white/70">
                      {stat.label}
                    </span>
                  </div>
                  <span className="text-xs text-white/40 font-mono">
                    {stat.used}/{stat.max}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      pct > 80
                        ? "bg-red-500"
                        : pct > 50
                        ? "bg-amber-500"
                        : `bg-${stat.color}-500`
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-right text-[11px] text-white/30 mt-2 font-mono">
                  {pct}% used
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.plan_id] || Zap;
          const gradient = PLAN_COLORS[plan.plan_id] || PLAN_COLORS.free;
          const glow = PLAN_GLOW[plan.plan_id] || PLAN_GLOW.free;
          const isCurrent = usage?.plan === plan.plan_id;
          const isHigher =
            plans.findIndex((p) => p.plan_id === plan.plan_id) >
            plans.findIndex((p) => p.plan_id === usage?.plan);

          return (
            <div
              key={plan.plan_id}
              className={`relative bg-[#0a0f1c] border rounded-3xl p-1 transition-all ${
                isCurrent
                  ? "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]"
                  : "border-white/5 hover:border-white/20"
              }`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                  Current Plan
                </div>
              )}

              <div className="bg-[#0a0f1c] rounded-[1.3rem] p-6 h-full flex flex-col">
                {/* Plan header */}
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-5`}
                  style={{ boxShadow: `0 0 25px ${glow}` }}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {plan.name}
                </h3>

                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-black text-white">
                    {plan.price === 0 ? "Free" : `₹${plan.price.toLocaleString()}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-white/40 text-sm">/month</span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 text-sm text-white/60"
                    >
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Action button */}
                {isCurrent ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-center py-3 rounded-xl text-sm">
                    Active
                  </div>
                ) : isHigher ? (
                  <button
                    onClick={() => handleUpgrade(plan.plan_id)}
                    disabled={!!upgrading}
                    className={`w-full bg-gradient-to-r ${gradient} hover:opacity-90 text-white font-bold py-3 rounded-xl shadow-[0_0_20px_${glow}] transition-all flex items-center justify-center gap-2 group`}
                  >
                    {upgrading === plan.plan_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <TrendingUp className="w-4 h-4" />
                        Upgrade
                        <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </>
                    )}
                  </button>
                ) : (
                  <div className="text-center text-white/30 text-sm py-3">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment Info Notice */}
      <div className="mt-10 bg-[#0a0f1c] border border-white/5 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
          <CreditCard className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white mb-1">Payment Integration</h3>
          <p className="text-white/40 text-sm leading-relaxed">
            Currently running in <span className="text-amber-400 font-semibold">development mode</span>. 
            Plan upgrades are applied instantly without payment.
            When ready for production, configure Razorpay or Stripe API keys in your backend{" "}
            <code className="text-white/50 bg-white/5 px-1.5 py-0.5 rounded text-xs">.env</code> file
            to enable real payment processing.
          </p>
        </div>
      </div>
    </div>
  );
}
