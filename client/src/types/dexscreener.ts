export type DexToken = {
  address: string;
  name?: string;
  symbol: string;
  imageUrl?: string;
};

export type DexPair = {
  pairAddress: string;
  url: string;
  chainId: string;
  dexId?: string;
  chartSymbolType?: "TOKEN" | "POOL";
  baseToken: DexToken;
  quoteToken: DexToken;
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  holders?: number;
  txnCount?: {
    m5?: number;
    h24?: number;
  };
  signal?: boolean;
  liquidity?: {
    usd?: number;
  };
  volume?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  txns?: {
    m5?: { buys?: number; sells?: number };
    h1?: { buys?: number; sells?: number };
    h24?: { buys?: number; sells?: number };
  };
  priceChange?: {
    m5?: number;
    h1?: number;
    h6?: number;
    h24?: number;
  };
  pairCreatedAt?: number;
  lastTransactionAt?: number;
  volumeChangeM5Pct?: number | null;
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
  quote: "CLANKER" | "ZORA" | "PRINTR";
  pairs: DexPair[];
  alerts: ScannerAlert[];
  fetchedAt: number;
};
