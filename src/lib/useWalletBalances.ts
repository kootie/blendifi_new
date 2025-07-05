import { useEffect, useState, useCallback } from 'react';
import { CONFIG } from './config';
import { getTokenBalance } from './stellar-utils';

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
      const results = await Promise.all(
        CONFIG.SUPPORTED_ASSETS.map(async (asset) => {
          const raw = await getTokenBalance(asset.address, publicKey);
          const balance = Number(raw) / Math.pow(10, asset.decimals);
          return {
            ...asset,
            balance: balance.toFixed(asset.decimals),
          };
        })
      );
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