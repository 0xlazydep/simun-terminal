const RPC_URL = "https://base-rpc.publicnode.com";
const DEFAULT_FACTORY = "0xe85a59c628f7d27878aceb4bf3b35733630083a9";

const FACTORY_ADDRESS = (process.env.CLANKER_FACTORY_ADDRESS || DEFAULT_FACTORY).toLowerCase();
const LOOKBACK_BLOCKS = Number.parseInt(process.env.CLANKER_FACTORY_LOOKBACK_BLOCKS || "200000", 10);
const BLOCK_RANGE = Number.parseInt(process.env.CLANKER_FACTORY_BLOCK_RANGE || "2000", 10);
const REFRESH_TTL = Number.parseInt(process.env.CLANKER_FACTORY_REFRESH_TTL_MS || "30000", 10);

type RpcLog = {
  address: string;
  topics: string[];
  data: string;
  blockNumber?: string;
};

const state = {
  coins: new Set<string>(),
  lastBlock: null as number | null,
  lastRefresh: 0,
  scanning: false,
  lastError: null as string | null,
};

const manualTokens = (process.env.CLANKER_MINTED_TOKENS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

for (const token of manualTokens) {
  state.coins.add(token);
}

function toHex(value: number) {
  return `0x${value.toString(16)}`;
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

async function fetchLogs(fromBlock: number, toBlock: number) {
  return rpc<RpcLog[]>("eth_getLogs", [
    {
      address: FACTORY_ADDRESS,
      fromBlock: toHex(fromBlock),
      toBlock: toHex(toBlock),
    },
  ]);
}

function topicToAddress(topic?: string) {
  if (!topic || topic.length !== 66) return null;
  const addr = `0x${topic.slice(26).toLowerCase()}`;
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

function extractAddresses(log: RpcLog) {
  const found = new Set<string>();
  for (let i = 1; i < log.topics.length; i += 1) {
    const addr = topicToAddress(log.topics[i]);
    if (addr) found.add(addr);
  }

  const data = log.data?.startsWith("0x") ? log.data.slice(2) : log.data;
  if (data && data.length >= 64) {
    for (let i = 0; i + 64 <= data.length; i += 64) {
      const word = data.slice(i, i + 64);
      if (!word.startsWith("0".repeat(24))) continue;
      const addr = `0x${word.slice(24).toLowerCase()}`;
      if (addr === "0x0000000000000000000000000000000000000000") continue;
      found.add(addr);
    }
  }

  return [...found];
}

async function scanFactory() {
  const latest = await getLatestBlock();
  const start =
    state.lastBlock === null
      ? Math.max(0, latest - Math.max(0, LOOKBACK_BLOCKS))
      : Math.min(latest, state.lastBlock + 1);

  if (start > latest) {
    state.lastBlock = latest;
    return;
  }

  for (let from = start; from <= latest; from += BLOCK_RANGE + 1) {
    const to = Math.min(latest, from + BLOCK_RANGE);
    const logs = await fetchLogs(from, to);
    for (const log of logs) {
      const addresses = extractAddresses(log);
      for (const addr of addresses) {
        state.coins.add(addr);
      }
    }
    state.lastBlock = to;
  }
}

async function refreshCoins() {
  const now = Date.now();
  if (state.scanning) return;
  if (now - state.lastRefresh < REFRESH_TTL) return;
  state.scanning = true;
  try {
    await scanFactory();
    state.lastError = null;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Unknown error";
  } finally {
    state.lastRefresh = Date.now();
    state.scanning = false;
  }
}

export async function getClankerCoinSet() {
  await refreshCoins();
  return state.coins;
}

export function getClankerCoinStatus() {
  return {
    factory: FACTORY_ADDRESS,
    count: state.coins.size,
    lastBlock: state.lastBlock,
    lastRefresh: state.lastRefresh,
    lastError: state.lastError,
  };
}
