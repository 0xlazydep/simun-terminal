import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const ETH_DECIMALS = 18;

const formatEth = (hexBalance: string | null) => {
  if (!hexBalance) return "--";
  try {
    const value = BigInt(hexBalance);
    const divisor = 10n ** BigInt(ETH_DECIMALS);
    const whole = value / divisor;
    const frac = value % divisor;
    const fracStr = frac.toString().padStart(ETH_DECIMALS, "0").slice(0, 4);
    return `${whole}.${fracStr}`;
  } catch {
    return "--";
  }
};

type WalletState = {
  address: string | null;
  chainId: string | null;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

function getProvider() {
  return (window as any).ethereum as { request: (args: { method: string; params?: any[] }) => Promise<any> } | undefined;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("--");

  const loadBalance = useCallback(async (addr: string | null) => {
    const provider = getProvider();
    if (!provider || !addr) {
      setBalance("--");
      return;
    }
    const hex = await provider.request({ method: "eth_getBalance", params: [addr, "latest"] });
    setBalance(formatEth(hex));
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) return;
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const account = accounts?.[0] ?? null;
    setAddress(account);
    const chain = await provider.request({ method: "eth_chainId" });
    setChainId(chain ?? null);
    await loadBalance(account);
  }, [loadBalance]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance("--");
  }, []);

  const refresh = useCallback(async () => {
    await loadBalance(address);
  }, [address, loadBalance]);

  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;
    const handlerAccounts = (accounts: string[]) => {
      const account = accounts?.[0] ?? null;
      setAddress(account);
      loadBalance(account);
    };
    const handlerChain = (id: string) => setChainId(id ?? null);
    provider.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      const account = accounts?.[0] ?? null;
      setAddress(account);
      loadBalance(account);
    });
    provider.request({ method: "eth_chainId" }).then((id: string) => setChainId(id ?? null));
    (provider as any).on?.("accountsChanged", handlerAccounts);
    (provider as any).on?.("chainChanged", handlerChain);
    return () => {
      (provider as any).removeListener?.("accountsChanged", handlerAccounts);
      (provider as any).removeListener?.("chainChanged", handlerChain);
    };
  }, [loadBalance]);

  const value = useMemo(
    () => ({ address, chainId, balance, connect, disconnect, refresh }),
    [address, chainId, balance, connect, disconnect, refresh],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}
