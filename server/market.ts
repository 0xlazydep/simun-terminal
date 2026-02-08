const BINANCE_BASE = "https://api.binance.com/api/v3";

const PRICE_TTL = 15 * 1000;
const LOGO_TTL = 6 * 60 * 60 * 1000;

const priceCache: {
  ts: number;
  data: Record<string, { priceUsd: number; change24h: number }> | null;
} = { ts: 0, data: null };

const logoCache: {
  ts: number;
  data: Record<string, string> | null;
} = { ts: 0, data: null };

const logoAssetCache: {
  ts: number;
  data: Record<string, { contentType: string; buffer: ArrayBuffer }>;
} = { ts: 0, data: {} };

const binanceSymbols = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
  BNB: "BNBUSDT",
} as const;

const logoSlugs: Record<keyof typeof binanceSymbols, string> = {
  BTC: "bitcoin-btc-logo.png",
  ETH: "ethereum-eth-logo.png",
  SOL: "solana-sol-logo.png",
  BNB: "binance-coin-bnb-logo.png",
};

export async function fetchMarketPrices() {
  const now = Date.now();
  if (priceCache.data && now - priceCache.ts < PRICE_TTL) {
    return priceCache.data;
  }

  const data: Record<string, { priceUsd: number; change24h: number }> = {};
  const symbols = Object.values(binanceSymbols);
  const url = new URL(`${BINANCE_BASE}/ticker/24hr`);
  url.searchParams.set("symbols", JSON.stringify(symbols));

  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance error: ${res.status} ${body}`);
  }
  const json = (await res.json()) as Array<{
    symbol?: string;
    lastPrice?: string;
    priceChangePercent?: string;
  }>;

  for (const entry of json) {
    const symbol = Object.entries(binanceSymbols).find(([, v]) => v === entry.symbol)?.[0];
    if (!symbol || !entry.lastPrice || !entry.priceChangePercent) continue;
    const priceUsd = Number(entry.lastPrice);
    const change24h = Number(entry.priceChangePercent);
    if (!Number.isFinite(priceUsd) || !Number.isFinite(change24h)) continue;
    data[symbol] = { priceUsd, change24h };
  }

  const hasSuccess = Object.keys(data).length > 0;
  if (!hasSuccess) {
    if (priceCache.data) {
      return priceCache.data;
    }
    throw new Error("Binance error: no data");
  }

  priceCache.ts = now;
  priceCache.data = data;
  return data;
}

export async function fetchMarketLogos() {
  const now = Date.now();
  if (logoCache.data && now - logoCache.ts < LOGO_TTL) {
    return logoCache.data;
  }

  const res = await fetch("https://cryptologos.cc/logos/", {
    headers: { accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`CryptoLogos error: ${res.status}`);
  }
  const html = await res.text();

  const data: Record<string, string> = {};
  for (const [symbol, slug] of Object.entries(logoSlugs)) {
    const match = html.match(new RegExp(`https://cryptologos\\.cc/logos/${slug}\\?v=\\d+`));
    if (match?.[0]) {
      data[symbol] = match[0];
    } else {
      data[symbol] = `https://cryptologos.cc/logos/${slug}?v=002`;
    }
  }

  logoCache.ts = now;
  logoCache.data = data;
  return data;
}

export async function fetchLogoAsset(symbol: string) {
  const now = Date.now();
  if (logoAssetCache.data[symbol] && now - logoAssetCache.ts < LOGO_TTL) {
    return logoAssetCache.data[symbol];
  }

  const logos = await fetchMarketLogos();
  const url = logos[symbol];
  if (!url) {
    throw new Error("Logo not found");
  }

  const res = await fetch(url, {
    headers: { accept: "image/png,image/webp,image/*" },
  });
  if (!res.ok) {
    throw new Error(`Logo fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "image/png";
  const buffer = await res.arrayBuffer();

  logoAssetCache.ts = now;
  logoAssetCache.data[symbol] = { contentType, buffer };
  return logoAssetCache.data[symbol];
}
