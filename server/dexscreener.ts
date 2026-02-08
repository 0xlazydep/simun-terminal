const DEX_SEARCH_API = "https://api.dexscreener.com/latest/dex/search?q=";
const DEX_TOKEN_API = "https://api.dexscreener.com/latest/dex/tokens/";
const DEFINED_GRAPHQL_API = "https://graph.codex.io/graphql";
const CHAIN_ID = "base";
const BASE_NETWORK_ID = 8453;
const ZORA_LAUNCHPADS = ["Zora"];
const CLANKER_LAUNCHPADS = ["Clanker V4"];
const PRINTR_LAUNCHPADS = ["Printr"];
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const WETH_ADDRESS =
  process.env.CLANKER_QUOTE_ADDRESS || "0x4200000000000000000000000000000000000006";
const USDC_ADDRESS =
  process.env.ZORA_QUOTE_ADDRESS || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";

export type QuoteFilter = "CLANKER" | "ZORA" | "PRINTR";

export const QUOTE_TOKENS: Record<QuoteFilter, { address: string; symbol: string }> = {
  CLANKER: {
    symbol: "WETH",
    address: WETH_ADDRESS,
  },
  ZORA: {
    symbol: "USDC",
    address: USDC_ADDRESS,
  },
  PRINTR: {
    symbol: "USDC",
    address: USDC_ADDRESS,
  },
};

