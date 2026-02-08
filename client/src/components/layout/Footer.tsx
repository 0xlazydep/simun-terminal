import { useEffect, useRef, useState } from "react";

export function Footer() {
  const [fps, setFps] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);
  const [prices, setPrices] = useState<Record<string, { priceUsd: number; change24h: number }>>(
    {},
  );
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(performance.now());
  const frameCountRef = useRef(0);

  useEffect(() => {
    const tick = (now: number) => {
      frameCountRef.current += 1;
      const elapsed = now - lastFrameRef.current;
      if (elapsed >= 1000) {
        const nextFps = Math.round((frameCountRef.current * 1000) / elapsed);
        setFps(nextFps);
        frameCountRef.current = 0;
        lastFrameRef.current = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const pingOnce = async () => {
      const start = performance.now();
      try {
        await fetch("/api/ping", { cache: "no-store", signal: controller.signal });
        const ms = Math.round(performance.now() - start);
        if (active) setPing(ms);
      } catch {
        if (active) setPing(null);
      }
    };

    pingOnce();
    const interval = setInterval(pingOnce, 4000);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];
        const url = new URL("https://api.binance.com/api/v3/ticker/24hr");
        url.searchParams.set("symbols", JSON.stringify(symbols));
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) throw new Error("failed");
        const json = (await res.json()) as Array<{
          symbol?: string;
          lastPrice?: string;
          priceChangePercent?: string;
        }>;
        if (!active) return;
        const mapped: Record<string, { priceUsd: number; change24h: number }> = {};
        for (const entry of json) {
          if (!entry.symbol || !entry.lastPrice || !entry.priceChangePercent) continue;
          const priceUsd = Number(entry.lastPrice);
          const change24h = Number(entry.priceChangePercent);
          if (!Number.isFinite(priceUsd) || !Number.isFinite(change24h)) continue;
          const key = entry.symbol.replace("USDT", "");
          mapped[key] = { priceUsd, change24h };
        }
        setPrices(mapped);
      } catch {
        // ignore
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const getPrice = (symbol: string) => {
    const data = prices[symbol];
    if (!data) return { price: "--", change: "--", isPositive: true };
    const price = `$${data.priceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const change = `${data.change24h >= 0 ? "+" : ""}${data.change24h.toFixed(2)}%`;
    return { price, change, isPositive: data.change24h >= 0 };
  };

  return (
    <footer className="border-t border-primary/30 bg-background/90 backdrop-blur h-8 flex items-center px-4 justify-between text-[10px] font-mono shrink-0">
      {/* Tickers */}
      <div className="flex items-center gap-6 overflow-hidden">
        {[
          { symbol: "BTC", color: "#F7931A" },
          { symbol: "ETH", color: "#627EEA" },
          { symbol: "SOL", color: "#14F195" },
          { symbol: "BNB", color: "#F3BA2F" },
        ].map((item) => {
          const data = getPrice(item.symbol);
          return (
            <Ticker
              key={item.symbol}
              symbol={item.symbol}
              iconUrl={`/` + (item.symbol === "BTC"
                ? "bitcoin-btc-logo.png"
                : item.symbol === "ETH"
                ? "ethereum-eth-logo.png"
                : item.symbol === "SOL"
                ? "solana-sol-logo.png"
                : "bnb-bnb-logo.png")}
              price={data.price}
              change={data.change}
              color={item.color}
              isPositive={data.isPositive}
            />
          );
        })}
      </div>

      {/* System Stats */}
      <div className="flex items-center gap-4 text-primary/60">
        <div className="flex items-center gap-1">
          <span>FPS:</span>
          <span className="text-primary">{fps ?? "--"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>PING:</span>
          <span className="text-primary">{ping !== null ? `${ping}ms` : "--"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>SYSTEM ONLINE</span>
        </div>
      </div>
    </footer>
  );
}

function Ticker({
  symbol,
  iconUrl,
  price,
  change,
  color,
  isPositive,
}: {
  symbol: string;
  iconUrl?: string;
  price: string;
  change: string;
  color: string;
  isPositive: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-black/30">
        {iconUrl ? (
          <img src={iconUrl} alt={`${symbol} logo`} className="h-3 w-3" />
        ) : (
          <span className="text-[9px] font-bold text-white">{symbol[0]}</span>
        )}
      </span>
      <span className="font-bold" style={{ color }}>{symbol}</span>
      <span className="text-white">{price}</span>
      <span className="text-white">{change}</span>
    </div>
  );
}
