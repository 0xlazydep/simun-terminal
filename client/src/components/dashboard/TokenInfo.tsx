import { useEffect, useState } from "react";
import { SciFiCard } from "./SciFiCard";
import { Activity, Database, Layers, Shuffle } from "lucide-react";
import type { DexPair } from "@/types/dexscreener";

type TokenInfoProps = {
  pair: DexPair | null;
};

type OnchainToken = {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  totalSupplyFormatted: string;
};

function formatUsd(value?: number | string) {
  if (value === undefined || value === null || value === "") return "--";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "--";
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}

function shorten(value?: string) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatPct(value?: number) {
  if (value === undefined) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function TokenInfo({ pair }: TokenInfoProps) {
  const [token, setToken] = useState<OnchainToken | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!pair?.baseToken?.address) {
      setToken(null);
      return undefined;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/base/token/${pair.baseToken.address}`);
        if (!res.ok) throw new Error("failed");
        const data = (await res.json()) as OnchainToken;
        if (active) setToken(data);
      } catch {
        if (active) setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [pair?.baseToken?.address]);

  return (
    <SciFiCard title="ASSET ANALYTICS" className="h-full">
      <div className="grid grid-cols-2 gap-4">
        <StatItem
          label="TOKEN"
          value={token?.symbol || pair?.baseToken?.symbol || "--"}
          icon={<Database className="w-4 h-4" />}
          sub={token?.name || pair?.baseToken?.name || shorten(pair?.baseToken?.address)}
        />
        <StatItem
          label="PRICE (USD)"
          value={formatUsd(pair?.priceUsd)}
          icon={<Activity className="w-4 h-4" />}
          change={formatPct(pair?.priceChange?.h24)}
        />
        <StatItem
          label="LIQUIDITY"
          value={formatUsd(pair?.liquidity?.usd)}
          icon={<Layers className="w-4 h-4" />}
          sub={`VOL 24H: ${formatUsd(pair?.volume?.h24)}`}
        />
        <StatItem
          label="SUPPLY"
          value={token?.totalSupplyFormatted || "--"}
          icon={<Shuffle className="w-4 h-4" />}
          sub={`Decimals: ${token?.decimals ?? "--"}`}
        />
      </div>

      <div className="mt-4 border-t border-primary/20 pt-3">
        <div className="grid grid-cols-2 gap-3 text-[10px] font-mono text-primary/60">
          <InfoRow label="BASE" value={shorten(pair?.baseToken?.address)} />
          <InfoRow label="QUOTE" value={shorten(pair?.quoteToken?.address)} />
          <InfoRow label="PAIR" value={shorten(pair?.pairAddress)} />
          <InfoRow label="DEX" value={pair?.dexId ?? "--"} />
        </div>
        {loading && (
          <div className="mt-2 text-[10px] font-mono text-primary/40">Fetching on-chain data...</div>
        )}
      </div>
    </SciFiCard>
  );
}

function StatItem({ label, value, icon, change, sub }: any) {
  return (
    <div className="p-3 border border-primary/10 bg-primary/5 hover:bg-primary/10 transition-colors">
      <div className="flex items-center justify-between mb-2 text-primary/60">
        <span className="text-[10px] font-orbitron">{label}</span>
        {icon}
      </div>
      <div className="font-mono text-xl text-white tracking-wider truncate">{value}</div>
      {change && <div className="text-[10px] font-mono text-white mt-1">{change}</div>}
      {sub && <div className="text-[10px] font-mono text-primary/40 mt-1 truncate">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span>{label}</span>
      <span className="text-primary/80">{value}</span>
    </div>
  );
}