type DexPair = {
  pairAddress: string;
  url: string;
  chainId: string;
  dexId?: string;
  chartSymbolType?: "TOKEN" | "POOL";
  baseToken: { address: string; name?: string; symbol: string; imageUrl?: string };
  quoteToken: { address: string; name?: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  fdv?: number;
  marketCap?: number;
  holders?: number;
  txnCount?: { m5?: number; h24?: number };
  signal?: boolean;
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number;
  volumeChangeM5Pct?: number | null;
};

type CodexTokenResult = {
  createdAt?: number | null;
  volume5m?: string | null;
  volumeChange5m?: string | null;
  volume24?: string | null;
  liquidity?: string | null;
  priceUSD?: string | null;
  change5m?: string | null;
  marketCap?: string | null;
  holders?: string | null;
  txnCount5m?: string | null;
  txnCount24?: string | null;
  buyCount5m?: number | null;
  sellCount5m?: number | null;
  pair?: {
    address?: string | null;
  } | null;
  token?: {
    info?: {
      address?: string | null;
      name?: string | null;
      symbol?: string | null;
      imageThumbUrl?: string | null;
      imageSmallUrl?: string | null;
      imageLargeUrl?: string | null;
    } | null;
    createdAt?: number | null;
  } | null;
};

type CodexResponse = {
  data?: {
    filterTokens?: {
      results?: CodexTokenResult[];
    };
  };
  errors?: Array<{ message?: string }>;
};

export type ScannerAlert = {
  pairAddress: string;
  baseSymbol: string;
  quoteSymbol: string;
  volumeChangeM5Pct: number;
  volumeM5: number;
  url: string;
};

export type ScannerResponse = {
  quote: QuoteFilter;
  pairs: DexPair[];
  alerts: ScannerAlert[];
  fetchedAt: number;
};

const cache = new Map<QuoteFilter, { ts: number; data: ScannerResponse }>();
const seenTokens = new Map<QuoteFilter, Map<string, DexPair>>();
const history = new Map<string, Array<{ ts: number; m5: number }>>();
const lastAlert = new Map<string, number>();

const FIVE_MINUTES = 5 * 60 * 1000;
const HISTORY_RETENTION = 10 * 60 * 1000;
const CACHE_TTL = 3 * 1000;
const MIN_VOLUME_SPIKE = 0.3;
const MAX_MARKET_CAP = 100000;
const MAX_SCAN_RESULTS = 200;
const MAX_RESULTS = 50;

function mergeSeen(quote: QuoteFilter, pairs: DexPair[]) {
  let store = seenTokens.get(quote);
  if (!store) {
    store = new Map<string, DexPair>();
    seenTokens.set(quote, store);
  }

  for (const pair of pairs) {
    const existing = store.get(pair.pairAddress);
    if (existing?.signal) {
      pair.signal = true;
    }
    store.set(pair.pairAddress, pair);
  }

  const merged = Array.from(store.values());
  merged.sort((a, b) => {
    const aSignal = Number(Boolean(a.signal));
    const bSignal = Number(Boolean(b.signal));
    if (bSignal !== aSignal) return bSignal - aSignal;
    const aCreated = a.pairCreatedAt ?? 0;
    const bCreated = b.pairCreatedAt ?? 0;
    if (bCreated !== aCreated) return bCreated - aCreated;
    const aVol = a.volume?.h24 ?? 0;
    const bVol = b.volume?.h24 ?? 0;
    return bVol - aVol;
  });

  const trimmed = merged.slice(0, MAX_RESULTS);
  store.clear();
  for (const pair of trimmed) {
    store.set(pair.pairAddress, pair);
  }

  return trimmed;
}

function pushHistory(pairAddress: string, m5: number, now: number) {
  const list = history.get(pairAddress) ?? [];
  list.push({ ts: now, m5 });
  const cutoff = now - HISTORY_RETENTION;
  while (list.length && list[0].ts < cutoff) {
    list.shift();
  }
  history.set(pairAddress, list);
}

function getFiveMinuteDelta(pairAddress: string, now: number): number | null {
  const list = history.get(pairAddress);
  if (!list || list.length < 2) return null;
  const targetTime = now - FIVE_MINUTES;
  const previous = [...list].reverse().find((entry) => entry.ts <= targetTime);
  if (!previous || previous.m5 <= 0) return null;
  const current = list[list.length - 1]?.m5 ?? 0;
  return (current - previous.m5) / previous.m5;
}

function getApproxDelta(pair: DexPair): number | null {
  const m5 = pair.volume?.m5;
  const h1 = pair.volume?.h1;
  if (m5 === undefined || h1 === undefined) return null;
  if (h1 <= 0) return null;
  const avg5 = h1 / 12;
  if (avg5 <= 0) return null;
  return (m5 - avg5) / avg5;
}

function shouldAlert(pairAddress: string, now: number, delta: number) {
  if (delta < 0.3) return false;
  const last = lastAlert.get(pairAddress);
  if (last && now - last < FIVE_MINUTES) return false;
  lastAlert.set(pairAddress, now);
  return true;
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function parseNumber(value?: string | number | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
}

function getMarketCap(pair: DexPair): number | null {
  const value = pair.marketCap ?? pair.fdv;
  if (value === undefined || value === null) return null;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
}


async function fetchPairs(quote: QuoteFilter): Promise<DexPair[]> {
  const query = `base ${quote.toLowerCase()}`;
  const res = await fetch(`${DEX_SEARCH_API}${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`Dexscreener error: ${res.status}`);
  }
  const json = (await res.json()) as { pairs?: DexPair[] };
  const quoteAddress = normalizeAddress(QUOTE_TOKENS[quote].address);

  const pairs = (json.pairs ?? []).filter((pair) => {
    if (pair.chainId !== CHAIN_ID) return false;
    if (!pair.quoteToken?.address) return false;
    return normalizeAddress(pair.quoteToken.address) === quoteAddress;
  });

  pairs.sort((a, b) => {
    const aVol = a.volume?.h24 ?? 0;
    const bVol = b.volume?.h24 ?? 0;
    return bVol - aVol;
  });

  return pairs.slice(0, MAX_SCAN_RESULTS);
}

async function fetchPairsByQuery(query: string): Promise<DexPair[]> {
  const res = await fetch(`${DEX_SEARCH_API}${encodeURIComponent(query)}`);
  if (!res.ok) {
    throw new Error(`Dexscreener error: ${res.status}`);
  }
  const json = (await res.json()) as { pairs?: DexPair[] };
  return (json.pairs ?? []).filter((pair) => pair.chainId === CHAIN_ID);
}

async function fetchPairsByQuote(query: string, quoteAddress: string): Promise<DexPair[]> {
  const pairs = await fetchPairsByQuery(query);
  const normalizedQuote = normalizeAddress(quoteAddress);
  const filtered = pairs.filter((pair) => {
    if (!pair.quoteToken?.address) return false;
    return normalizeAddress(pair.quoteToken.address) === normalizedQuote;
  });
  filtered.sort((a, b) => {
    const aVol = a.volume?.h24 ?? 0;
    const bVol = b.volume?.h24 ?? 0;
    return bVol - aVol;
  });
  return filtered.slice(0, MAX_SCAN_RESULTS);
}

export async function fetchTokenPairs(address: string, quote?: QuoteFilter): Promise<DexPair[]> {
  const res = await fetch(`${DEX_TOKEN_API}${address}`);
  if (!res.ok) {
    throw new Error(`Dexscreener error: ${res.status}`);
  }
  const json = (await res.json()) as { pairs?: DexPair[] };
  const quoteAddress = quote ? normalizeAddress(QUOTE_TOKENS[quote].address) : null;

  const pairs = (json.pairs ?? []).filter((pair) => {
    if (pair.chainId !== CHAIN_ID) return false;
    if (quoteAddress) {
      return normalizeAddress(pair.quoteToken.address) === quoteAddress;
    }
    return true;
  });

  pairs.sort((a, b) => {
    const aLiq = a.liquidity?.usd ?? 0;
    const bLiq = b.liquidity?.usd ?? 0;
    if (bLiq !== aLiq) return bLiq - aLiq;
    const aVol = a.volume?.h24 ?? 0;
    const bVol = b.volume?.h24 ?? 0;
    return bVol - aVol;
  });

  return pairs.slice(0, MAX_RESULTS);
}

async function fetchDefinedTokens(launchpads: string[], quoteSymbol: string): Promise<DexPair[]> {
  const apiKey = process.env.DEFINED_API_KEY || process.env.CODEX_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEFINED_API_KEY (or CODEX_API_KEY)");
  }

  const query = `
    query DefinedTokens($filters: TokenFilters, $rankings: [TokenRanking], $limit: Int) {
      filterTokens(filters: $filters, rankings: $rankings, limit: $limit) {
        results {
          createdAt
          volume5m
          volumeChange5m
          volume24
          liquidity
          priceUSD
          change5m
          marketCap
          holders
          txnCount5m
          txnCount24
          buyCount5m
          sellCount5m
          pair {
            address
          }
          token {
            info {
              address
              name
              symbol
              imageThumbUrl
              imageSmallUrl
              imageLargeUrl
            }
            createdAt
          }
        }
      }
    }
  `;

  const variables = {
    filters: {
      network: [BASE_NETWORK_ID],
      launchpadName: launchpads,
    },
    rankings: [
      {
        attribute: "createdAt",
        direction: "DESC",
      },
    ],
    limit: MAX_SCAN_RESULTS,
  };

  const res = await fetch(DEFINED_GRAPHQL_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Codex error: ${res.status} ${body}`);
  }

  const json = (await res.json()) as CodexResponse;
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message || "Codex query failed");
  }

  const results = json.data?.filterTokens?.results ?? [];
  const pairs: DexPair[] = [];

  for (const item of results) {
    const info = item.token?.info;
    if (!info?.address) continue;
    const symbol = info.symbol || "UNKNOWN";
    const volumeM5 = parseNumber(item.volume5m);
    const volumeChangeM5 = parseNumber(item.volumeChange5m);
    const volume24 = parseNumber(item.volume24);
    const liquidityUsd = parseNumber(item.liquidity);
    const priceUsd = parseNumber(item.priceUSD);
    const changeM5 = parseNumber(item.change5m);
    const marketCap = parseNumber(item.marketCap);
    const holders = parseNumber(item.holders);
    const txnCount5m = parseNumber(item.txnCount5m);
    const txnCount24 = parseNumber(item.txnCount24);
    const buyCount5m = parseNumber(item.buyCount5m);
    const sellCount5m = parseNumber(item.sellCount5m);
    const createdAt = item.createdAt ?? item.token?.createdAt ?? undefined;
    const pairAddress = item.pair?.address ?? undefined;

    pairs.push({
      pairAddress: pairAddress ?? info.address,
      url: "",
      chainId: CHAIN_ID,
      chartSymbolType: pairAddress ? "POOL" : "TOKEN",
      baseToken: {
        address: info.address,
        name: info.name ?? undefined,
        symbol,
        imageUrl:
          info.imageThumbUrl ??
          info.imageSmallUrl ??
          info.imageLargeUrl ??
          undefined,
      },
      quoteToken: {
        address: ZERO_ADDRESS,
        symbol: quoteSymbol,
      },
      priceUsd: priceUsd !== null ? String(priceUsd) : undefined,
      liquidity: liquidityUsd !== null ? { usd: liquidityUsd } : undefined,
      volume:
        volumeM5 !== null || volume24 !== null
          ? {
              m5: volumeM5 ?? undefined,
              h24: volume24 ?? undefined,
            }
          : undefined,
      priceChange: changeM5 !== null ? { m5: changeM5 } : undefined,
      marketCap: marketCap ?? undefined,
      holders: holders ?? undefined,
      txnCount:
        txnCount5m !== null || txnCount24 !== null
          ? {
              m5: txnCount5m ?? undefined,
              h24: txnCount24 ?? undefined,
            }
          : undefined,
      txns:
        buyCount5m !== null || sellCount5m !== null
          ? {
              m5: {
                buys: buyCount5m ?? undefined,
                sells: sellCount5m ?? undefined,
              },
            }
          : undefined,
      volumeChangeM5Pct: volumeChangeM5,
      pairCreatedAt: createdAt ?? undefined,
    });
  }

  return pairs;
}

