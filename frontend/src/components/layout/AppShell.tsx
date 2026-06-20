"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import ChatWidget from "@/components/ui/ChatWidget";

const AUTH_ROUTES = ["/login", "/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.includes(pathname);

  return (
    <AuthProvider>
      {isAuthPage ? (
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
      )}
    </AuthProvider>
  );
}
