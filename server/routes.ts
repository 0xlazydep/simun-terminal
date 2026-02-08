import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { fetchTokenPairs, getScannerData, type QuoteFilter } from "./dexscreener";
import { fetchLogoAsset, fetchMarketLogos, fetchMarketPrices } from "./market";
import { fetchOhlcv, type Interval } from "./geckoterminal";
import { getErc20Info } from "./onchain";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)
  app.get("/api/ping", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  const handleScan = async (req: express.Request, res: express.Response) => {
    const quoteRaw = String(req.query.quote ?? "CLANKER").toUpperCase();
    const quote = quoteRaw as QuoteFilter;
    if (quote !== "CLANKER" && quote !== "ZORA" && quote !== "PRINTR") {
      return res.status(400).json({ message: "Invalid quote filter" });
    }
    try {
      const data = await getScannerData(quote);
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
    } catch (error) {
      return res.status(502).json({ message: "Failed to fetch token pairs" });
    }
  });

  app.get("/api/base/token/:address", async (req, res) => {
    try {
      const info = await getErc20Info(req.params.address);
      return res.json(info);
    } catch (error) {
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
    } catch (error) {
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
            Authorization: apiKey,
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
          getTokenEvents(query: $query, limit: $limit, direction: DESC) {
            items {
              timestamp
              eventDisplayType
              maker
              transactionHash
              data {
                ... on SwapEventData {
                  priceUsd
                  priceUsdTotal
                  amountNonLiquidityToken
                }
              }
            }
          }
        }
      `;
      const variables = {
        query: {
          address,
          networkId: 8453,
          symbolType: "TOKEN",
        },
        limit,
      };
      const resp = await fetch("https://graph.codex.io/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: apiKey,
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
      const items = json.data?.getTokenEvents?.items ?? [];
      return res.json({ data: items });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ message: "Failed to fetch events", error: message });
    }
  });

  return httpServer;
}