async function fetchZoraTokens(): Promise<DexPair[]> {
  return fetchDefinedTokens(ZORA_LAUNCHPADS, "ZORA");
}

async function fetchClankerTokens(): Promise<DexPair[]> {
  const pairs = await fetchDefinedTokens(CLANKER_LAUNCHPADS, "USD");
  const now = Date.now();
  const maxAgeMs = 5 * 24 * 60 * 60 * 1000;
  return pairs.map((pair) => {
    const volumeChange = pair.volumeChangeM5Pct ?? null;
    const marketCap = typeof pair.marketCap === "number" ? pair.marketCap : null;
    const priceChange = pair.priceChange?.m5 ?? null;
    const createdAt = typeof pair.pairCreatedAt === "number" ? pair.pairCreatedAt : null;
    const ageEligible = createdAt ? now - createdAt <= maxAgeMs : true;

    const volumeSpike = volumeChange !== null && volumeChange >= 0.2;

    const marketCapSpike =
      marketCap !== null &&
      marketCap <= 40_000 &&
      priceChange !== null &&
      priceChange >= 0.3;

    pair.signal = ageEligible && (volumeSpike || marketCapSpike);
    return pair;
  });
}

async function fetchPrintrTokens(): Promise<DexPair[]> {
  return fetchDefinedTokens(PRINTR_LAUNCHPADS, "USD");
}

