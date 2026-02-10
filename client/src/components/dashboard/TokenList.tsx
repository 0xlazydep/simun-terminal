import { useEffect, useMemo, useState } from "react";
import { SciFiCard } from "./SciFiCard";
import { Copy, TrendingUp, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DexPair, ScannerAlert, ScannerResponse } from "@/types/dexscreener";

const gradients = [
  "from-fuchsia-500/60 to-pink-500/30",
  "from-emerald-500/50 to-lime-500/30",
  "from-sky-500/50 to-cyan-500/30",
  "from-orange-500/60 to-amber-500/30",
  "from-violet-500/50 to-purple-500/30",
  "from-yellow-500/60 to-orange-500/30",
  "from-rose-500/60 to-red-500/30",
  "from-indigo-500/50 to-blue-500/30",
];

const shorten = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const shortenName = (value?: string) => {
  if (!value) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
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

function formatUsd(value?: number | string) {
  if (value === undefined || value === null || value === "") return "--";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "--";
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return null;
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function gradientForSymbol(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash + symbol.charCodeAt(i)) % gradients.length;
  }
  return gradients[hash];
}

type TokenListProps = {
  selectedPairAddress?: string | null;
  onSelect?: (pair: DexPair) => void;
};

export function TokenList({ selectedPairAddress, onSelect }: TokenListProps) {
  const filter: "CLANKER" = "CLANKER";
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [alert, setAlert] = useState<ScannerAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const { toast } = useToast();

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

  useEffect(() => {
    let active = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/defined/scan?quote=${filter}`);
        if (!res.ok) throw new Error("Failed to load pairs");
        const data = (await res.json()) as ScannerResponse;
        if (!active) return;
        setPairs(data.pairs ?? []);
        if (data.alerts?.length) {
          setAlert(data.alerts[0]);
        }
        setLastUpdated(Date.now());
      } catch (err) {
        if (active) setError("Scanner unavailable");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [filter]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pairs.length || !onSelect) return;
    if (!selectedPairAddress) {
      onSelect(pairs[0]);
    }
  }, [pairs, selectedPairAddress, onSelect]);

  const alertPair = useMemo(() => {
    if (!alert) return null;
    return pairs.find((pair) => pair.pairAddress === alert.pairAddress) ?? null;
  }, [alert, pairs]);

  return (
    <SciFiCard
      title="CLANKER LOGS"
      className="h-full flex flex-col"
      noPadding
      contentClassName="h-full flex flex-col min-h-0"
    >
      <div className="flex h-full min-h-0 flex-col p-4">
        <div className="flex items-center justify-between mb-4 border-b border-primary/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary tracking-widest">CLANKER</span>
          </div>
          <div className="text-[10px] text-primary/50 font-mono">
            {loading ? "SCANNING..." : error ? "OFFLINE" : "LIVE"}
          </div>
        </div>

        {alert && (
          <div className="mb-3 flex items-center justify-between gap-2 border border-primary/40 bg-primary/10 px-3 py-2 text-[10px] font-mono text-primary/90">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3" />
              <span>
                VOLUME SPIKE: {alert.baseSymbol}/{alert.quoteSymbol} {formatPercent(alert.volumeChangeM5Pct)} (5m)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {alertPair && (
                <button
                  type="button"
                  onClick={() => onSelect?.(alertPair)}
                  className="border border-primary/30 px-2 py-0.5 text-[9px] uppercase tracking-wider"
                >
                  View
                </button>
              )}
              <button type="button" onClick={() => setAlert(null)} aria-label="Dismiss alert">
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto pr-3 no-scrollbar overscroll-contain">
          <div className="space-y-1">
            {pairs.map((pair, index) => {
              const isSelected = pair.pairAddress === selectedPairAddress;
              const delta = pair.volumeChangeM5Pct;
              const deltaText = formatPercent(delta);
              const deltaHot = delta !== null && delta >= 0.3;
              return (
                <div
                  key={pair.pairAddress}
                  onClick={() => onSelect?.(pair)}
                  className={
                    "group flex items-center justify-between px-2 py-2.5 transition-all cursor-pointer border " +
                    (isSelected
                      ? "border-primary/60 bg-primary/10"
                      : "border-transparent hover:border-primary/30 hover:bg-primary/10")
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-full bg-gradient-to-br ${gradientForSymbol(
                        pair.baseToken.symbol
                      )} border border-primary/30 flex items-center justify-center`}
                    >
                      <span className="text-[10px] font-mono text-white/90">
                        {pair.baseToken.symbol?.[0] ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="font-orbitron text-sm text-primary group-hover:text-white transition-colors truncate">
                            {shortenName(pair.baseToken.name) || pair.baseToken.symbol},{" "}
                            <span className="text-primary/70">${pair.baseToken.symbol}</span>
                          </span>
                          <span className="text-[9px] font-mono text-primary/50 whitespace-nowrap">
                            {shorten(pair.baseToken.address)}
                          </span>
                        </div>
                        {deltaText && (
                          <span
                            className={
                              "text-[9px] font-mono px-1.5 py-0.5 border " +
                              (deltaHot ? "border-white/60 text-white" : "border-primary/30 text-primary/60")
                            }
                          >
                            {deltaText}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-primary/50 truncate">
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
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right font-mono text-xs text-primary/70">
                      <div className="text-white">{formatUsd(pair.priceUsd ?? "")}</div>
                      <div>L: {formatUsd(pair.liquidity?.usd ?? 0)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!pairs.length && !loading && (
              <div className="text-center text-xs text-primary/50 font-mono py-6">
                Waiting for 5m volume spikes...
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
