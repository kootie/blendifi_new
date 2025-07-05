import { useWallet } from '../context/WalletContext';
import { useWalletBalances } from '../lib/useWalletBalances';

const SUPPORTED_ASSETS = [
  { code: 'XLM', issuer: null },
  { code: 'BLND', issuer: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY' },
  { code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' },
  { code: 'wETH', issuer: 'GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH' },
  { code: 'wBTC', issuer: 'GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB' },
];

export default function Portfolio() {
  const { publicKey, isConnected } = useWallet();
  const { balances, loading, error } = useWalletBalances(publicKey);

  const getTokenBalance = (code: string, issuer: string | null) => {
    if (!balances) return '0';
    if (code === 'XLM') {
      const xlm = balances.find(b => b.asset_type === 'native');
      return xlm ? xlm.balance : '0';
    }
    const token = balances.find(b => b.asset_code === code && b.asset_issuer === issuer);
    return token ? token.balance : '0';
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Portfolio</h2>
      {isConnected && publicKey ? (
        <div>
          <div className="mb-2 text-zinc-700 dark:text-zinc-200">Wallet: <span className="font-mono text-xs">{publicKey}</span></div>
          {loading ? (
            <div className="text-zinc-500">Loading balances...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : (
            <div>
              <h3 className="font-semibold mb-2">Balances</h3>
              <ul>
                {SUPPORTED_ASSETS.map(asset => (
                  <li key={asset.code} className="flex justify-between py-1">
                    <span>{asset.code}</span>
                    <span>{getTokenBalance(asset.code, asset.issuer)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="text-zinc-500 mb-2">Connect your wallet to view your portfolio.</div>
        </div>
      )}
    </div>
  );
} 