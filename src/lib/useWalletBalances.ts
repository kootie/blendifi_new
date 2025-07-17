import { useEffect, useState, useCallback } from 'react';
import { CONFIG } from './config';

// Helper to fetch balances from Horizon
async function fetchHorizonBalances(address: string) {
  const HORIZON_URL = 'https://horizon-testnet.stellar.org';
  const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
  if (!res.ok) throw new Error('Failed to fetch account from Horizon');
  return (await res.json()).balances;
}

export function useWalletBalances(publicKey: string | null) {
  const [balances, setBalances] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!publicKey) {
      setBalances(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const horizonBalances = await fetchHorizonBalances(publicKey);
      const results = CONFIG.SUPPORTED_ASSETS.map((asset) => {
        if (asset.isNative) {
          const xlm = horizonBalances.find((b: any) => b.asset_type === 'native');
          return {
            ...asset,
            balance: xlm ? xlm.balance : '0',
          };
        } else {
          const token = horizonBalances.find((b: any) => b.asset_code === asset.symbol && b.asset_issuer === asset.issuer);
          return {
            ...asset,
            balance: token ? token.balance : '0',
          };
        }
      });
      setBalances(results);
    } catch (e) {
      setError('Failed to fetch balances');
      setBalances(null);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalances();
    if (!publicKey) return;
    const interval = setInterval(fetchBalances, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchBalances, publicKey]);

  return { balances, loading, error, refresh: fetchBalances };
} 