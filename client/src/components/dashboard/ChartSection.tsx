import { SciFiCard } from "./SciFiCard";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const mockData = [
  { time: "10:00", value: 1200 },
  { time: "10:05", value: 1350 },
  { time: "10:10", value: 1250 },
  { time: "10:15", value: 1400 },
  { time: "10:20", value: 1550 },
  { time: "10:25", value: 1500 },
  { time: "10:30", value: 1600 },
  { time: "10:35", value: 1650 },
  { time: "10:40", value: 1580 },
  { time: "10:45", value: 1750 },
  { time: "10:50", value: 1800 },
  { time: "10:55", value: 1950 },
];

export function ChartSection() {
  return (
    <SciFiCard title="MARKET OVERVIEW // DEXSCREENER" className="h-[400px] flex flex-col">
      <div className="w-full h-full flex flex-col">
        {/* Mock Chart Header */}
        <div className="flex justify-between items-center mb-4 px-2">
          <div className="flex gap-4 text-sm font-mono">
            <span className="text-primary font-bold">SIMUN/WETH</span>
            <span className="text-green-400">+12.5%</span>
            <span className="text-muted-foreground">VOL: $1.2M</span>
          </div>
          <div className="flex gap-2">
            {["1H", "4H", "1D", "1W"].map((tf) => (
              <button key={tf} className="text-xs px-2 py-1 border border-primary/20 hover:bg-primary/20 text-primary/70 transition-colors font-mono">
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Area */}
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ff00ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ff00ff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                stroke="#ff00ff" 
                tick={{fill: '#ff00ff', opacity: 0.5, fontSize: 10, fontFamily: 'Share Tech Mono'}}
                axisLine={{ stroke: '#ff00ff', opacity: 0.2 }}
                tickLine={false}
              />
              <YAxis 
                stroke="#ff00ff" 
                tick={{fill: '#ff00ff', opacity: 0.5, fontSize: 10, fontFamily: 'Share Tech Mono'}}
                axisLine={{ stroke: '#ff00ff', opacity: 0.2 }}
                tickLine={false}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#000', 
                  border: '1px solid #ff00ff', 
                  borderRadius: '0px',
                  fontFamily: 'Share Tech Mono'
                }}
                itemStyle={{ color: '#ff00ff' }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#ff00ff" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SciFiCard>
  );
}
