import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../lib/config';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { borrowFromBlend, getUserPosition } from '../lib/contract-calls';
import { getAssetPrice } from '../lib/stellar-utils';

const assets = CONFIG.SUPPORTED_ASSETS;

interface FormErrors {
  amount?: string;
  general?: string;
}

export default function Borrow() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [asset, setAsset] = useState<string>(assets[0].address);
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [userPosition, setUserPosition] = useState<any>(null);
  const [assetPrice, setAssetPrice] = useState<string>('0');
  const [projectedHealth, setProjectedHealth] = useState<string>('');
  const [maxBorrowable, setMaxBorrowable] = useState<string>('0');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get selected asset details
  const selectedAsset = assets.find(a => a.address === asset);

  // Validation functions
  const validateAmount = useCallback((value: string): string | undefined => {
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return 'Amount must be greater than 0';
    }
    
    if (numValue > Number(maxBorrowable)) {
      return `Amount exceeds maximum borrowable (${maxBorrowable} ${selectedAsset?.symbol})`;
    }
    
    return undefined;
  }, [maxBorrowable, selectedAsset]);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    
    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      const amountError = validateAmount(amount);
      if (amountError) {
        newErrors.amount = amountError;
      }
      
      if (projectedHealth !== 'Error' && Number(projectedHealth) < 1.1) {
        newErrors.general = 'This borrow would make your position too risky (health factor < 1.1)';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, amount, projectedHealth, validateAmount]);

  // Load user position and asset data
  const loadUserData = useCallback(async () => {
    try {
      if (!isConnected || !publicKey) {
        setUserPosition(null);
        setMaxBorrowable('0');
        setProjectedHealth('');
        return;
      }

      setIsRefreshing(true);
      const position = await getUserPosition(publicKey);
      setUserPosition(position);
    } catch (e) {
      console.error('Failed to load user data:', e);
      setUserPosition(null);
      setMaxBorrowable('0');
      setProjectedHealth('');
    } finally {
      setIsRefreshing(false);
    }
  }, [isConnected, publicKey]);

  // Load asset price when asset changes
  const loadAssetPrice = useCallback(async () => {
    try {
      const price = await getAssetPrice(asset);
      // Convert price from wei to readable format
      const priceInDollars = (Number(price) / 1e18).toFixed(4);
      setAssetPrice(priceInDollars);
    } catch (e) {
      console.error('Failed to load asset price:', e);
      setAssetPrice('0');
    }
  }, [asset]);

  // Load data on component mount and when wallet changes
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Load asset price when asset changes
  useEffect(() => {
    loadAssetPrice();
  }, [loadAssetPrice]);

  // Update calculations when asset or amount changes
  useEffect(() => {
    if (userPosition && amount) {
      calculateProjectedHealth();
      calculateMaxBorrowable();
    }
  }, [asset, amount, userPosition]);

  const calculateProjectedHealth = () => {
    if (!userPosition || !amount || !selectedAsset) return;

    try {
      // Convert amount to proper decimals
      const borrowAmount = BigInt(Number(amount) * Math.pow(10, selectedAsset.decimals));
      
      // Simulate adding this borrow to current position
      const currentBorrowedAmount = userPosition.borrowed_assets?.get(asset) || 0n;
      const newBorrowedAmount = currentBorrowedAmount + borrowAmount;
      
      // Calculate projected health factor
      // This is a simplified calculation - in practice you'd want to mirror the contract logic
      let totalCollateralValue = 0;
      let totalDebtValue = 0;
      
      // Calculate current collateral value
      if (userPosition.supplied_assets) {
        for (const [assetAddr, suppliedAmount] of userPosition.supplied_assets) {
          const assetConfig = assets.find(a => a.address === assetAddr);
          if (assetConfig) {
            // This would need actual price data
            const value = Number(suppliedAmount) / Math.pow(10, assetConfig.decimals);
            totalCollateralValue += value * Number(assetPrice);
          }
        }
      }
      
      // Calculate projected debt value
      if (userPosition.borrowed_assets) {
        for (const [assetAddr, borrowedAmount] of userPosition.borrowed_assets) {
          const assetConfig = assets.find(a => a.address === assetAddr);
          if (assetConfig) {
            const amount = assetAddr === asset ? newBorrowedAmount : borrowedAmount;
            const value = Number(amount) / Math.pow(10, assetConfig.decimals);
            totalDebtValue += value * Number(assetPrice);
          }
        }
      }
      
      // Add new borrow to debt value
      const newBorrowValue = Number(amount) * Number(assetPrice);
      totalDebtValue += newBorrowValue;
      
      const projectedHealthFactor = totalDebtValue > 0 ? totalCollateralValue / totalDebtValue : 999;
      setProjectedHealth(projectedHealthFactor.toFixed(3));
      
    } catch (e) {
      console.error('Error calculating projected health:', e);
      setProjectedHealth('Error');
    }
  };

  const calculateMaxBorrowable = () => {
    if (!userPosition || !selectedAsset) return;

    try {
      // Calculate maximum borrowable amount based on collateral
      // This is a simplified calculation
      let totalCollateralValue = 0;
      let totalDebtValue = 0;
      
      // Calculate current collateral value (with LTV)
      if (userPosition.supplied_assets) {
        for (const [assetAddr, suppliedAmount] of userPosition.supplied_assets) {
          const assetConfig = assets.find(a => a.address === assetAddr);
          if (assetConfig) {
            const value = Number(suppliedAmount) / Math.pow(10, assetConfig.decimals);
            const ltvAdjustedValue = value * Number(assetPrice) * (assetConfig.collateralFactor || 7000) / 10000;
            totalCollateralValue += ltvAdjustedValue;
          }
        }
      }
      
      // Calculate current debt value
      if (userPosition.borrowed_assets) {
        for (const [assetAddr, borrowedAmount] of userPosition.borrowed_assets) {
          const assetConfig = assets.find(a => a.address === assetAddr);
          if (assetConfig) {
            const value = Number(borrowedAmount) / Math.pow(10, assetConfig.decimals);
            totalDebtValue += value * Number(assetPrice);
          }
        }
      }
      
      // Max borrowable = (collateral_value - current_debt) / asset_price
      // Keep health factor above 1.1 for safety
      const safetyBuffer = 1.1;
      const maxBorrowValue = Math.max(0, (totalCollateralValue / safetyBuffer) - totalDebtValue);
      const maxBorrowAmount = maxBorrowValue / Number(assetPrice);
      
      setMaxBorrowable(maxBorrowAmount.toFixed(6));
      
    } catch (e) {
      console.error('Error calculating max borrowable:', e);
      setMaxBorrowable('0');
    }
  };

  // Reset form after successful transaction
  const resetForm = useCallback(() => {
    setAmount('');
    setErrors({});
  }, []);

  const handleBorrow = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const toastId = showToast(
      'loading',
      'Borrowing assets...',
      'Please wait while your transaction is being processed'
    );

    try {
      if (!selectedAsset) {
        throw new Error('Invalid asset selected');
      }

      // Convert amount to contract format
      const contractAmount = BigInt(Math.floor(Number(amount) * Math.pow(10, selectedAsset.decimals)));
      
      // Call the borrow_from_blend function
      const transactionHash = await borrowFromBlend(asset, contractAmount, publicKey!);
      
      // Update toast to success
      updateToast(toastId, {
        type: 'success',
        title: 'Borrow Successful!',
        message: `Successfully borrowed ${amount} ${selectedAsset.symbol}`,
        hash: transactionHash,
        duration: 5000
      });
      
      resetForm();
      
      // Reload user data after successful borrow
      await loadUserData();
      
    } catch (e: any) {
      console.error('Borrow error:', e);
      
      // Update toast to error
      updateToast(toastId, {
        type: 'error',
        title: 'Borrow Failed',
        message: e.message || 'Failed to borrow assets',
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthFactorColor = (health: string) => {
    const healthNum = Number(health);
    if (healthNum >= 1.5) return 'text-green-600';
    if (healthNum >= 1.1) return 'text-yellow-600';
    return 'text-red-600';
  };

  const setMaxAmount = () => {
    setAmount(maxBorrowable);
    // Clear any amount-related errors when setting max
    setErrors(prev => ({ ...prev, amount: undefined }));
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    // Clear amount error when user starts typing
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: undefined }));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Borrow Assets</h2>
      
      {/* Error Display */}
      {errors.general && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
        </div>
      )}

      {/* Asset Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Asset to Borrow
        </label>
        <select
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:text-white"
          disabled={loading}
        >
          {assets.map((assetOption) => (
            <option key={assetOption.address} value={assetOption.address}>
              {assetOption.symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Max: {maxBorrowable} {selectedAsset?.symbol}
            </span>
            <button
              type="button"
              onClick={loadUserData}
              disabled={isRefreshing}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 disabled:opacity-50 text-xs"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.0"
            step="0.000001"
            min="0"
            max={maxBorrowable}
            className={`
              w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-zinc-800 dark:border-zinc-700 dark:text-white
              ${errors.amount ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-zinc-600'}
            `}
            disabled={loading || !isConnected}
          />
          <div className="absolute right-2 top-2">
            <button
              type="button"
              onClick={setMaxAmount}
              disabled={loading || !isConnected || Number(maxBorrowable) <= 0}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Max
            </button>
          </div>
        </div>
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
        )}
      </div>

      {/* Position Information */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
          Position Information
        </h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Current Health Factor:</span>
            <span className={`font-mono ${getHealthFactorColor(userPosition?.health_factor || '1.5')}`}>
              {userPosition?.health_factor ? Number(userPosition.health_factor).toFixed(3) : '1.500'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Projected Health Factor:</span>
            <span className={`font-mono ${getHealthFactorColor(projectedHealth)}`}>
              {projectedHealth || '1.500'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Asset Price:</span>
            <span className="font-mono">${assetPrice}</span>
          </div>
          <div className="flex justify-between">
            <span>Max Borrowable:</span>
            <span className="font-mono">{maxBorrowable} {selectedAsset?.symbol}</span>
          </div>
        </div>
      </div>

      {/* Borrow Button */}
      <button
        onClick={handleBorrow}
        disabled={loading || !isConnected || !amount || Number(amount) <= 0 || Number(maxBorrowable) <= 0}
        className="w-full py-3 px-4 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Borrowing...' : 'Borrow'}
      </button>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>• Health factor below 1.1 puts your position at risk of liquidation</p>
        <p>• Borrowing increases your debt and reduces your health factor</p>
        <p>• Ensure you have sufficient collateral before borrowing</p>
      </div>
    </div>
  );
} 