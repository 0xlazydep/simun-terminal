const DEFINED_GRAPHQL_API = "https://graph.codex.io/graphql";
const BASE_NETWORK_ID = 8453;

export type Interval = "1s" | "5s" | "10s" | "1m" | "5m" | "1h" | "4h" | "1d";

type GeckoResponse = {
  data?: {
    getBars?: {
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
      t?: number[];
      volume?: number[];
    };
    getTokenBars?: {
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
      t?: number[];
      volume?: number[];
    };
  };
  errors?: Array<{ message?: string }>;
};

const intervalMap: Record<Interval, string> = {
  "1s": "1",
  "5s": "5",
  "10s": "10",
  "1m": "60",
  "5m": "300",
  "1h": "3600",
  "4h": "14400",
  "1d": "1D",
};

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type OhlcvResult = {
  candles: Candle[];
  source: "live" | "cache" | "stale" | "empty";
  error?: string;
};

const cache = new Map<string, { ts: number; candles: Candle[] }>();
const CACHE_TTL = 15 * 1000;
const STALE_TTL = 5 * 60 * 1000;

export async function fetchOhlcv(
  symbolAddress: string,
  interval: Interval,
  symbolType: "TOKEN" | "POOL" = "POOL",
): Promise<OhlcvResult> {
  const now = Date.now();
  const key = `${symbolAddress.toLowerCase()}:${symbolType}:${interval}`;
  const cached = cache.get(key);
  if (cached && now - cached.ts < CACHE_TTL) {
    return { candles: cached.candles, source: "cache" };
  }

  const resolution = intervalMap[interval];
  const apiKey = process.env.DEFINED_API_KEY || process.env.CODEX_API_KEY;
  if (!apiKey) {
    return { candles: [], source: "empty", error: "missing api key" };
  }

  const to = Math.floor(Date.now() / 1000);
  const from = to - 60 * 60 * 24 * 7;

  const tokenSymbols =
    symbolType === "TOKEN"
      ? [`${symbolAddress}:${BASE_NETWORK_ID}`, symbolAddress]
      : [`${symbolAddress}:${BASE_NETWORK_ID}`];

  const queryToken = `
    query Bars($symbol: String!, $from: Int!, $to: Int!, $resolution: String!, $countback: Int, $removeEmptyBars: Boolean, $removeLeadingNullValues: Boolean) {
      getTokenBars(
        symbol: $symbol,
        from: $from,
        to: $to,
        resolution: $resolution,
        countback: $countback,
        removeEmptyBars: $removeEmptyBars,
        removeLeadingNullValues: $removeLeadingNullValues
      ) {
        o
        h
        l
        c
        t
        volume
      }
    }
  `;

  const queryPool = `
    query Bars($symbol: String!, $from: Int!, $to: Int!, $resolution: String!, $symbolType: SymbolType, $countback: Int, $removeEmptyBars: Boolean, $removeLeadingNullValues: Boolean) {
      getBars(
        symbol: $symbol,
        from: $from,
        to: $to,
        resolution: $resolution,
        symbolType: $symbolType,
        countback: $countback,
        removeEmptyBars: $removeEmptyBars,
        removeLeadingNullValues: $removeLeadingNullValues
      ) {
        o
        h
        l
        c
        t
        volume
      }
    }
  `;

  const tryFetch = async (symbol: string) => {
    const res = await fetch(DEFINED_GRAPHQL_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({
        query: symbolType === "TOKEN" ? queryToken : queryPool,
        variables:
          symbolType === "TOKEN"
            ? {
                symbol,
                from,
                to,
                resolution,
                countback: 200,
                removeEmptyBars: true,
                removeLeadingNullValues: true,
              }
            : {
                symbol,
                from,
                to,
                resolution,
                symbolType,
                countback: 200,
                removeEmptyBars: true,
                removeLeadingNullValues: true,
              },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false as const, error: `upstream ${res.status} ${body}` };
    }
    const json = (await res.json()) as GeckoResponse;
    if (json.errors?.length) {
      return { ok: false as const, error: json.errors[0]?.message || "upstream error" };
    }
    const bars = symbolType === "TOKEN" ? json.data?.getTokenBars : json.data?.getBars;
    return { ok: true as const, bars };
  };

  try {
    let lastError = "upstream failure";
    for (const symbol of tokenSymbols) {
      const result = await tryFetch(symbol);
      if (!result.ok) {
        lastError = result.error;
        continue;
      }
      const bars = result.bars;
      const times = bars?.t ?? [];
      const opens = bars?.o ?? [];
      const highs = bars?.h ?? [];
      const lows = bars?.l ?? [];
      const closes = bars?.c ?? [];
      const volumes = bars?.volume ?? [];

      const candles = times.map((time, index) => ({
        time,
        open: Number(opens[index] ?? 0),
        high: Number(highs[index] ?? 0),
        low: Number(lows[index] ?? 0),
        close: Number(closes[index] ?? 0),
        volume: Number(volumes[index] ?? 0),
      }));

      if (candles.length > 1 && candles[0].time > candles[candles.length - 1].time) {
        candles.reverse();
      }

      cache.set(key, { ts: now, candles });
      return { candles, source: "live" };
    }

    if (cached && now - cached.ts < STALE_TTL) {
      return { candles: cached.candles, source: "stale", error: lastError };
    }
    return { candles: [], source: "empty", error: lastError };
  } catch (error) {
    if (cached && now - cached.ts < STALE_TTL) {
      return { candles: cached.candles, source: "stale", error: "upstream failure" };
    }
    return { candles: [], source: "empty", error: "upstream failure" };
  }
}