export async function getScannerData(quote: QuoteFilter): Promise<ScannerResponse> {
  const cached = cache.get(quote);
  const now = Date.now();
  if (cached && now - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  if (quote === "ZORA") {
    const pairs = await fetchZoraTokens();
    const data: ScannerResponse = {
      quote,
      pairs: mergeSeen(quote, pairs),
      alerts: [],
      fetchedAt: now,
    };
    cache.set(quote, { ts: now, data });
    return data;
  }

  if (quote === "CLANKER") {
    const pairs = await fetchClankerTokens();
    const data: ScannerResponse = {
      quote,
      pairs: mergeSeen(quote, pairs),
      alerts: [],
      fetchedAt: now,
    };
    cache.set(quote, { ts: now, data });
    return data;
  }

  if (quote === "PRINTR") {
    const cachedPrintr = cache.get(quote);
    if (cachedPrintr) return cachedPrintr.data;
    const data: ScannerResponse = {
      quote,
      pairs: [],
      alerts: [],
      fetchedAt: now,
    };
    cache.set(quote, { ts: now, data });
    return data;
  }

  const pairs = await fetchPairs(quote);
  const alerts: ScannerAlert[] = [];
  const filtered: DexPair[] = [];

  for (const pair of pairs) {
    const m5 = pair.volume?.m5 ?? 0;
    pushHistory(pair.pairAddress, m5, now);
    const delta = getFiveMinuteDelta(pair.pairAddress, now) ?? getApproxDelta(pair);
    pair.volumeChangeM5Pct = delta;
    const marketCap = getMarketCap(pair);
    const marketCapEligible = marketCap !== null && marketCap <= MAX_MARKET_CAP;

    if (delta !== null && delta >= MIN_VOLUME_SPIKE && marketCapEligible) {
      filtered.push(pair);
    }

    if (delta !== null && marketCapEligible && shouldAlert(pair.pairAddress, now, delta)) {
      alerts.push({
        pairAddress: pair.pairAddress,
        baseSymbol: pair.baseToken.symbol,
        quoteSymbol: pair.quoteToken.symbol,
        volumeChangeM5Pct: delta,
        volumeM5: m5,
        url: pair.url,
      });
    }
  }

  const data: ScannerResponse = {
    quote,
    pairs: filtered
      .sort((a, b) => (b.volume?.m5 ?? 0) - (a.volume?.m5 ?? 0))
      .slice(0, MAX_RESULTS),
    alerts,
    fetchedAt: now,
  };

  cache.set(quote, { ts: now, data });
  return data;
}
