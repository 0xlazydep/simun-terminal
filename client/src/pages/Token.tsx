import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { ChartSection } from "@/components/dashboard/ChartSection";
import { Footer } from "@/components/layout/Footer";

function parseType(search: string) {
  const params = new URLSearchParams(search);
  return params.get("type") === "POOL" ? "POOL" : "TOKEN";
}

export default function TokenPage() {
  const [location] = useLocation();
  const [path, search = ""] = location.split("?");
  const address = useMemo(() => {
    const parts = path.split("/");
    return parts[2] || "";
  }, [path]);
  const symbolType = useMemo(() => parseType(search), [search]);
  const [timeframe, setTimeframe] = useState<
    "1s" | "5s" | "10s" | "1m" | "5m" | "1h" | "4h" | "1d"
  >("5m");
  const [stats, setStats] = useState<{
    priceUSD?: number;
    marketCap?: number;
    volume24?: number;
    txnCount24?: number;
    buyCount5m?: number;
    sellCount5m?: number;
    change5m?: number;
  } | null>(null);
  const [events, setEvents] = useState<
    Array<{
      timestamp: number;
      eventDisplayType: string;
      maker: string;
      transactionHash: string;
      data?: {
        priceUsd?: number;
        priceUsdTotal?: number;
        amountNonLiquidityToken?: number;
      };
    }>
  >([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/defined/token-stats?address=${address}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: any };
        if (!active) return;
        setStats(json.data ?? null);
      } catch {
        if (active) setStats(null);
      }
    };
    if (address) {
      load();
      const interval = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
    return undefined;
  }, [address]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/defined/token-events?address=${address}&limit=30`);
        if (!res.ok) return;
        const json = (await res.json()) as { data?: any[] };
        if (!active) return;
        setEvents(json.data ?? []);
      } catch {
        if (active) setEvents([]);
      }
    };
    if (address) {
      load();
      const interval = setInterval(load, 5000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }
    return undefined;
  }, [address]);


  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30 overflow-hidden">
      <Navbar />

      <main className="flex-1 min-h-0 w-full px-4 md:px-6 py-4 md:py-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-mono text-primary/70">
            TOKEN VIEW {symbolType}
          </div>
          <Link
            href="/"
            className="text-[10px] font-mono uppercase tracking-wider border border-primary/30 text-primary/80 px-3 py-1 hover:border-primary/60 hover:bg-primary/10"
          >
            Back
          </Link>
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 text-[10px] font-mono text-primary/70">
          <div className="flex items-center gap-1">
            {(["1s", "5s", "10s", "1m", "5m", "1h", "4h", "1d"] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={
                  "px-2 py-1 border border-primary/30 uppercase tracking-wider " +
                  (timeframe === tf ? "bg-primary/20 text-white" : "text-primary/70")
                }
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span>MC: {stats?.marketCap ? `$${stats.marketCap.toLocaleString()}` : "--"}</span>
            <span>VOL 24H: {stats?.volume24 ? `$${stats.volume24.toLocaleString()}` : "--"}</span>
            <span>TXN 24H: {stats?.txnCount24 ?? "--"}</span>
            <span>
              B:{stats?.buyCount5m ?? "--"} / S:{stats?.sellCount5m ?? "--"}
            </span>
            <span>
              5m:{" "}
              {typeof stats?.change5m === "number"
                ? `${stats.change5m >= 0 ? "+" : ""}${stats.change5m.toFixed(2)}%`
                : "--"}
            </span>
          </div>
        </div>

        <div className="h-[calc(100%-14rem)]">
          <ChartSection
            symbolAddress={address || null}
            symbolType={symbolType}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />
        </div>

        <div className="mt-3 border border-primary/20 bg-primary/5">
          <div className="px-3 py-2 border-b border-primary/20 text-[10px] font-mono text-primary/70">
            RECENT TRADES
          </div>
          <div className="max-h-56 overflow-y-auto no-scrollbar">
            <table className="w-full text-[10px] font-mono">
              <thead className="text-primary/60">
                <tr className="border-b border-primary/10">
                  <th className="text-left px-3 py-2">AGE</th>
                  <th className="text-left px-3 py-2">PRICE</th>
                  <th className="text-left px-3 py-2">AMT</th>
                  <th className="text-left px-3 py-2">TRADER</th>
                  <th className="text-left px-3 py-2">TX</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => {
                  const isBuy = event.eventDisplayType?.toLowerCase() === "buy";
                  const ageSec = Math.max(0, Math.floor(Date.now() / 1000 - event.timestamp));
                  const age = ageSec < 60 ? `${ageSec}s` : `${Math.floor(ageSec / 60)}m`;
                  const price = Number(event.data?.priceUsd ?? NaN);
                  const amount = Number(
                    event.data?.priceUsdTotal ?? event.data?.amountNonLiquidityToken ?? NaN,
                  );
                  return (
                    <tr
                      key={`${event.transactionHash}-${event.timestamp}-${index}`}
                      className={isBuy ? "bg-green-500/5" : "bg-red-500/5"}
                    >
                      <td className="px-3 py-2">{age}</td>
                      <td className="px-3 py-2">
                        {Number.isFinite(price) ? `$${price.toFixed(6)}` : "--"}
                      </td>
                      <td className="px-3 py-2">
                        {Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "--"}
                      </td>
                      <td className="px-3 py-2">{event.maker?.slice(0, 6)}…{event.maker?.slice(-4)}</td>
                      <td className="px-3 py-2">
                        <a
                          href={`https://basescan.org/tx/${event.transactionHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary/80 hover:text-primary"
                        >
                          {event.transactionHash?.slice(0, 6)}…{event.transactionHash?.slice(-4)}
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {!events.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-primary/50">
                      No recent trades.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
