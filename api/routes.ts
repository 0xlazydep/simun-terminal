import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../server/storage.js";
import { fetchTokenPairs, getScannerData, type QuoteFilter, type ScanOptions } from "../server/dexscreener.js";
import { fetchLogoAsset, fetchMarketLogos, fetchMarketPrices } from "../server/market.js";
import { fetchOhlcv, type Interval } from "../server/geckoterminal.js";
import { getErc20Info } from "../server/onchain.js";

const authHeader = (value: string) => {
  if (value.startsWith("Bearer ")) return value;
  if (process.env.CODEX_AUTH_BEARER === "1") return `Bearer ${value}`;
  return value;
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  const handleScan = async (req: express.Request, res: express.Response) => {
    const quoteRaw = String(req.query.quote ?? "CLANKER").toUpperCase();
    const quote = quoteRaw as QuoteFilter;
    if (quote !== "CLANKER" && quote !== "ZORA" && quote !== "PRINTR") {
      return res.status(400).json({ message: "Invalid quote filter" });
    }
    const sortRaw = req.query.sort ? String(req.query.sort) : undefined;
    const windowRaw = req.query.window ? String(req.query.window) : undefined;
    const buyOnly = req.query.buyOnly === "1" || req.query.buyOnly === "true";
    const options: ScanOptions = {
      sort: sortRaw === "lastTransaction" ? "lastTransaction" : undefined,
      window: windowRaw === "day1" ? "day1" : undefined,
      buyOnly,
    };
    try {
      const data = await getScannerData(quote, options);
      return res.json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("dexscreener scan failed", { quote, message });
      return res.status(502).json({ message: "Failed to fetch scanner data", error: message });
    }
  };

  app.get("/api/defined/scan", handleScan);

  app.get("/api/defined/token", async (req, res) => {
    const address = (req.query.address as string | undefined)?.trim();
    const quoteRaw = req.query.quote ? String(req.query.quote).toUpperCase() : undefined;
    const quote = quoteRaw as QuoteFilter | undefined;
    if (!address) {
      return res.status(400).json({ message: "Missing token address" });
    }
    if (quote && quote !== "CLANKER" && quote !== "ZORA" && quote !== "PRINTR") {
      return res.status(400).json({ message: "Invalid quote filter" });
    }
    try {
      const pairs = await fetchTokenPairs(address, quote);
      return res.json({ address, pairs });
    } catch {
      return res.status(502).json({ message: "Failed to fetch token pairs" });
    }
  });

  app.get("/api/base/token/:address", async (req, res) => {
    try {
      const info = await getErc20Info(req.params.address);
      return res.json(info);
    } catch {
      return res.status(502).json({ message: "Failed to fetch token data" });
    }
  });

  app.get("/api/geckoterminal/ohlcv", async (req, res) => {
    const pool = req.query.pool as string | undefined;
    const symbol = req.query.symbol as string | undefined;
    const symbolTypeRaw = req.query.symbolType as string | undefined;
    const interval = (req.query.interval as Interval | undefined) ?? "5m";
    const symbolType = symbolTypeRaw === "TOKEN" ? "TOKEN" : "POOL";
    const target = symbol ?? pool;
    if (!target) {
      return res.status(400).json({ message: "Missing symbol address" });
    }
    if (!["1s", "5s", "10s", "1m", "5m", "1h", "4h", "1d"].includes(interval)) {
      return res.status(400).json({ message: "Invalid interval" });
    }
    const result = await fetchOhlcv(target, interval, symbolType);
    return res.json({ symbol: target, symbolType, interval, ...result });
  });

  app.get("/api/market/prices", async (req, res) => {
    try {
      const data = await fetchMarketPrices();
      return res.json({ data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("market prices failed", message);
      const debug = req.query.debug === "1";
      return res
        .status(502)
        .json({ message: "Failed to fetch prices", error: message, debug });
    }
  });

  app.get("/api/market/logos", async (_req, res) => {
    try {
      const data = await fetchMarketLogos();
      return res.json({ data });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ message: "Failed to fetch logos", error: message });
    }
  });

  app.get("/api/market/logo/:symbol", async (req, res) => {
    const symbol = String(req.params.symbol || "").toUpperCase();
    if (!["BTC", "ETH", "SOL", "BNB"].includes(symbol)) {
      return res.status(404).end();
    }
    try {
      const asset = await fetchLogoAsset(symbol);
      res.setHeader("Content-Type", asset.contentType);
      res.setHeader("Cache-Control", "public, max-age=21600");
      return res.send(Buffer.from(asset.buffer));
    } catch {
      return res.status(502).end();
    }
  });

  app.get("/api/defined/token-stats", async (req, res) => {
    const address = (req.query.address as string | undefined)?.trim();
    if (!address) {
      return res.status(400).json({ message: "Missing token address" });
    }
    const apiKey = process.env.DEFINED_API_KEY || process.env.CODEX_API_KEY;
    if (!apiKey) {
      return res.status(502).json({ message: "Missing DEFINED_API_KEY" });
    }
    try {
      const query = `
        query TokenStats($tokens: [String], $limit: Int) {
          filterTokens(tokens: $tokens, limit: $limit) {
            results {
              priceUSD
              marketCap
              volume24
              txnCount24
              txnCount5m
              buyCount5m
              sellCount5m
              change5m
              holders
              token {
                info {
                  address
                  name
                  symbol
                }
              }
            }
          }
        }
      `;
      const runQuery = async (tokens: string[]) => {
        const variables = { tokens, limit: 1 };
        const resp = await fetch("https://graph.codex.io/graphql", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader(apiKey),
          },
          body: JSON.stringify({ query, variables }),
        });
        const text = await resp.text();
        if (!resp.ok) {
          return { ok: false as const, error: text };
        }
        const json = JSON.parse(text) as { data?: any; errors?: Array<{ message?: string }> };
        if (json.errors?.length) {
          return { ok: false as const, error: json.errors[0]?.message || "Upstream error" };
        }
        return { ok: true as const, data: json.data?.filterTokens?.results?.[0] ?? null };
      };

      const primary = await runQuery([`${address}:8453`]);
      if (primary.ok) {
        return res.json({ data: primary.data });
      }
      const fallback = await runQuery([address]);
      if (fallback.ok) {
        return res.json({ data: fallback.data });
      }
      const error = primary.error || fallback.error;
      console.error("token-stats upstream error", error);
      return res.status(502).json({ message: "Upstream error", error });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ message: "Failed to fetch stats", error: message });
    }
  });

  app.get("/api/defined/bars", async (req, res) => {
    const address = (req.query.address as string | undefined)?.trim();
    const resolution = (req.query.resolution as string | undefined)?.trim();
    const from = Number(req.query.from);
    const to = Number(req.query.to);
    if (!address) {
      return res.status(400).json({ message: "Missing token address" });
    }
    if (!resolution) {
      return res.status(400).json({ message: "Missing resolution" });
    }
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return res.status(400).json({ message: "Missing from/to range" });
    }
    const allowed = new Set([
      "1S",
      "5S",
      "15S",
      "30S",
      "1",
      "5",
      "15",
      "30",
      "60",
      "240",
      "720",
      "1D",
      "7D",
    ]);
    if (!allowed.has(resolution)) {
      return res.status(400).json({ message: "Invalid resolution" });
    }
    const apiKey = process.env.DEFINED_API_KEY || process.env.CODEX_API_KEY;
    if (!apiKey) {
      return res.status(502).json({ message: "Missing DEFINED_API_KEY" });
    }
    try {
      const query = `
        query TokenBars(
          $symbol: String!
          $from: Int!
          $to: Int!
          $resolution: String!
          $currencyCode: QuoteCurrency
          $removeLeadingNullValues: Boolean
        ) {
          getTokenBars(
            symbol: $symbol
            from: $from
            to: $to
            resolution: $resolution
            currencyCode: $currencyCode
            removeLeadingNullValues: $removeLeadingNullValues
          ) {
            o
            h
            l
            c
            t
            s
            volume
          }
        }
      `;
      const networkId = Number(process.env.CHAIN_ID || 8453);
      const variables = {
        symbol: `${address}:${networkId}`,
        from,
        to,
        resolution,
        currencyCode: "USD",
        removeLeadingNullValues: true,
      };
      const resp = await fetch("https://graph.codex.io/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(apiKey),
        },
        body: JSON.stringify({ query, variables }),
      });
      const text = await resp.text();
      if (!resp.ok) {
        return res.status(502).json({ message: "Upstream error", error: text });
      }
      const json = JSON.parse(text) as { data?: any; errors?: Array<{ message?: string }> };
      if (json.errors?.length) {
        return res.status(502).json({ message: "Upstream error", error: json.errors[0]?.message });
      }
      return res.json(json.data?.getTokenBars ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ message: "Failed to fetch bars", error: message });
    }
  });

  app.get("/api/defined/token-events", async (req, res) => {
    const address = (req.query.address as string | undefined)?.trim();
    const limit = Math.min(Number(req.query.limit || "20"), 50);
    if (!address) {
      return res.status(400).json({ message: "Missing token address" });
    }
    const apiKey = process.env.DEFINED_API_KEY || process.env.CODEX_API_KEY;
    if (!apiKey) {
      return res.status(502).json({ message: "Missing DEFINED_API_KEY" });
    }
    try {
      const query = `
        query TokenEvents($query: EventsQueryInput!, $limit: Int) {
          getTokenEvents(query: $query, limit: $limit) {
            events {
              side
              amountUSD
              amountToken
              priceUSD
              transactionHash
              timestamp
              maker
            }
          }
        }
      `;
      const tryQuery = async (queryInput: Record<string, any>) => {
        const variables = { query: queryInput, limit };
        const resp = await fetch("https://graph.codex.io/graphql", {
          method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader(apiKey),
        },
          body: JSON.stringify({ query, variables }),
        });
        const text = await resp.text();
        if (!resp.ok) {
          return { ok: false as const, error: text };
        }
        const json = JSON.parse(text) as {
          data?: { getTokenEvents?: { events?: any[] } };
          errors?: Array<{ message?: string }>;
        };
        if (json.errors?.length) {
          return { ok: false as const, error: json.errors[0]?.message || "Upstream error" };
        }
        return { ok: true as const, events: json.data?.getTokenEvents?.events ?? [] };
      };

      const networkId = Number(process.env.CHAIN_ID || 8453);
      const attempts = [{ address, networkId }];

      let lastError: string | null = null;
      for (const attempt of attempts) {
        const result = await tryQuery(attempt);
        if (result.ok) {
          return res.json({ data: result.events });
        }
        lastError = result.error;
      }

      return res.status(502).json({ message: "Upstream error", error: lastError ?? "Unknown error" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ message: "Failed to fetch events", error: message });
    }
  });

  return httpServer;
}
