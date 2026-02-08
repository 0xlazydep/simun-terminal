import { useEffect, useRef, useState } from "react";
import {
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { SciFiCard } from "./SciFiCard";
type ChartSectionProps = {
  symbolAddress: string | null;
  symbolType?: "TOKEN" | "POOL";
  timeframe?: Interval;
  onTimeframeChange?: (value: Interval) => void;
};

type Interval = "1s" | "5s" | "10s" | "1m" | "5m" | "1h" | "4h" | "1d";

const DEFAULT_INTERVAL: Interval = "5m";

type Candle = CandlestickData<UTCTimestamp>;

function getThemeColor(varName: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (!value) return fallback;
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length >= 3) {
    const h = Number(parts[0]);
    const s = Number(parts[1].replace("%", ""));
    const l = Number(parts[2].replace("%", ""));
    if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
      const c = (1 - Math.abs(2 * (l / 100) - 1)) * (s / 100);
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = l / 100 - c / 2;
      let r = 0;
      let g = 0;
      let b = 0;
      if (h >= 0 && h < 60) {
        r = c;
        g = x;
      } else if (h < 120) {
        r = x;
        g = c;
      } else if (h < 180) {
        g = c;
        b = x;
      } else if (h < 240) {
        g = x;
        b = c;
      } else if (h < 300) {
        r = x;
        b = c;
      } else {
        r = c;
        b = x;
      }
      const to255 = (v: number) => Math.round((v + m) * 255);
      return `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`;
    }
  }
  return fallback;
}

function toTimestamp(value: number) {
  return (value > 10_000_000_000 ? Math.floor(value / 1000) : value) as UTCTimestamp;
}

export function ChartSection({
  symbolAddress,
  symbolType = "POOL",
  timeframe: externalTimeframe,
  onTimeframeChange,
}: ChartSectionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeframe, setTimeframe] = useState<Interval>(DEFAULT_INTERVAL);
  const activeTimeframe = externalTimeframe ?? timeframe;

  useEffect(() => {
    if (!containerRef.current) return;

    const background = getThemeColor("--background", "#0b0710");
    const foreground = getThemeColor("--foreground", "#f5e9ff");

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      layout: {
        background: { type: "solid", color: background },
        textColor: foreground,
        fontFamily: "Share Tech Mono, monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 0, 255, 0.08)" },
        horzLines: { color: "rgba(255, 0, 255, 0.08)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 0, 255, 0.2)",
      },
      timeScale: {
        borderColor: "rgba(255, 0, 255, 0.2)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#00f5b0",
      downColor: "#ff3b6b",
      borderUpColor: "#00f5b0",
      borderDownColor: "#ff3b6b",
      wickUpColor: "#00f5b0",
      wickDownColor: "#ff3b6b",
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    if (candlesRef.current.length) {
      series.setData(candlesRef.current);
      chart.timeScale().fitContent();
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      chart.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!symbolAddress) {
      candlesRef.current = [];
      setCandles([]);
      return undefined;
    }

    const load = async () => {
      try {
        const res = await fetch(
          `/api/geckoterminal/ohlcv?symbol=${symbolAddress}&symbolType=${symbolType}&interval=${activeTimeframe}`,
        );
        if (!res.ok) {
          if (active) {
            candlesRef.current = [];
            setCandles([]);
          }
          return;
        }
        const json = (await res.json()) as {
          candles?: Array<{ time: number; open: number; high: number; low: number; close: number }>;
        };
        if (!active) return;
        const mapped: Candle[] = (json.candles ?? []).map((c) => ({
          time: toTimestamp(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candlesRef.current = mapped;
        setCandles(mapped);
      } catch {
        if (active) {
          candlesRef.current = [];
          setCandles([]);
        }
      }
    };

    load();
    const intervalId = window.setInterval(load, 10000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [symbolAddress, symbolType, activeTimeframe]);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    seriesRef.current.setData(candles);
    chartRef.current.timeScale().fitContent();
  }, [candles]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "1") (onTimeframeChange ?? setTimeframe)("1m");
      if (event.key === "5") (onTimeframeChange ?? setTimeframe)("5m");
      if (event.key === "3") (onTimeframeChange ?? setTimeframe)("15m");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onTimeframeChange]);

  return (
    <SciFiCard className="h-full flex flex-col" noPadding contentClassName="h-full">
      <div className="h-full w-full" ref={containerRef} />
    </SciFiCard>
  );
}
