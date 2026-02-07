import { useState } from "react";
import { SciFiCard } from "./SciFiCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

const tokens = [
  { name: "SIMUN", price: "0.045", liquidity: "1.2M", vol: "450K" },
  { name: "PEPE", price: "0.00004", liquidity: "50M", vol: "12M" },
  { name: "WIF", price: "2.45", liquidity: "25M", vol: "8M" },
  { name: "BONK", price: "0.00002", liquidity: "15M", vol: "5M" },
  { name: "FLOKI", price: "0.0001", liquidity: "10M", vol: "3M" },
  { name: "DOGE", price: "0.12", liquidity: "100M", vol: "40M" },
  { name: "SHIB", price: "0.00001", liquidity: "80M", vol: "30M" },
  { name: "TRUMP", price: "5.60", liquidity: "2M", vol: "1.5M" },
];

export function TokenList() {
  const [filter, setFilter] = useState<"WETH" | "USDC">("WETH");

  return (
    <SciFiCard title="TOKEN SCANNER" className="h-[400px] flex flex-col">
      {/* Filter Header */}
      <div className="flex items-center justify-between mb-4 border-b border-primary/20 pb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono transition-colors ${filter === 'WETH' ? 'text-primary' : 'text-primary/40'}`}>WETH</span>
          <Switch 
            checked={filter === "USDC"}
            onCheckedChange={(c) => setFilter(c ? "USDC" : "WETH")}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary/50 border-primary"
          />
          <span className={`text-xs font-mono transition-colors ${filter === 'USDC' ? 'text-primary' : 'text-primary/40'}`}>USDC</span>
        </div>
        <div className="text-[10px] text-primary/50 font-mono">
          SCANNING...
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-1">
          {tokens.map((token, i) => (
            <div 
              key={token.name}
              className="group flex items-center justify-between p-2 hover:bg-primary/10 border border-transparent hover:border-primary/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-primary/40 text-xs w-4">{(i + 1).toString().padStart(2, '0')}</span>
                <span className="font-orbitron text-sm text-primary group-hover:text-white transition-colors">{token.name}</span>
              </div>
              <div className="text-right font-mono text-xs text-primary/70">
                <div className="text-white">${token.price}</div>
                <div>L: ${token.liquidity}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </SciFiCard>
  );
}
