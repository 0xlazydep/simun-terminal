import { useEffect, useState } from "react";
import { SciFiCard } from "./SciFiCard";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DexPair, ScannerResponse } from "@/types/dexscreener";

const formatTime = (value: number) =>
  new Date(value).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
const formatAge = (from: number, now: number) => {
  const diff = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s ago`;
};
const shorten = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const zoraUrl = (address: string) => `https://zora.co/coin/base:${address}`;
const toMs = (value?: number | null) => {
  if (!value) return null;
  return value < 10_000_000_000 ? value * 1000 : value;
};

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "true");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

type ZoraLogsProps = {
  onSelect?: (pair: DexPair) => void;
};

export function ZoraLogs({ onSelect }: ZoraLogsProps) {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/defined/scan?quote=ZORA");
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as ScannerResponse;
        if (!active) return;
        console.log("[ZoraLogs] fetched", {
          pairs: data.pairs?.length ?? 0,
          fetchedAt: data.fetchedAt,
        });
        if (data.pairs?.length) {
          setPairs((prev) => {
            const merged = [...data.pairs, ...prev];
            const seen = new Set<string>();
            const deduped: DexPair[] = [];
            for (const pair of merged) {
              if (seen.has(pair.pairAddress)) continue;
              seen.add(pair.pairAddress);
              deduped.push(pair);
              if (deduped.length >= 50) break;
            }
            return deduped;
          });
        }
        setLastUpdated(Date.now());
      } catch {
        // keep last known pairs on transient failures
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchLogs();
    const interval = window.setInterval(fetchLogs, 10000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleCopy = async (contract: string) => {
    try {
      await copyText(contract);
      toast({
        title: "✅ Copied",
        description: "Contract copied.",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy contract. Try again.",
      });
    }
  };

  return (
    <SciFiCard
      title="ZORA LOGS"
      className="h-full flex flex-col"
      noPadding
      contentClassName="h-full flex flex-col min-h-0"
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        <div className="flex items-center justify-between mb-4 border-b border-primary/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary tracking-widest">ZORA</span>
          </div>
          <div className="text-[10px] text-primary/50 font-mono">
            {loading ? "SCANNING..." : "LIVE"}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-3 no-scrollbar overscroll-contain">
          <div className="space-y-1">
            {pairs.length ? (
              pairs.map((pair, index) => (
                <div
                  key={pair.pairAddress}
                  onClick={() => onSelect?.(pair)}
                  className="group flex items-center justify-between px-2 py-2.5 border border-transparent hover:border-primary/30 hover:bg-primary/10 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500/60 to-fuchsia-500/30 border border-primary/30 flex items-center justify-center">
                      <span className="text-[10px] font-mono text-white/90">Z</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-orbitron text-sm text-primary group-hover:text-white transition-colors truncate">
                            {pair.baseToken.name || pair.baseToken.symbol}
                          </span>
                          <span className="text-[10px] font-mono text-primary/70 whitespace-nowrap">
                            ${pair.baseToken.symbol}
                          </span>
                        </div>
                        {toMs(pair.pairCreatedAt) && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 border border-primary/30 text-primary/70">
                            {formatAge(toMs(pair.pairCreatedAt) as number, now)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-primary/50 truncate">
                        <span>{shorten(pair.baseToken.address)}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCopy(pair.baseToken.address);
                          }}
                          className="p-1 border border-primary/20 hover:border-primary/60 hover:bg-primary/10 transition-colors"
                          aria-label={`Copy ${pair.baseToken.symbol} contract`}
                        >
                          <Copy className="w-3 h-3 text-primary/80" />
                        </button>
                        <a
                          href={zoraUrl(pair.baseToken.address)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="px-1.5 py-0.5 border border-primary/20 text-[9px] font-mono text-primary/80 hover:border-primary/60 hover:bg-primary/10 transition-colors"
                          aria-label={`Open ${pair.baseToken.symbol} on Zora`}
                        >
                          ZORA
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="text-right font-mono text-xs text-primary/70">
                    <div className="text-white">CREATED</div>
                    <div>
                      {toMs(pair.pairCreatedAt)
                        ? formatAge(toMs(pair.pairCreatedAt) as number, now)
                        : "--"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-primary/50 font-mono py-6">
                {loading ? "Monitoring Zora pairs..." : "Waiting for 5m volume spikes..."}
              </div>
            )}
          </div>
        </div>

        {lastUpdated && (
          <div className="pt-3 text-[10px] font-mono text-primary/40">
            Last update: {formatTime(lastUpdated)} ({formatAge(lastUpdated, now)})
          </div>
        )}
      </div>
    </SciFiCard>
  );
}
