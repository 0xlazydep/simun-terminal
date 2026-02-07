import { SciFiCard } from "./SciFiCard";
import { Activity, Users, Clock, Database } from "lucide-react";

export function TokenInfo() {
  return (
    <SciFiCard title="ASSET ANALYTICS" className="h-full">
      <div className="grid grid-cols-2 gap-4">
        <StatItem 
          label="MARKET CAP" 
          value="$45,230,000" 
          icon={<Database className="w-4 h-4" />} 
          change="+5.2%"
        />
        <StatItem 
          label="24H VOLUME" 
          value="$1,200,450" 
          icon={<Activity className="w-4 h-4" />} 
          change="+12.8%"
        />
        <StatItem 
          label="HOLDERS" 
          value="12,450" 
          icon={<Users className="w-4 h-4" />} 
          change="+142"
        />
        <StatItem 
          label="TOKEN AGE" 
          value="142 Days" 
          icon={<Clock className="w-4 h-4" />} 
          sub="Created: 2024-09-12"
        />
      </div>

      <div className="mt-6 border-t border-primary/20 pt-4">
        <h4 className="font-orbitron text-xs text-primary/70 mb-2">SECURITY SCAN</h4>
        <div className="space-y-2">
          <SecurityBar label="CONTRACT RENNOUNCED" value={100} />
          <SecurityBar label="LIQUIDITY LOCKED" value={98} />
          <SecurityBar label="CODE AUDIT" value={85} />
        </div>
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
      <div className="font-mono text-xl text-white tracking-wider">{value}</div>
      {change && <div className="text-[10px] font-mono text-green-400 mt-1">{change}</div>}
      {sub && <div className="text-[10px] font-mono text-primary/40 mt-1">{sub}</div>}
    </div>
  );
}

function SecurityBar({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-mono">
      <div className="w-24 text-primary/60">{label}</div>
      <div className="flex-1 h-2 bg-primary/10 border border-primary/20 relative overflow-hidden">
        <div 
          className="absolute top-0 left-0 h-full bg-primary/60" 
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="w-8 text-right text-primary">{value}%</div>
    </div>
  );
}
