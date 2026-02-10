import { PriceScaleMode, createChart, type IChartApi, type ISeriesApi } from "lightweight-charts";
import { useEffect, useMemo, useRef, useState } from "react";

type CodexChartProps = {
  address: string;
  resolution: string;
  rangeSeconds: number;
  logScale?: boolean;
  percentScale?: boolean;
  autoScale?: boolean;
  crosshairVisible?: boolean;
  zoomSignal?: number;
  resetSignal?: number;
  onHover?: (bar: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  } | null) => void;
  onSummary?: (summary: {
    last?: { time: number; open: number; high: number; low: number; close: number; volume?: number };
    prevClose?: number;
    volumeSum?: number;
  }) => void;
};

type BarResponse = {
  o?: Array<number | null>;
  h?: Array<number | null>;
  l?: Array<number | null>;
  c?: Array<number | null>;
  t?: Array<number | null>;
  volume?: Array<number | null>;
};

export function CodexChart({
  address,
  resolution,
  rangeSeconds,
  logScale,
  percentScale,
  autoScale = true,
  onHover,
  onSummary,
  crosshairVisible = true,
  zoomSignal,
  resetSignal,
}: CodexChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);
  const [barSpacing, setBarSpacing] = useState(4);

  const resolutionSeconds = useMemo(
    () => ({
      "1S": 1,
      "5S": 5,
      "15S": 15,
      "30S": 30,
      "1": 60,
      "5": 300,
      "15": 900,
      "30": 1800,
      "60": 3600,
      "240": 14400,
      "720": 43200,
      "1D": 86400,
      "7D": 604800,
    }),
    [],
  );

  const range = useMemo(() => {
    const secondsPerBar = resolutionSeconds[resolution] ?? 300;
    const maxPoints = 1400;
    const maxRange = maxPoints * secondsPerBar;
    const effectiveRange = Math.min(rangeSeconds, maxRange);
    const to = Math.floor(Date.now() / 1000);
    const from = Math.max(0, to - effectiveRange);
    return { from, to };
  }, [rangeSeconds, resolution, resolutionSeconds]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "rgba(255, 255, 255, 0.7)",
        fontFamily: "var(--font-pixel)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(0, 255, 128, 0.08)" },
        horzLines: { color: "rgba(0, 255, 128, 0.08)" },
      },
      crosshair: {
        mode: crosshairVisible ? 0 : 2,
      },
      rightPriceScale: {
        borderColor: "rgba(0, 255, 128, 0.2)",
        scaleMargins: { top: 0.18, bottom: 0.24 },
      },
      timeScale: {
        borderColor: "rgba(0, 255, 128, 0.2)",
        rightOffset: 12,
        barSpacing: 4,
        timeVisible: true,
        secondsVisible: resolution.endsWith("S"),
      },
      watermark: {
        visible: false,
      },
    });

    const candles = chart.addCandlestickSeries({
      upColor: "#00ff80",
      downColor: "#ff4d6d",
      borderUpColor: "#00ff80",
      borderDownColor: "#ff4d6d",
      wickUpColor: "#00ff80",
      wickDownColor: "#ff4d6d",
      priceLineVisible: true,
      priceLineColor: "rgba(0, 255, 128, 0.6)",
      priceLineWidth: 1,
    });
    candles.priceScale().applyOptions({
      scaleMargins: { top: 0.18, bottom: 0.28 },
    });

    const volume = chart.addHistogramSeries({
      color: "rgba(0, 255, 128, 0.35)",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    volume.priceScale().applyOptions({
      scaleMargins: { top: 0.55, bottom: 0 },
    });

    chartRef.current = chart;
    candleRef.current = candles;
    volumeRef.current = volume;

    const resize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    const handleCrosshair = (param: any) => {
      if (!param?.time || !param.seriesData) {
        onHover?.(null);
        return;
      }
      const candle = param.seriesData.get(candles);
      if (!candle) {
        onHover?.(null);
        return;
      }
      const vol = param.seriesData.get(volume);
      onHover?.({
        time: typeof param.time === "number" ? param.time : Math.floor(new Date(param.time.year, param.time.month - 1, param.time.day).getTime() / 1000),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: vol?.value,
      });
    };
    chart.subscribeCrosshairMove(handleCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshair);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, [onHover]);

  useEffect(() => {
    if (!chartRef.current) return;
    let mode = PriceScaleMode.Normal;
    if (percentScale) {
      mode = PriceScaleMode.Percentage;
    } else if (logScale) {
      mode = PriceScaleMode.Logarithmic;
    }
    chartRef.current.priceScale("right").applyOptions({
      mode,
      autoScale: autoScale ?? true,
    });
  }, [logScale, percentScale, autoScale]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      crosshair: {
        mode: crosshairVisible ? 0 : 2,
      },
    });
  }, [crosshairVisible]);

  useEffect(() => {
    if (!chartRef.current || !zoomSignal) return;
    setBarSpacing((current) => Math.max(2, Math.min(20, current + zoomSignal)));
  }, [zoomSignal]);

  useEffect(() => {
    if (!chartRef.current || !resetSignal) return;
    chartRef.current.timeScale().fitContent();
  }, [resetSignal]);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.timeScale().applyOptions({
      secondsVisible: resolution.endsWith("S"),
      timeVisible: true,
      barSpacing,
    });
  }, [resolution, barSpacing]);

  useEffect(() => {
    setBarSpacing(resolution.endsWith("S") ? 6 : 8);
  }, [resolution]);

  useEffect(() => {
    if (!address) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          address,
          resolution,
          from: String(range.from),
          to: String(range.to),
        });
        const res = await fetch(`/api/defined/bars?${params.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load bars");
        }
        const json = (await res.json()) as BarResponse | null;
        if (!active || !json) return;
        const { o = [], h = [], l = [], c = [], t = [], volume = [] } = json;
        const candles = [];
        const volumes = [];
        for (let i = 0; i < t.length; i += 1) {
          const time = t[i];
          const open = o[i];
          const high = h[i];
          const low = l[i];
          const close = c[i];
          if (
            time == null ||
            open == null ||
            high == null ||
            low == null ||
            close == null
          ) {
            continue;
          }
          candles.push({
            time: Number(time),
            open: Number(open),
            high: Number(high),
            low: Number(low),
            close: Number(close),
          });
          const vol = volume[i];
          if (vol != null) {
            volumes.push({
              time: Number(time),
              value: Number(vol),
              color: close >= open ? "rgba(0, 255, 128, 0.45)" : "rgba(255, 77, 109, 0.45)",
            });
          }
        }
        candleRef.current?.setData(candles);
        volumeRef.current?.setData(volumes);
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const volumeSum = volumes.reduce((acc, bar) => acc + (bar.value ?? 0), 0);
        onSummary?.({
          last,
          prevClose: prev?.close,
          volumeSum,
        });
        setLastClose(last?.close ?? null);

        if (last) {
          const secondsPerBar = resolutionSeconds[resolution] ?? 300;
          const visibleBars = Math.min(Math.max(candles.length, 200), 400);
          const from = last.time - secondsPerBar * (visibleBars - 1);
          chartRef.current?.timeScale().setVisibleRange({ from, to: last.time });
        } else {
          chartRef.current?.timeScale().fitContent();
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [address, resolution, range.from, range.to]);

  useEffect(() => {
    if (!candleRef.current || lastClose == null) return;
    const abs = Math.abs(lastClose);
    let precision = 6;
    if (abs >= 1) precision = 4;
    else if (abs >= 0.01) precision = 6;
    else if (abs >= 0.0001) precision = 8;
    else precision = 10;
    const minMove = Math.pow(10, -precision);
    candleRef.current.applyOptions({
      priceFormat: {
        type: "price",
        precision,
        minMove,
      },
    });
  }, [lastClose]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0" />
      {(loading || error) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-[10px] font-mono text-primary/60 bg-black/40">
          {error ? "Chart data unavailable" : "Loading chart..."}
        </div>
      )}
    </div>
  );
}
