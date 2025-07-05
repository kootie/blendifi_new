import { useState } from 'react';
import { CONFIG } from '../lib/config';
// import { useFreighter } from '../lib/useFreighter'; // Uncomment if wallet state is needed

const assets = CONFIG.SUPPORTED_ASSETS;

export default function Supply() {
  const [asset, setAsset] = useState<string>(assets[0].address);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // const { publicKey, isConnected } = useFreighter(); // Uncomment if needed

  const handleSupply = async () => {
    setStatus('');
    setError('');
    setLoading(true);
    try {
      // Add wallet checks here if needed
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setError('Enter a valid amount.');
        setLoading(false);
        return;
      }
      // await supplyToBlend(asset, BigInt(amount));
      setStatus('Supply successful!');
    } catch (e: any) {
      setError(e.message || 'Supply failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Supply to Blend</h2>
      <div className="mb-4">
        <label className="block mb-1 font-medium">Asset</label>
        <select
          className="w-full p-2 rounded border bg-zinc-100 dark:bg-zinc-800"
          value={asset}
          onChange={e => setAsset(e.target.value)}
        >
          {assets.map(a => (
            <option key={a.address} value={a.address}>{a.symbol}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1 font-medium">Amount</label>
        <input
          type="number"
          className="w-full p-2 rounded border bg-zinc-100 dark:bg-zinc-800"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          min="0"
        />
      </div>
      <button
        className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
        onClick={handleSupply}
        disabled={loading}
      >
        {loading ? 'Supplying...' : 'Supply'}
      </button>
      {status && <div className="mt-4 text-green-600">{status}</div>}
      {error && <div className="mt-4 text-red-600">{error}</div>}
    </div>
  );
} 