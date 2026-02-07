import { useState, useEffect } from "react";

export function Footer() {
  const [fps, setFps] = useState(60);
  const [ping, setPing] = useState(24);

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(Math.floor(Math.random() * (60 - 55 + 1) + 55));
      setPing(Math.floor(Math.random() * (45 - 15 + 1) + 15));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="border-t border-primary/30 bg-background/90 backdrop-blur fixed bottom-0 left-0 right-0 z-50 h-8 flex items-center px-4 justify-between text-[10px] font-mono">
      {/* Tickers */}
      <div className="flex items-center gap-6 overflow-hidden">
        <Ticker symbol="BTC" price="$96,450" change="+2.4%" />
        <Ticker symbol="ETH" price="$2,840" change="+1.2%" />
        <Ticker symbol="SOL" price="$145" change="-0.5%" />
        <Ticker symbol="BNB" price="$620" change="+0.8%" />
      </div>

      {/* System Stats */}
      <div className="flex items-center gap-4 text-primary/60">
        <div className="flex items-center gap-1">
          <span>FPS:</span>
          <span className="text-primary">{fps}</span>
        </div>
        <div className="flex items-center gap-1">
          <span>PING:</span>
          <span className="text-primary">{ping}ms</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>SYSTEM ONLINE</span>
        </div>
      </div>
    </footer>
  );
}

function Ticker({ symbol, price, change }: any) {
  const isPositive = change.startsWith("+");
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary font-bold">{symbol}</span>
      <span className="text-white">{price}</span>
      <span className={isPositive ? "text-green-400" : "text-red-400"}>{change}</span>
    </div>
  );
}
