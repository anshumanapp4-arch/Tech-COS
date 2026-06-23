"use client";

import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import ChatWidget from "@/components/ui/ChatWidget";
import { useEffect } from "react";

const AUTH_ROUTES = ["/login", "/register"];

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated && !isAuthPage) {
        router.push("/login");
      } else if (isAuthenticated && isAuthPage) {
        router.push("/");
      }
    }
  }, [loading, isAuthenticated, isAuthPage, router]);

  // Show a premium loading screen while verifying auth state (only for protected routes)
  if (loading && !isAuthPage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-950">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.3)] animate-pulse">
            <span className="text-white font-black text-xl">A</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
          </div>
        </div>
      </div>
    );
  }


  // If loading is done, make sure we only render children when they match the auth state
  if (!isAuthenticated && !isAuthPage) {
    return null; // Will redirect in useEffect
  }
  if (isAuthenticated && isAuthPage) {
    return null; // Will redirect in useEffect
  }

  return isAuthPage ? (
    // Auth pages: clean, no sidebar
    <>{children}</>
  ) : (
    // App pages: sidebar + ambient glow
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        {/* Ambient background glow */}
        <div className="absolute top-0 -left-1/4 w-[150%] h-[500px] bg-primary/20 blur-[120px] rounded-[100%] pointer-events-none mix-blend-screen opacity-50"></div>

        <div className="relative z-10 p-8">
          {children}
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppLayout>{children}</AppLayout>
    </AuthProvider>
  );
}
