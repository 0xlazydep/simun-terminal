import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { SciFiCard } from "./SciFiCard";
import { Copy, ExternalLink, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DexPair, ScannerResponse } from "@/types/dexscreener";

const shorten = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const shortenName = (value?: string) => {
  if (!value) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};
const zoraUrl = (address: string) => `https://zora.co/coin/base:${address}`;
const buyUrl = (address: string) =>
  `https://t.me/based_eth_bot?start=r_ursecretwhale_${address}`;
const xSearchUrl = (address: string) =>
  `https://x.com/search?q=${encodeURIComponent(address)}&src=typed_query`;
const toMs = (value?: number | null) => {
  if (!value) return null;
  return value < 10_000_000_000 ? value * 1000 : value;
};
const formatAge = (from: number, now: number) => {
  const diff = Math.max(0, Math.floor((now - from) / 1000));
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${String(minutes % 60).padStart(2, "0")}m ago`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s ago`;
};
const getBuySell = (pair: DexPair) => {
  const buys = pair.txns?.m5?.buys ?? pair.txns?.h24?.buys ?? 0;
  const sells = pair.txns?.m5?.sells ?? pair.txns?.h24?.sells ?? 0;
  const total = buys + sells;
  if (total <= 0) {
    return { buys: 0, sells: 0, total: 0, buyPct: 0.5, sellPct: 0.5 };
  }
  const buyPct = buys / total;
  return { buys, sells, total, buyPct, sellPct: 1 - buyPct };
};

const playSignalSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // ignore audio errors
  }
};

function formatCompact(value?: number | string) {
  if (value === undefined || value === null || value === "") return "--";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "--";
  return num.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
}

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

type TokenColumnProps = {
  title: string;
  quote: "CLANKER" | "ZORA" | "PRINTR";
  onlySignal?: boolean;
};

export function TokenColumn({ title, quote, onlySignal = false }: TokenColumnProps) {
  const [pairs, setPairs] = useState<DexPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const seenSignalRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/defined/scan?quote=${quote}`);
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as ScannerResponse;
        if (!active) return;
        setPairs(data.pairs ?? []);
      } catch {
        if (active) setError("Unavailable");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [quote]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (quote !== "CLANKER" || !onlySignal) return;
    const current = pairs.filter((pair) => pair.signal);
    const currentIds = new Set(current.map((pair) => pair.pairAddress));
    let hasNew = false;
    for (const id of currentIds) {
      if (!seenSignalRef.current.has(id)) {
        hasNew = true;
        break;
      }
    }
    if (hasNew) {
      playSignalSound();
    }
    seenSignalRef.current = currentIds;
  }, [pairs, quote, onlySignal]);

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

  const items = useMemo(() => {
    const filtered = onlySignal ? pairs.filter((pair) => pair.signal) : pairs;
    return filtered.slice(0, 50);
  }, [pairs, onlySignal]);

  return (
    <SciFiCard
      title={title}
      className="h-full flex flex-col"
      noPadding
      contentClassName="h-full flex flex-col min-h-0"
    >
      <div className="flex h-full min-h-0 flex-col p-0">
        <div className="flex items-center justify-between mb-2 border-b border-primary/20 px-2 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-primary tracking-widest">{quote}</span>
          </div>
          <div className="text-[10px] text-primary/50 font-mono">
            {loading ? "SCANNING..." : error ? "OFFLINE" : "LIVE"}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-0 no-scrollbar overscroll-contain">
          <div className="space-y-0">
            {items.length ? (
              items.map((pair, index) => {
                const symbolType = "TOKEN";
                const symbolAddress = pair.baseToken.address;
                return (
                  <div
                    key={`${pair.pairAddress}-${index}`}
                    onClick={() => setLocation(`/token/${symbolAddress}?type=${symbolType}`)}
                    className="group cursor-pointer border-b border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors px-2 py-2"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-16 w-16 rounded-md border border-primary/30 bg-background/50 flex items-center justify-center overflow-hidden">
                        {pair.baseToken.imageUrl ? (
                          <img
                            src={pair.baseToken.imageUrl}
                            alt={`${pair.baseToken.symbol} logo`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                          />
                        ) : (
                          <span className="text-lg font-orbitron text-primary">
                            {(pair.baseToken.symbol?.[0] || "?").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 min-w-0">
                              <span className="font-orbitron text-sm text-primary group-hover:text-white transition-colors truncate">
                                {shortenName(pair.baseToken.name) || pair.baseToken.symbol}
                              </span>
                              <span className="text-[10px] font-mono text-primary/70 whitespace-nowrap">
                                ${pair.baseToken.symbol}
                              </span>
                              <span className="text-[9px] font-mono text-primary/50 whitespace-nowrap">
                                {shorten(pair.baseToken.address)}
                              </span>
                              {pair.signal && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 border border-white/60 text-white">
                                  SIGNAL
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] font-mono text-primary/60 whitespace-nowrap">
                            {toMs(pair.pairCreatedAt)
                              ? formatAge(toMs(pair.pairCreatedAt) as number, now)
                              : "--"}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[9px] font-mono text-primary/70">
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary/50">MC</span>
                            <span className="text-white">${formatCompact(pair.marketCap)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary/50">V 24H</span>
                            <span className="text-white">${formatCompact(pair.volume?.h24)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary/50">TX 24H</span>
                            <span className="text-white">{formatCompact(pair.txnCount?.h24)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary/50">HOLD</span>
                            <span className="text-white">{formatCompact(pair.holders)}</span>
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-mono text-primary/50">
                          <div className="flex items-center gap-2">
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
                            {quote === "CLANKER" && pair.signal && (
                              <a
                                href={xSearchUrl(pair.baseToken.address)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="p-1 border border-primary/20 hover:border-primary/60 hover:bg-primary/10 transition-colors"
                                aria-label={`Search ${pair.baseToken.symbol} on X`}
                              >
                                <Search className="w-3 h-3 text-primary/80" />
                              </a>
                            )}
                            {quote === "ZORA" ? (
                              <a
                                href={zoraUrl(pair.baseToken.address)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                                className="p-1 border border-primary/20 hover:border-primary/60 hover:bg-primary/10 transition-colors"
                                aria-label={`Open ${pair.baseToken.symbol} on Zora`}
                              >
                                <ExternalLink className="w-3 h-3 text-primary/60" />
                              </a>
                            ) : null}
                            <a
                              href={buyUrl(pair.baseToken.address)}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="px-2 py-0.5 border border-primary/30 text-[9px] font-mono text-primary/80 hover:border-primary/60 hover:bg-primary/10 transition-colors"
                              aria-label={`Buy ${pair.baseToken.symbol}`}
                            >
                              BUY
                            </a>
                          </div>
                          {(() => {
                            const { buys, sells, buyPct, sellPct } = getBuySell(pair);
                            return (
                              <div className="flex items-center gap-1">
                                <span className="text-white">B:{buys || 0}</span>
                                <div className="w-12 h-1 bg-white/10 overflow-hidden">
                                  <div
                                    className="h-full bg-green-500"
                                    style={{ width: `${Math.round(buyPct * 100)}%` }}
                                  />
                                  <div
                                    className="h-full bg-red-500"
                                    style={{ width: `${Math.round(sellPct * 100)}%` }}
                                  />
                                </div>
                                <span className="text-white">S:{sells || 0}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center text-xs text-primary/50 font-mono py-6">
                {loading ? "Loading tokens..." : "No data yet."}
              </div>
            )}
          </div>
        </div>
      </div>
    </SciFiCard>
  );
}
