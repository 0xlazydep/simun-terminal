import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CodexChart } from "@/components/dashboard/CodexChart";

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
  const [stats, setStats] = useState<{
    priceUSD?: number;
    marketCap?: number;
    volume24?: number;
    txnCount24?: number;
    buyCount5m?: number;
    sellCount5m?: number;
    change5m?: number;
  } | null>(null);
  const { address: walletAddress } = useWallet();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [gasFee, setGasFee] = useState("2");
  const timeframes = useMemo(
    () => [
      { label: "1s", resolution: "1S", rangeSeconds: 60 * 30 },
      { label: "15s", resolution: "15S", rangeSeconds: 60 * 60 * 6 },
      { label: "1m", resolution: "1", rangeSeconds: 60 * 60 * 24 },
      { label: "5m", resolution: "5", rangeSeconds: 60 * 60 * 24 * 3 },
      { label: "15m", resolution: "15", rangeSeconds: 60 * 60 * 24 * 7 },
      { label: "30m", resolution: "30", rangeSeconds: 60 * 60 * 24 * 14 },
      { label: "1h", resolution: "60", rangeSeconds: 60 * 60 * 24 * 30 },
      { label: "4h", resolution: "240", rangeSeconds: 60 * 60 * 24 * 90 },
      { label: "1d", resolution: "1D", rangeSeconds: 60 * 60 * 24 * 365 },
      { label: "1w", resolution: "7D", rangeSeconds: 60 * 60 * 24 * 365 * 2 },
      { label: "1M", resolution: "1D", rangeSeconds: 60 * 60 * 24 * 30 },
    ],
    [],
  );
  const [timeframe, setTimeframe] = useState(timeframes[3]);

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

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 mb-4 items-stretch">
          <div className="border border-primary/20 bg-primary/5 overflow-hidden min-h-[360px] dex-embed flex flex-col">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-primary/20 bg-black/30">
              {timeframes.map((frame) => (
                <button
                  key={frame.label}
                  type="button"
                  onClick={() => setTimeframe(frame)}
                  className={`px-2 py-1 text-[9px] font-mono border ${
                    frame.label === timeframe.label
                      ? "border-primary text-primary bg-primary/10"
                      : "border-primary/20 text-primary/60 hover:border-primary/60"
                  }`}
                >
                  {frame.label}
                </button>
              ))}
            </div>
            <div className="flex-1 min-h-[420px]">
              <CodexChart
                address={address}
                resolution={timeframe.resolution}
                rangeSeconds={timeframe.rangeSeconds}
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 h-[520px] lg:h-full">
            <div className="border border-primary/20 bg-primary/5 p-4">
              <div className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Wallet</div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Status</span>
                <span className="text-white">
                  {walletAddress ? "CONNECTED" : "DISCONNECTED"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Address</span>
                <span className="text-white">
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "--"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Route</span>
                <span className="text-white">Uniswap v4</span>
              </div>
            </div>

            <div className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3 flex-1">
              <div className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Trade</div>
              <div>
                <label className="text-[10px] font-mono text-primary/60">Amount (WETH)</label>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.0"
                  className="mt-1 w-full border border-primary/30 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono text-primary/60">Slippage (%)</label>
                  <input
                    value={slippage}
                    onChange={(event) => setSlippage(event.target.value)}
                    className="mt-1 w-full border border-primary/30 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-primary/60">Gas (gwei)</label>
                  <input
                    value={gasFee}
                    onChange={(event) => setGasFee(event.target.value)}
                    className="mt-1 w-full border border-primary/30 bg-black/30 px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["0.5", "1", "2"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setSlippage(preset)}
                    className="border border-primary/30 px-2 py-1 text-[9px] font-mono text-primary/70 hover:border-primary"
                  >
                    {preset}% SLIP
                  </button>
                ))}
                {["2", "5", "10"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setGasFee(preset)}
                    className="border border-primary/30 px-2 py-1 text-[9px] font-mono text-primary/70 hover:border-primary"
                  >
                    {preset} GWEI
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button className="border border-primary/60 bg-primary/10 text-primary text-xs font-mono py-2 hover:bg-primary hover:text-black">
                  BUY
                </button>
                <button className="border border-primary/30 text-primary/70 text-xs font-mono py-2 hover:border-primary hover:text-white">
                  SELL
                </button>
              </div>
              <div className="text-[9px] font-mono text-primary/40">
                Configure slippage and gas manually. Trades execute via your connected wallet.
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
