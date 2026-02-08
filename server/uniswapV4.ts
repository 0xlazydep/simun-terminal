const RPC_URL = "https://base-rpc.publicnode.com";
const POOL_MANAGER = "0x498581ff718922c3f8e6a244956af099b2652b2b";

// Uniswap v4 PoolManager Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)
const INIT_TOPIC =
  "0xdd466e674ea557f56295e2d0218a125ea4b4f0f6f3307b95f85e6110838d6438";
// Uniswap v4 PoolManager Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)
const SWAP_TOPIC =
  "0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f";

const INIT_LOOKBACK_BLOCKS = Number.parseInt(
  process.env.V4_INIT_LOOKBACK_BLOCKS || "200000",
  10,
);
const BLOCKS_5M = Number.parseInt(process.env.V4_BLOCKS_5M || "150", 10);
const BLOCKS_24H = Number.parseInt(process.env.V4_BLOCKS_24H || "43200", 10);

const poolCache = new Map<string, { poolId: string; currency0: string; currency1: string; ts: number }>();
const decimalsCache = new Map<string, number>();
const statsCache = new Map<
  string,
  { ts: number; m5: SwapStats; h24: SwapStats }
>();

export type SwapStats = {
  buyCount: number;
  sellCount: number;
  volume: number;
};

function toHex(value: number) {
  return `0x${value.toString(16)}`;
}

function padTopicAddress(address: string) {
  return `0x${address.replace(/^0x/, "").padStart(64, "0")}`;
}

function normalize(address: string) {
  return address.toLowerCase();
}

async function rpc<T>(method: string, params: unknown[]) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) {
    throw new Error(`RPC error: ${res.status}`);
  }
  const json = (await res.json()) as { result?: T; error?: { message?: string } };
  if (json.error?.message) {
    throw new Error(json.error.message);
  }
  return json.result as T;
}

async function getLatestBlock() {
  const hex = await rpc<string>("eth_blockNumber", []);
  return Number.parseInt(hex, 16);
}

async function getTokenDecimals(address: string) {
  const cached = decimalsCache.get(address);
  if (cached !== undefined) return cached;
  const data = await rpc<string>("eth_call", [
    {
      to: address,
      data: "0x313ce567", // decimals()
    },
    "latest",
  ]);
  const value = Number.parseInt(data, 16);
  const decimals = Number.isFinite(value) ? value : 18;
  decimalsCache.set(address, decimals);
  return decimals;
}

function decodeInt128(word: string) {
  const value = BigInt(`0x${word}`);
  const max = 1n << 127n;
  const mod = 1n << 128n;
  return value >= max ? value - mod : value;
}

function absBigInt(value: bigint) {
  return value < 0n ? -value : value;
}

async function findPoolForToken(token: string) {
  const now = Date.now();
  const cached = poolCache.get(token);
  if (cached && now - cached.ts < 5 * 60 * 1000) return cached;

  const latest = await getLatestBlock();
  const fromBlock = Math.max(0, latest - INIT_LOOKBACK_BLOCKS);
  const tokenTopic = padTopicAddress(token);

  const [as0, as1] = await Promise.all([
    rpc<any[]>("eth_getLogs", [
      {
        address: POOL_MANAGER,
        fromBlock: toHex(fromBlock),
        toBlock: toHex(latest),
        topics: [INIT_TOPIC, null, tokenTopic],
      },
    ]),
    rpc<any[]>("eth_getLogs", [
      {
        address: POOL_MANAGER,
        fromBlock: toHex(fromBlock),
        toBlock: toHex(latest),
        topics: [INIT_TOPIC, null, null, tokenTopic],
      },
    ]),
  ]);

  const logs = [...as0, ...as1];
  if (!logs.length) return null;

  const last = logs[logs.length - 1];
  const poolId = last.topics?.[1];
  const currency0 = `0x${last.topics?.[2]?.slice(26)}`.toLowerCase();
  const currency1 = `0x${last.topics?.[3]?.slice(26)}`.toLowerCase();

  const result = { poolId, currency0, currency1, ts: now } as const;
  poolCache.set(token, result);
  return result;
}

async function fetchSwapStats(poolId: string, tokenIsCurrency0: boolean, blocks: number) {
  const latest = await getLatestBlock();
  const fromBlock = Math.max(0, latest - blocks);
  const logs = await rpc<any[]>("eth_getLogs", [
    {
      address: POOL_MANAGER,
      fromBlock: toHex(fromBlock),
      toBlock: toHex(latest),
      topics: [SWAP_TOPIC, poolId],
    },
  ]);

  let buys = 0;
  let sells = 0;
  let volumeRaw = 0n;

  for (const log of logs) {
    const data = (log.data as string).replace(/^0x/, "");
    if (data.length < 64 * 2) continue;
    const amount0 = decodeInt128(data.slice(0, 64));
    const amount1 = decodeInt128(data.slice(64, 128));
    const amount = tokenIsCurrency0 ? amount0 : amount1;
    if (amount < 0n) {
      buys += 1;
    } else if (amount > 0n) {
      sells += 1;
    }
    volumeRaw += absBigInt(amount);
  }

  return { buys, sells, volumeRaw };
}

export async function getOnchainSwapStats(tokenAddress: string) {
  const token = normalize(tokenAddress);
  const now = Date.now();
  const cached = statsCache.get(token);
  if (cached && now - cached.ts < 10 * 1000) return cached;

  const pool = await findPoolForToken(token);
  if (!pool?.poolId) return null;

  const tokenIsCurrency0 = token === pool.currency0;
  const decimals = await getTokenDecimals(token);

  const [m5Raw, h24Raw] = await Promise.all([
    fetchSwapStats(pool.poolId, tokenIsCurrency0, BLOCKS_5M),
    fetchSwapStats(pool.poolId, tokenIsCurrency0, BLOCKS_24H),
  ]);

  const divisor = 10 ** decimals;
  const m5: SwapStats = {
    buyCount: m5Raw.buys,
    sellCount: m5Raw.sells,
    volume: Number(m5Raw.volumeRaw) / divisor,
  };
  const h24: SwapStats = {
    buyCount: h24Raw.buys,
    sellCount: h24Raw.sells,
    volume: Number(h24Raw.volumeRaw) / divisor,
  };

  const result = { ts: now, m5, h24 };
  statsCache.set(token, result);
  return result;
}
