import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CodexChart } from "@/components/dashboard/CodexChart";
import {
  Crosshair,
  LineChart,
  Sliders,
  Network,
  MousePointer,
  Pencil,
  Type,
  Smile,
  Ruler,
  ZoomIn,
  Magnet,
  Lock,
  Eye,
  ChevronDown,
} from "lucide-react";

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
    liquidity?: number;
    holders?: number;
    totalSupply?: number;
    createdAt?: number;
    poolCreatedAt?: number;
    devAddress?: string;
    token?: { info?: { name?: string; symbol?: string } };
    audit?: {
      verified?: boolean;
      noHoneypot?: boolean;
      renounced?: boolean;
      noBlacklist?: boolean;
      buyTax?: number;
      sellTax?: number;
      score?: number;
    };
  } | null>(null);
  const { address: walletAddress } = useWallet();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [gasFee, setGasFee] = useState("2");
  const timeframes = useMemo(
    () => [
      { label: "1s", resolution: "1S", rangeSeconds: 60 * 20 },
      { label: "15s", resolution: "15S", rangeSeconds: 60 * 60 * 4 },
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
  const [hoverBar, setHoverBar] = useState<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null>(null);
  const [summary, setSummary] = useState<{
    last?: { time: number; open: number; high: number; low: number; close: number; volume?: number };
    prevClose?: number;
    volumeSum?: number;
  }>({});
  const [percentScale, setPercentScale] = useState(false);
  const [logScale, setLogScale] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [crosshairVisible, setCrosshairVisible] = useState(true);
  const [zoomSignal, setZoomSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const shortAddress = useMemo(() => {
    if (!address) return "--";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);
  type TradeRow = {
    id: string;
    ageSeconds: number;
    type: "BUY" | "SELL";
    marketCap?: number;
    amount?: number;
    totalEth?: number;
    trader?: string;
    priceUsd?: number;
    tracked?: boolean;
  };
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradeFilter, setTradeFilter] = useState<"ALL" | "BUY" | "SELL">("ALL");

  const formatPrice = (value?: number) => {
    if (value == null || Number.isNaN(value)) return "--";
    if (value >= 1) return value.toFixed(6);
    if (value >= 0.01) return value.toFixed(8);
    if (value >= 0.0001) return value.toFixed(10);
    return value.toFixed(12);
  };

  const formatVolume = (value?: number) => {
    if (value == null || Number.isNaN(value)) return "--";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return value.toFixed(2);
  };

  const formatAge = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

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
    if (!address) return;
    let active = true;
    const loadTrades = async () => {
      setTradesLoading(true);
      try {
        const res = await fetch(`/api/defined/token-events?address=${address}&limit=30`);
        if (!res.ok) throw new Error("Failed to fetch trades");
        const json = (await res.json()) as any;
        const events = json?.data?.events ?? json?.events ?? [];
        const now = Date.now();
        const mapped: TradeRow[] = Array.isArray(events)
          ? events.map((event: any, index: number) => {
              const ts = event.timestamp ?? event.time ?? event.createdAt ?? now;
              const ageSeconds = Math.max(0, Math.floor((now - Number(ts)) / 1000));
              const sideRaw = `${event.side ?? event.type ?? event.action ?? ""}`.toUpperCase();
              const type = sideRaw.includes("SELL") ? "SELL" : "BUY";
              return {
                id: event.id ?? event.txHash ?? `${index}-${ts}`,
                ageSeconds,
                type,
                marketCap: event.marketCap ?? event.mc,
                amount: event.amount ?? event.tokenAmount,
                totalEth: event.totalEth ?? event.ethAmount ?? event.quoteAmount,
                trader: event.trader ?? event.maker ?? event.wallet,
                priceUsd: event.priceUsd ?? event.price,
                tracked: event.tracked ?? event.watch,
              };
            })
          : [];
        if (active) setTrades(mapped);
      } catch {
        if (active) setTrades([]);
      } finally {
        if (active) setTradesLoading(false);
      }
    };
    loadTrades();
    const interval = setInterval(loadTrades, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [address]);


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/30">
      <Navbar />

      <main className="flex-1 min-h-0 w-full px-3 sm:px-4 md:px-6 py-1 sm:py-2 md:py-2 overflow-y-auto page-enter">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1 panel-rise">
          <Link
            href="/"
            className="text-[10px] font-mono uppercase tracking-wider border border-primary/30 text-primary/80 px-3 py-1 hover:border-primary/60 hover:bg-primary/10"
          >
            Back
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-[9px] sm:text-[10px] font-mono text-primary/70 panel-rise delay-1">
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

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 mb-4 items-stretch panel-rise delay-2">
          <div className="flex flex-col gap-4">
            <div className="border border-primary/20 bg-primary/5 overflow-hidden min-h-[240px] sm:min-h-[300px] md:min-h-[360px] dex-embed flex flex-col">
              <div className="relative flex-1 min-h-[260px] sm:min-h-[320px] md:min-h-[380px] pb-12">
              <div className="absolute left-0 right-0 top-0 bottom-12">
                <CodexChart
                  address={address}
                  resolution={timeframe.resolution}
                  rangeSeconds={timeframe.rangeSeconds}
                  logScale={logScale}
                  percentScale={percentScale}
                  autoScale={autoScale}
                  crosshairVisible={crosshairVisible}
                  zoomSignal={zoomSignal}
                  resetSignal={resetSignal}
                  onHover={setHoverBar}
                  onSummary={setSummary}
                />
              </div>
              <div className="pointer-events-none absolute inset-0 bottom-12 flex items-center justify-center">
                <span className="chart-watermark">NDI JP NE MUN</span>
              </div>

              <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 px-3 sm:px-4 py-2 bg-black/60 border-b border-primary/20">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-mono text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="text-primary/80">
                      {stats?.token?.info?.name || "TOKEN"} / {stats?.token?.info?.symbol || "BASE"}
                    </span>
                    <span className="text-[10px] text-primary/50">on Base · {timeframe.label}</span>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] sm:text-[10px] font-mono text-primary/70">
                  {hoverBar ? (
                    <>
                      <span>O {formatPrice(hoverBar.open)}</span>
                      <span>H {formatPrice(hoverBar.high)}</span>
                      <span>L {formatPrice(hoverBar.low)}</span>
                      <span>C {formatPrice(hoverBar.close)}</span>
                    </>
                  ) : summary.last ? (
                    <>
                      <span>O {formatPrice(summary.last.open)}</span>
                      <span>H {formatPrice(summary.last.high)}</span>
                      <span>L {formatPrice(summary.last.low)}</span>
                      <span>C {formatPrice(summary.last.close)}</span>
                    </>
                  ) : (
                    <span>Loading OHLC...</span>
                  )}
                  {summary.last && summary.prevClose != null && (
                    <span>
                      {summary.last.close >= summary.prevClose ? "+" : ""}
                      {(((summary.last.close - summary.prevClose) / summary.prevClose) * 100).toFixed(2)}%
                    </span>
                  )}
                  <span>Vol {formatVolume(summary.volumeSum)}</span>
                </div>
              </div>

              <div className="pointer-events-auto absolute left-3 sm:left-4 right-3 sm:right-4 bottom-2 z-10 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 bg-black/60 px-2 py-1 rounded">
                  {timeframes.map((frame) => (
                    <button
                      key={frame.label}
                      type="button"
                      onClick={() => setTimeframe(frame)}
                      className={`px-2 py-1 text-[9px] font-mono smooth-btn ${
                        frame.label === timeframe.label
                          ? "text-primary bg-primary/10"
                          : "text-primary/60 hover:text-primary"
                      }`}
                    >
                      {frame.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-mono text-primary/70 bg-black/60 px-2 py-1 rounded">
                  <button
                    type="button"
                    onClick={() => {
                      setPercentScale((v) => !v);
                      if (!percentScale) setLogScale(false);
                    }}
                    className={`px-2 py-1 smooth-btn ${percentScale ? "text-primary bg-primary/10" : "text-primary/60 hover:text-primary"}`}
                  >
                    %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLogScale((v) => !v);
                      if (!logScale) setPercentScale(false);
                    }}
                    className={`px-2 py-1 smooth-btn ${logScale ? "text-primary bg-primary/10" : "text-primary/60 hover:text-primary"}`}
                  >
                    log
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoScale((v) => !v)}
                    className={`px-2 py-1 smooth-btn ${autoScale ? "text-primary bg-primary/10" : "text-primary/60 hover:text-primary"}`}
                  >
                    auto
                  </button>
                </div>
              </div>

              <div className="pointer-events-auto absolute left-1 top-16 z-10 flex flex-col gap-2 panel-rise delay-3">
                <button
                  type="button"
                  onClick={() => setToolbarOpen((v) => !v)}
                  className={`p-2 border smooth-btn ${toolbarOpen ? "border-primary text-primary" : "border-primary/20 text-primary/70"}`}
                  aria-label="Toggle toolbar"
                >
                  <Sliders className="h-4 w-4" />
                </button>
                <div
                  className={`toolbar-panel overflow-hidden ${toolbarOpen ? "toolbar-panel--open" : ""}`}
                  aria-hidden={!toolbarOpen}
                >
                  <div className="flex max-h-[240px] flex-col gap-1.5 overflow-y-auto rounded-md border border-primary/20 bg-black/70 p-2 text-primary/70 no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setCrosshairVisible((v) => !v)}
                      className={`p-1.5 border smooth-btn ${crosshairVisible ? "border-primary text-primary" : "border-primary/20 text-primary/60"}`}
                    >
                      <Crosshair className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetSignal((v) => v + 1)}
                      className="p-1.5 border border-primary/20 hover:border-primary/60 smooth-btn"
                    >
                      <LineChart className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setAutoScale((v) => !v)}
                      className={`p-1.5 border smooth-btn ${autoScale ? "border-primary text-primary" : "border-primary/20 text-primary/60"}`}
                    >
                      <Sliders className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPercentScale((v) => !v)}
                      className={`p-1.5 border smooth-btn ${percentScale ? "border-primary text-primary" : "border-primary/20 text-primary/60"}`}
                    >
                      <Network className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogScale((v) => !v)}
                      className={`p-1.5 border smooth-btn ${logScale ? "border-primary text-primary" : "border-primary/20 text-primary/60"}`}
                    >
                      <MousePointer className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomSignal((v) => v + 1)}
                      className="p-1.5 border border-primary/20 hover:border-primary/60 smooth-btn"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoomSignal((v) => v - 1)}
                      className="p-1.5 border border-primary/20 hover:border-primary/60 smooth-btn"
                    >
                      <Ruler className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Type className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Smile className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Magnet className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Lock className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-1.5 border border-primary/20 opacity-40">
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Recent Trades</div>
                <div className="flex items-center gap-2 text-[9px] font-mono">
                  {(["ALL", "BUY", "SELL"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setTradeFilter(filter)}
                      className={`border px-2 py-1 uppercase tracking-wider ${
                        tradeFilter === filter
                          ? "border-primary text-primary bg-primary/10"
                          : "border-primary/20 text-primary/60 hover:text-primary"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_90px_70px] gap-2 text-[9px] font-mono text-primary/50 uppercase tracking-wider">
                <span>Age</span>
                <span>Type</span>
                <span>MC</span>
                <span>Amount</span>
                <span>Total ETH</span>
                <span>Trader</span>
                <span>Price</span>
                <span>Track</span>
              </div>

              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto no-scrollbar">
                {tradesLoading && (
                  <div className="text-[10px] font-mono text-primary/40">Loading trades...</div>
                )}
                {!tradesLoading &&
                  (tradeFilter === "ALL" ? trades : trades.filter((t) => t.type === tradeFilter)).map((trade) => (
                    <div
                      key={trade.id}
                      className="grid grid-cols-[60px_60px_1fr_1fr_1fr_1fr_90px_70px] gap-2 text-[10px] font-mono text-primary/70"
                    >
                      <span>{formatAge(trade.ageSeconds)}</span>
                      <span className={trade.type === "BUY" ? "text-primary" : "text-red-400"}>
                        {trade.type}
                      </span>
                      <span>{trade.marketCap != null ? `$${trade.marketCap.toLocaleString()}` : "--"}</span>
                      <span>{trade.amount != null ? trade.amount.toLocaleString() : "--"}</span>
                      <span>{trade.totalEth != null ? trade.totalEth.toFixed(4) : "--"}</span>
                      <span>
                        {trade.trader ? `${trade.trader.slice(0, 6)}...${trade.trader.slice(-4)}` : "--"}
                      </span>
                      <span>{trade.priceUsd != null ? `$${trade.priceUsd.toFixed(8)}` : "--"}</span>
                      <span>{trade.tracked == null ? "--" : trade.tracked ? "ON" : "OFF"}</span>
                    </div>
                  ))}
                {!tradesLoading && trades.length === 0 && (
                  <div className="text-[10px] font-mono text-primary/40">No trade data yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:h-full">
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

            <div className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
              <div className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Token Info</div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Total Liquidity</span>
                <span className="text-white">{stats?.liquidity ? `$${stats.liquidity.toLocaleString()}` : "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Pair</span>
                <span className="text-white">{shortAddress}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Dev</span>
                <span className="text-white">
                  {stats?.devAddress
                    ? `${stats.devAddress.slice(0, 6)}...${stats.devAddress.slice(-4)}`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Token Value</span>
                <span className="text-white">{stats?.priceUSD ? `$${stats.priceUSD.toFixed(8)}` : "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Market Cap</span>
                <span className="text-white">{stats?.marketCap ? `$${stats.marketCap.toLocaleString()}` : "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Holders</span>
                <span className="text-white">{stats?.holders ?? "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Total Supply</span>
                <span className="text-white">{stats?.totalSupply ?? "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Token Created</span>
                <span className="text-white">{stats?.createdAt ? new Date(stats.createdAt).toLocaleString() : "--"}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Pool Created</span>
                <span className="text-white">{stats?.poolCreatedAt ? new Date(stats.poolCreatedAt).toLocaleString() : "--"}</span>
              </div>
            </div>

            <div className="border border-primary/20 bg-primary/5 p-4 flex flex-col gap-3">
              <div className="text-[11px] font-mono text-primary/70 uppercase tracking-wider">Token Audit</div>
              {[
                { label: "Contract Verified", value: stats?.audit?.verified },
                { label: "No Honeypot", value: stats?.audit?.noHoneypot },
                { label: "Renounced", value: stats?.audit?.renounced },
                { label: "No Blacklist", value: stats?.audit?.noBlacklist },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                  <span>{item.label}</span>
                  <span className="text-white">{item.value == null ? "--" : item.value ? "YES" : "NO"}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>B/S Tax</span>
                <span className="text-white">
                  {stats?.audit?.buyTax != null || stats?.audit?.sellTax != null
                    ? `Buy ${stats?.audit?.buyTax ?? 0}% / Sell ${stats?.audit?.sellTax ?? 0}%`
                    : "--"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-primary/60">
                <span>Security Metrics</span>
                <span className="text-white">{stats?.audit?.score ?? "--"}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
