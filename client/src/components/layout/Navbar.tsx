import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { DexPair } from "@/types/dexscreener";
import { useLocation } from "wouter";

type NavbarProps = {
  onSelectPair?: (pair: DexPair) => void;
};

export function Navbar({ onSelectPair }: NavbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const toggleSearch = () => {
    setSearchOpen((open) => {
      const next = !open;
      if (!open) {
        requestAnimationFrame(() => searchRef.current?.focus());
      }
      return next;
    });
  };

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [searchOpen]);

  const runSearch = async () => {
    const address = query.trim();
    if (!address) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      toast({
        title: "Invalid address",
        description: "Paste a valid Base token contract address.",
      });
      return;
    }
    setSearching(true);
    try {
      if (!onSelectPair) {
        setLocation(`/token/${address}?type=TOKEN`);
        setSearchOpen(false);
        return;
      }
      const res = await fetch(`/api/defined/token?address=${address}`);
      if (!res.ok) throw new Error("Failed to search");
      const data = (await res.json()) as { pairs?: DexPair[] };
      const pair = data.pairs?.[0];
      if (!pair) {
        toast({
          title: "Not found",
          description: "No Base pairs found for that contract.",
        });
        return;
      }
      onSelectPair(pair);
      setSearchOpen(false);
    } catch {
      toast({
        title: "Search failed",
        description: "Unable to fetch token pairs.",
      });
    } finally {
      setSearching(false);
    }
  };

  return (
    <nav className="border-b border-primary/30 bg-background/80 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full px-2 md:px-3 h-16 flex items-center justify-between">
        {/* Logo Area */}
        <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 border border-primary/50 flex items-center justify-center bg-primary/10 group">
             <img
               src="/favicon.png"
               alt="Simun Logo"
               className="w-8 h-8 logo-green drop-shadow-[0_0_10px_rgba(0,255,128,0.8)]"
             />
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
          <div
            ref={searchWrapRef}
            className={cn(
              "flex items-center border border-primary/40 bg-background/60 backdrop-blur px-1 h-9 transition-all duration-300 ease-out overflow-hidden",
              searchOpen ? "w-56" : "w-9 justify-center"
            )}
          >
            <button
              type="button"
              onClick={toggleSearch}
              onMouseDown={(event) => {
                if (searchOpen) {
                  event.preventDefault();
                }
              }}
              className="p-1 text-primary/80 hover:text-primary transition-colors"
              aria-label="Toggle search"
              aria-expanded={searchOpen}
            >
              <Search className="w-4 h-4" />
            </button>
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") runSearch();
              }}
              placeholder="Search token..."
              className={cn(
                "bg-transparent outline-none text-xs font-mono text-primary/90 placeholder:text-primary/40 transition-all duration-300",
                searchOpen ? "w-full opacity-100 ml-2" : "w-0 opacity-0 ml-0 pointer-events-none"
              )}
            />
            {searchOpen && (
              <button
                type="button"
                onClick={runSearch}
                disabled={searching}
                className="ml-1 px-2 py-1 text-[9px] font-mono uppercase tracking-wider border border-primary/30 text-primary/80 hover:border-primary/60 disabled:opacity-50"
              >
                {searching ? "..." : "Go"}
              </button>
            )}
          </div>

          <Button 
            variant="outline" 
            className="font-orbitron border-primary text-primary hover:bg-primary hover:text-black transition-all duration-300 uppercase tracking-wider h-4 px-2 text-[8px]"
          >
            [ Connect Wallet ]
          </Button>
        </div>
      </div>
    </nav>
  );
}
