import { Button } from "@/components/ui/button";
import { Wifi, Battery, Radio } from "lucide-react";

export function Navbar() {
  return (
    <nav className="border-b border-primary/30 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo Area */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 border border-primary/50 flex items-center justify-center bg-primary/10 group">
             <img src="/favicon.png" alt="Simun Logo" className="w-8 h-8 drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]" />
             <div className="absolute inset-0 bg-primary/20 scale-0 group-hover:scale-100 transition-transform duration-300" />
          </div>
          <div className="flex flex-col">
            <h1 className="font-orbitron text-xl font-bold tracking-widest text-primary glitch-text" data-text="SIMUN TERMINAL">
              SIMUN TERMINAL
            </h1>
            <span className="text-[10px] text-primary/70 font-mono tracking-[0.2em] uppercase">
              System Online v.2.4
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-6">
          {/* Status Indicators (Hidden on mobile) */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono text-primary/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE FEED
            </div>
            <div className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              <span>NET: STABLE</span>
            </div>
            <div className="flex items-center gap-1">
              <Radio className="w-3 h-3" />
              <span>SIG: 98%</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="font-orbitron border-primary text-primary hover:bg-primary hover:text-black transition-all duration-300 uppercase tracking-wider h-9"
          >
            [ Connect Wallet ]
          </Button>
        </div>
      </div>
    </nav>
  );
}
