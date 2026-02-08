const RPC_URL = "https://base-rpc.publicnode.com";

const ABI_SELECTORS = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
};

function hexToBigInt(hex?: string) {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

function decodeString(hex?: string) {
  if (!hex || hex === "0x") return "";
  const data = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (data.length === 64) {
    const bytes = data.match(/.{1,2}/g) ?? [];
    return bytes
      .map((b) => String.fromCharCode(Number.parseInt(b, 16)))
      .join("")
      .replace(/\u0000/g, "")
      .trim();
  }
  if (data.length < 128) return "";
  const lengthHex = data.slice(64, 128);
  const length = Number.parseInt(lengthHex, 16);
  const strHex = data.slice(128, 128 + length * 2);
  const bytes = strHex.match(/.{1,2}/g) ?? [];
  return bytes.map((b) => String.fromCharCode(Number.parseInt(b, 16))).join("");
}

function formatUnits(value: bigint, decimals: number) {
  if (decimals <= 0) return value.toString();
  const str = value.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, -decimals);
  const fraction = str.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function callRpc(to: string, data: string) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  });
  if (!res.ok) {
    throw new Error(`RPC error: ${res.status}`);
  }
  const json = (await res.json()) as { result?: string };
  return json.result ?? "0x";
}

export async function getErc20Info(address: string) {
  const [nameHex, symbolHex, decimalsHex, totalSupplyHex] = await Promise.all([
    callRpc(address, ABI_SELECTORS.name),
    callRpc(address, ABI_SELECTORS.symbol),
    callRpc(address, ABI_SELECTORS.decimals),
    callRpc(address, ABI_SELECTORS.totalSupply),
  ]);

  const name = decodeString(nameHex);
  const symbol = decodeString(symbolHex);
  const decimals = Number.parseInt(decimalsHex, 16) || 0;
  const totalSupply = hexToBigInt(totalSupplyHex);

  return {
    address,
    name,
    symbol,
    decimals,
    totalSupply: totalSupply.toString(),
    totalSupplyFormatted: formatUnits(totalSupply, decimals),
  };
}
