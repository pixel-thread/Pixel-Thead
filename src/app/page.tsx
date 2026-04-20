"use client";
import { useAuth } from "@clerk/nextjs";

export default function LandingPage() {
  const { getToken } = useAuth();
  const token = getToken();
  console.log(!!token ? token : "false");
  return (
    <main className="fixed inset-0 bg-white flex flex-col items-center justify-center overflow-hidden selection:bg-slate-900 selection:text-white antialiased">
      {/* Dynamic Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-size-[32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="opacity-0 animate-fade-in [animation-delay:100ms]">
          <div className="w-1.5 h-1.5 bg-slate-900 rounded-full mb-10 shadow-[0_0_10px_rgba(0,0,0,0.1)]" />
        </div>

        <h1 className="text-7xl capitalize sm:text-8xl md:text-9xl font-semibold tracking-wide text-slate-900 opacity-0 animate-scale-in [animation-delay:300ms] leading-none mb-10">
          pixel thread
        </h1>

        <div className="opacity-0 animate-fade-in [animation-delay:600ms]">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] sm:text-xs font-medium tracking-[0.4em] text-slate-400 uppercase">
            <span>Modern</span>
            <span className="hidden sm:inline opacity-30">•</span>
            <span>Auth</span>
            <span className="hidden sm:inline opacity-30">•</span>
            <span>Infrastructure</span>
          </div>
        </div>

        <div className="mt-20 h-24 w-px bg-linear-to-b from-slate-900 via-slate-200 to-transparent opacity-0 animate-fade-in [animation-delay:900ms]" />
      </div>

      {/* Modern Signature */}
      <footer className="absolute bottom-12 left-0 right-0 flex justify-center opacity-0 animate-fade-in [animation-delay:1200ms]">
        <div className="flex items-center gap-4">
          <div className="h-px w-8 bg-slate-100" />
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.5em] leading-none">
            v1.1.0
          </span>
          <div className="h-px w-8 bg-slate-100" />
        </div>
      </footer>

      {/* Subtle Light leak effect */}
      <div className="absolute top-0 left-1/4 w-[50%] h-75 bg-slate-50/50 blur-[120px] pointer-events-none rounded-full" />
    </main>
  );
}
