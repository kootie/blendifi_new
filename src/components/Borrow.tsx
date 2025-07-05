import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../lib/config';
import { getTokenBalance as getTokenBalanceFromContract, getBorrowInfo as getBorrowInfoFromContract, borrowAsset as borrowAssetFromContract } from '../lib/contract-calls';

const assets = CONFIG.SUPPORTED_ASSETS;

interface FormErrors {
  amount?: string;
  collateral?: string;
  general?: string;
}

interface BorrowInfo {
  borrowedAmount: string;
  collateralValue: string;
  healthFactor: number;
  maxBorrowable: string;
}

export default function Borrow() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [selectedAsset, setSelectedAsset] = useState(assets[1]); // USDC
  const [amount, setAmount] = useState('');
  const [collateralAmount, setCollateralAmount] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [borrowInfo, setBorrowInfo] = useState<BorrowInfo>({
    borrowedAmount: '0',
    collateralValue: '0',
    healthFactor: 0,
    maxBorrowable: '0'
  });
  const [balances, setBalances] = useState<Record<string, string>>({});

  // Real contract functions
  const getTokenBalanceReal = useCallback(async (): Promise<string> => {
    return await getTokenBalanceFromContract();
  }, []);

  const getBorrowInfoReal = useCallback(async (): Promise<BorrowInfo> => {
    return await getBorrowInfoFromContract();
  }, []);

  const borrowAssetReal = useCallback(async (): Promise<void> => {
    const txHash = await borrowAssetFromContract();
    console.log('Borrow transaction hash:', txHash);
  }, []);

  // Use real functions instead of mocks
  const getTokenBalance = getTokenBalanceReal;
  const getBorrowInfo = getBorrowInfoReal;
  const borrowAsset = borrowAssetReal;

  // Load balances and borrow info
  const loadUserData = useCallback(async () => {
    if (!isConnected || !publicKey) {
      setBalances({});
      setBorrowInfo({
        borrowedAmount: '0',
        collateralValue: '0',
        healthFactor: 0,
        maxBorrowable: '0'
      });
      return;
    }

    try {
      const [balancePromises, borrowInfoResult] = await Promise.all([
        Promise.all(assets.map(async (asset) => {
          const balance = await getTokenBalance();
          return [asset.symbol, balance];
        })),
        getBorrowInfo()
      ]);

      const balanceMap = Object.fromEntries(balancePromises);
      setBalances(balanceMap);
      setBorrowInfo(borrowInfoResult);
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast('error', 'Error loading user data');
    }
  }, [isConnected, publicKey, getTokenBalance, getBorrowInfo, showToast]);

  // Load data on mount and when wallet changes
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Validation functions
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      if (!amount || Number(amount) <= 0) {
        newErrors.amount = 'Please enter a valid amount';
      } else {
        const maxBorrowable = Number(borrowInfo.maxBorrowable);
        if (Number(amount) > maxBorrowable) {
          newErrors.amount = `Amount exceeds maximum borrowable (${maxBorrowable})`;
        }
      }

      if (!collateralAmount || Number(collateralAmount) <= 0) {
        newErrors.collateral = 'Please enter collateral amount';
      } else {
        const balance = balances[selectedAsset.symbol] || '0';
        if (Number(collateralAmount) > Number(balance)) {
          newErrors.collateral = 'Insufficient collateral balance';
        }
      }

      // Check health factor
      const newHealthFactor = calculateHealthFactor(
        Number(borrowInfo.borrowedAmount) + Number(amount),
        Number(borrowInfo.collateralValue) + Number(collateralAmount)
      );
      
      if (newHealthFactor < 1.1) {
        newErrors.general = 'Health factor would be too low (< 1.1)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, amount, collateralAmount, selectedAsset.symbol, balances, borrowInfo]);

  // Calculate health factor
  const calculateHealthFactor = (borrowed: number, collateral: number): number => {
    if (borrowed === 0) return 999;
    return collateral / borrowed;
  };

  // Handle borrow
  const handleBorrow = async () => {
    if (!validateForm()) return;

    const toastId = showToast('loading', 'Processing borrow...');
    setLoading(true);

    try {
      await borrowAsset();
      
      updateToast(toastId, { type: 'success', title: `Successfully borrowed ${amount} ${selectedAsset.symbol}` });
      
      // Reset form
      setAmount('');
      setCollateralAmount('');
      
      // Reload data
      await loadUserData();
    } catch (error) {
      console.error('Borrow error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to borrow. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Set max amounts
  const setMaxBorrow = () => {
    setAmount(borrowInfo.maxBorrowable);
  };

  const setMaxCollateral = () => {
    const balance = balances[selectedAsset.symbol] || '0';
    setCollateralAmount(balance);
  };

  // Handle amount changes
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

  const handleCollateralChange = (value: string) => {
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    const parts = sanitizedValue.split('.');
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 7) return;
    
    setCollateralAmount(sanitizedValue);
    if (errors.collateral) {
      setErrors(prev => ({ ...prev, collateral: undefined }));
    }
  };

  // Calculate new health factor
  const newHealthFactor = calculateHealthFactor(
    Number(borrowInfo.borrowedAmount) + Number(amount),
    Number(borrowInfo.collateralValue) + Number(collateralAmount)
  );

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Borrow Assets</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 mb-4">Connect your wallet to start borrowing</p>
        </div>
      ) : (
        <>
          {/* Current Position */}
          <div className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-3">Current Position</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Borrowed:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {Number(borrowInfo.borrowedAmount).toFixed(2)} USDC
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Collateral:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {Number(borrowInfo.collateralValue).toFixed(2)} {selectedAsset.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Health Factor:</span>
                <span className={borrowInfo.healthFactor < 1.1 ? 'text-red-600' : 'text-green-600'}>
                  {borrowInfo.healthFactor.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Max Borrowable:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {Number(borrowInfo.maxBorrowable).toFixed(2)} USDC
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
              Borrow Asset
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

          {/* Borrow Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Borrow Amount
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
              <button
                type="button"
                onClick={setMaxBorrow}
                disabled={loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
              >
                Max
              </button>
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
            )}
          </div>

          {/* Collateral Amount */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Collateral Amount ({selectedAsset.symbol})
            </label>
            <div className="relative">
              <input
                type="text"
                value={collateralAmount}
                onChange={(e) => handleCollateralChange(e.target.value)}
                placeholder="0.0000000"
                className={`w-full px-3 py-2 pr-16 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.collateral 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-zinc-300 dark:border-zinc-600'
                } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={setMaxCollateral}
                disabled={loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
              >
                Max
              </button>
            </div>
            {errors.collateral && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.collateral}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Balance: {balances[selectedAsset.symbol] || '0.0000000'} {selectedAsset.symbol}
            </p>
          </div>

          {/* New Health Factor */}
          {amount && collateralAmount && (
            <div className="mb-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">New Health Factor:</span>
                <span className={newHealthFactor < 1.1 ? 'text-red-600' : 'text-green-600'}>
                  {newHealthFactor.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Borrow Button */}
          <button
            onClick={handleBorrow}
            disabled={loading || !amount || !collateralAmount || Number(amount) <= 0 || Number(collateralAmount) <= 0}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Processing...' : 'Borrow'}
          </button>

          {/* Info */}
          <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">How it works</h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>• Provide collateral to borrow assets</li>
              <li>• Maintain a health factor above 1.1 to avoid liquidation</li>
              <li>• Interest accrues on borrowed amounts</li>
              <li>• You can repay loans at any time</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}