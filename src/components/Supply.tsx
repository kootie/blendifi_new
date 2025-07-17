import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../lib/config';
import { getTokenBalance as getTokenBalanceFromContract, getSupplyInfo as getSupplyInfoFromContract, supplyAsset as supplyAssetFromContract, withdrawAsset as withdrawAssetFromContract } from '../lib/contract-calls';

const assets = CONFIG.SUPPORTED_ASSETS;

interface FormErrors {
  amount?: string;
  general?: string;
}

interface SupplyInfo {
  suppliedAmount: string;
  earnedInterest: string;
  apy: number;
}

export default function Supply() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [selectedAsset, setSelectedAsset] = useState(assets[1]); // USDC
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [supplyInfo, setSupplyInfo] = useState<SupplyInfo>({
    suppliedAmount: '0',
    earnedInterest: '0',
    apy: 5.2
  });
  const [balances, setBalances] = useState<Record<string, string>>({});

  // Real contract functions
  const getTokenBalanceReal = useCallback(async (): Promise<string> => {
    return await getTokenBalanceFromContract();
  }, []);

  const getSupplyInfoReal = useCallback(async (): Promise<SupplyInfo> => {
    return await getSupplyInfoFromContract();
  }, []);

  const supplyAssetReal = useCallback(async (): Promise<void> => {
    const txHash = await supplyAssetFromContract();
    console.log('Supply transaction hash:', txHash);
  }, []);

  const withdrawAssetReal = useCallback(async (): Promise<void> => {
    const txHash = await withdrawAssetFromContract();
    console.log('Withdraw transaction hash:', txHash);
  }, []);

  // Use real functions instead of mocks
  const getTokenBalance = getTokenBalanceReal;
  const getSupplyInfo = getSupplyInfoReal;
  const supplyAsset = supplyAssetReal;
  const withdrawAsset = withdrawAssetReal;

  // Load balances and supply info
  const loadUserData = useCallback(async () => {
    if (!isConnected || !publicKey) {
      setBalances({});
      setSupplyInfo({
        suppliedAmount: '0',
        earnedInterest: '0',
        apy: 5.2
      });
      return;
    }

    try {
      const [balancePromises, supplyInfoResult] = await Promise.all([
        Promise.all(assets.map(async (asset) => {
          const balance = await getTokenBalance();
          return [asset.symbol, balance];
        })),
        getSupplyInfo()
      ]);

      const balanceMap = Object.fromEntries(balancePromises);
      setBalances(balanceMap);
      setSupplyInfo(supplyInfoResult);
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast('error', 'Error loading user data');
    }
  }, [isConnected, publicKey, getTokenBalance, getSupplyInfo, showToast]);

  // Load data on mount and when wallet changes
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Validation functions
  const validateForm = useCallback((type: 'supply' | 'withdraw'): boolean => {
    const newErrors: FormErrors = {};

    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      if (!amount || Number(amount) <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      } else {
        if (type === 'supply') {
          const balance = balances[selectedAsset.symbol] || '0';
          if (Number(amount) > Number(balance)) {
            newErrors.amount = 'Insufficient balance';
          }
        } else {
          if (Number(amount) > Number(supplyInfo.suppliedAmount)) {
            newErrors.amount = 'Insufficient supplied amount';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, amount, selectedAsset.symbol, balances, supplyInfo.suppliedAmount]);

  // Handle supply
  const handleSupply = async () => {
    if (!validateForm('supply')) return;

    const toastId = showToast('loading', 'Supplying assets...');
    setLoading(true);

    try {
      await supplyAsset(selectedAsset.address, amount, false);
      
      updateToast(toastId, { type: 'success', title: `Successfully supplied ${amount} ${selectedAsset.symbol}` });
      
      // Reset form
      setAmount('');
      
      // Reload data
      await loadUserData();
    } catch (error) {
      console.error('Supply error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to supply assets. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!validateForm('withdraw')) return;

    const toastId = showToast('loading', 'Withdrawing assets...');
    setLoading(true);

    try {
      await withdrawAsset(selectedAsset.address, amount);
      
      updateToast(toastId, { type: 'success', title: `Successfully withdrew ${amount} ${selectedAsset.symbol}` });
      
      // Reset form
      setAmount('');
      
      // Reload data
      await loadUserData();
    } catch (error) {
      console.error('Withdraw error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to withdraw assets. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Set max amounts
  const setMaxSupply = () => {
    const balance = balances[selectedAsset.symbol] || '0';
    setAmount(balance);
  };

  // Handle amount change
  const handleAmountChange = (value: string) => {
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    const parts = sanitizedValue.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 7) return;
    
    setAmount(sanitizedValue);
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: undefined }));
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Supply Assets</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 mb-4">Connect your wallet to start supplying</p>
        </div>
      ) : (
        <>
          {/* Current Position */}
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Your Position</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Supplied:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {Number(supplyInfo.suppliedAmount).toFixed(2)} {selectedAsset.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Earned Interest:</span>
                <span className="text-green-600">
                  {Number(supplyInfo.earnedInterest).toFixed(2)} {selectedAsset.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">APY:</span>
                <span className="text-green-600">
                  {supplyInfo.apy.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Asset Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Asset
            </label>
            <select
              value={selectedAsset.symbol}
              onChange={(e) => {
                const asset = assets.find(a => a.symbol === e.target.value);
                if (asset) setSelectedAsset(asset);
              }}
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
              disabled={loading}
            >
              {assets.map(asset => (
                <option key={asset.symbol} value={asset.symbol}>
                  {asset.symbol}
                </option>
              ))}
            </select>
          </div>

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0000000"
                className={`w-full px-3 py-2 pr-16 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.amount 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-zinc-300 dark:border-zinc-600'
                } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white`}
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                <button
                  type="button"
                  onClick={setMaxSupply}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
                >
                  Max
                </button>
              </div>
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Balance: {balances[selectedAsset.symbol] || '0.0000000'} {selectedAsset.symbol}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={handleSupply}
              disabled={loading || !amount || Number(amount) <= 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Supplying...' : 'Supply'}
            </button>
            <button
              onClick={handleWithdraw}
              disabled={loading || !amount || Number(amount) <= 0 || Number(supplyInfo.suppliedAmount) <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Withdrawing...' : 'Withdraw'}
            </button>
          </div>

          {/* Info */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">How it works</h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>• Supply assets to earn interest</li>
              <li>• Interest is calculated and paid continuously</li>
              <li>• You can withdraw your supplied assets at any time</li>
              <li>• APY rates may vary based on market conditions</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}