import { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import { CONFIG } from '../lib/config';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { 
  swapTokens
} from '../lib/contract-calls';
import { 
  getTokenBalance 
} from '../lib/stellar-utils';

const assets = CONFIG.SUPPORTED_ASSETS;

// Mock exchange rates - replace with your actual rates
const EXCHANGE_RATES = {
  'XLM->USDC': 0.12,
  'USDC->XLM': 8.33,
  'wETH->USDC': 2500,
  'USDC->wETH': 0.0004,
  'wBTC->USDC': 45000,
  'USDC->wBTC': 0.000022,
  'BLND->USDC': 0.05,
  'USDC->BLND': 20,
  'XLM->wETH': 0.000048,
  'wETH->XLM': 20833.33,
  'XLM->wBTC': 0.00000267,
  'wBTC->XLM': 375000,
  'BLEND->XLM': 0.417,
  'XLM->BLEND': 2.4,
};

interface FormErrors {
  amount?: string;
  slippage?: string;
  general?: string;
}

export default function Swap() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [fromAsset, setFromAsset] = useState<string>(assets[0].address);
  const [toAsset, setToAsset] = useState<string>(assets[1].address);
  const [amount, setAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('');
  const [minAmountOut, setMinAmountOut] = useState('');
  const [slippage, setSlippage] = useState('1.0');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [balance, setBalance] = useState<string>('0');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get asset details by address
  const getAssetByAddress = useCallback((address: string) => {
    return assets.find(asset => asset.address === address);
  }, []);

  // Calculate exchange rate between two assets
  const calculateExchangeRate = useCallback((fromAddr: string, toAddr: string) => {
    const fromAsset = getAssetByAddress(fromAddr);
    const toAsset = getAssetByAddress(toAddr);
    
    if (!fromAsset || !toAsset) return 0;
    
    const rateKey = `${fromAsset.symbol}->${toAsset.symbol}`;
    const reverseKey = `${toAsset.symbol}->${fromAsset.symbol}`;
    
    if (EXCHANGE_RATES[rateKey as keyof typeof EXCHANGE_RATES]) {
      return EXCHANGE_RATES[rateKey as keyof typeof EXCHANGE_RATES];
    } else if (EXCHANGE_RATES[reverseKey as keyof typeof EXCHANGE_RATES]) {
      return 1 / EXCHANGE_RATES[reverseKey as keyof typeof EXCHANGE_RATES];
    }
    
    // Try to find rate through USDC as intermediate
    const fromToUSDC = EXCHANGE_RATES[`${fromAsset.symbol}->USDC` as keyof typeof EXCHANGE_RATES];
    const USDCToTo = EXCHANGE_RATES[`USDC->${toAsset.symbol}` as keyof typeof EXCHANGE_RATES];
    
    if (fromToUSDC && USDCToTo) {
      return fromToUSDC * USDCToTo;
    }
    
    return 1; // Default rate if no rate found
  }, [getAssetByAddress]);

  // Calculate estimated output amount
  const calculateEstimatedOutput = useCallback((inputAmount: string, fromAddr: string, toAddr: string) => {
    if (!inputAmount || isNaN(Number(inputAmount)) || Number(inputAmount) <= 0) {
      return '';
    }
    
    const rate = calculateExchangeRate(fromAddr, toAddr);
    const fromAsset = getAssetByAddress(fromAddr);
    const toAsset = getAssetByAddress(toAddr);
    
    if (!fromAsset || !toAsset || rate === 0) {
      return '';
    }
    
    // Adjust for decimal differences
    const normalizedAmount = Number(inputAmount) * Math.pow(10, fromAsset.decimals);
    const outputAmount = (normalizedAmount * rate) / Math.pow(10, toAsset.decimals);
    
    return outputAmount.toFixed(Math.min(toAsset.decimals, 8));
  }, [calculateExchangeRate, getAssetByAddress]);

  // Calculate minimum amount out based on slippage
  const calculateMinAmountOut = useCallback((estimatedAmount: string, slippagePercent: string) => {
    if (!estimatedAmount || isNaN(Number(estimatedAmount))) return '';
    
    const slippageMultiplier = (100 - Number(slippagePercent)) / 100;
    const minAmount = Number(estimatedAmount) * slippageMultiplier;
    
    return minAmount.toFixed(8);
  }, []);

  // Calculate price impact
  const calculatePriceImpact = useCallback((inputAmount: string, outputAmount: string, rate: number) => {
    if (!inputAmount || !outputAmount || !rate) return '';
    
    const expectedOutput = Number(inputAmount) * rate;
    const actualOutput = Number(outputAmount);
    
    if (expectedOutput === 0) return '';
    
    const impact = ((expectedOutput - actualOutput) / expectedOutput) * 100;
    return Math.abs(impact).toFixed(2);
  }, []);

  // Validation functions
  const validateAmount = useCallback((value: string): string | undefined => {
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return 'Amount must be greater than 0';
    }
    
    if (numValue > Number(balance)) {
      return 'Insufficient balance';
    }
    
    return undefined;
  }, [balance]);

  const validateSlippage = useCallback((value: string): string | undefined => {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0 || numValue > 50) {
      return 'Slippage must be between 0% and 50%';
    }
    
    return undefined;
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    
    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      const amountError = validateAmount(amount);
      if (amountError) {
        newErrors.amount = amountError;
      }
      
      const slippageError = validateSlippage(slippage);
      if (slippageError) {
        newErrors.slippage = slippageError;
      }
      
      if (fromAsset === toAsset) {
        newErrors.general = 'Select different tokens';
      }
      
      if (!estimatedOutput || Number(estimatedOutput) <= 0) {
        newErrors.general = 'Invalid output amount calculated';
      }
      
      if (Number(priceImpact) > 15) {
        newErrors.general = 'Price impact too high (>15%). Consider reducing amount.';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, amount, slippage, fromAsset, toAsset, estimatedOutput, priceImpact, validateAmount, validateSlippage]);

  // Load balance for selected asset
  const loadBalance = useCallback(async () => {
    try {
      if (!isConnected || !publicKey) {
        setBalance('0');
        return;
      }

      setIsRefreshing(true);
      const balance = await getTokenBalance(fromAsset, publicKey);
      const fromAssetInfo = getAssetByAddress(fromAsset);
      if (fromAssetInfo) {
        const formattedBalance = (Number(balance) / Math.pow(10, fromAssetInfo.decimals)).toFixed(8);
        setBalance(formattedBalance);
      }
    } catch (e) {
      console.error('Failed to load balance:', e);
      setBalance('0');
    } finally {
      setIsRefreshing(false);
    }
  }, [fromAsset, getAssetByAddress, isConnected, publicKey]);

  // Load balance when fromAsset changes
  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  // Update estimated output when inputs change
  useEffect(() => {
    const estimated = calculateEstimatedOutput(amount, fromAsset, toAsset);
    setEstimatedOutput(estimated);
    
    const rate = calculateExchangeRate(fromAsset, toAsset);
    const fromSymbol = getAssetByAddress(fromAsset)?.symbol || '';
    const toSymbol = getAssetByAddress(toAsset)?.symbol || '';
    setExchangeRate(`1 ${fromSymbol} = ${rate.toFixed(6)} ${toSymbol}`);
    
    const minOut = calculateMinAmountOut(estimated, slippage);
    setMinAmountOut(minOut);
    
    const impact = calculatePriceImpact(amount, estimated, rate);
    setPriceImpact(impact);
  }, [amount, fromAsset, toAsset, slippage, calculateEstimatedOutput, calculateExchangeRate, calculateMinAmountOut, calculatePriceImpact, getAssetByAddress]);

  // Reset form after successful transaction
  const resetForm = useCallback(() => {
    setAmount('');
    setEstimatedOutput('');
    setMinAmountOut('');
    setPriceImpact('');
    setErrors({});
  }, []);

  // Swap assets
  const swapAssets = () => {
    const tempFromAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempFromAsset);
    
    // Clear amount to avoid confusion
    resetForm();
  };

  const handleSwap = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const toastId = showToast(
      'loading',
      'Swapping tokens...',
      'Please wait while your transaction is being processed'
    );

    try {
      const fromAssetInfo = getAssetByAddress(fromAsset);
      const toAssetInfo = getAssetByAddress(toAsset);
      
      if (!fromAssetInfo || !toAssetInfo) {
        throw new Error('Invalid asset selection');
      }

      // Convert amounts to contract format
      const amountIn = BigInt(Math.floor(Number(amount) * Math.pow(10, fromAssetInfo.decimals)));
      const minAmountOutBigInt = BigInt(Math.floor(Number(minAmountOut) * Math.pow(10, toAssetInfo.decimals)));
      
      // Set deadline to 20 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);
      
      // Call the swap_tokens function
      const transactionHash = await swapTokens(
        fromAsset,
        toAsset,
        amountIn,
        minAmountOutBigInt,
        deadline,
        publicKey!
      );
      
      // Update toast to success
      updateToast(toastId, {
        type: 'success',
        title: 'Swap Successful!',
        message: `Swapped ${amount} ${fromAssetInfo.symbol} for ${estimatedOutput} ${toAssetInfo.symbol}`,
        hash: transactionHash,
        duration: 5000
      });
      
      resetForm();
      
      // Reload balance after successful swap
      await loadBalance();
      
    } catch (e: any) {
      console.error('Swap error:', e);
      
      // Update toast to error
      updateToast(toastId, {
        type: 'error',
        title: 'Swap Failed',
        message: e.message || 'Failed to swap tokens',
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMaxAmount = () => {
    setAmount(balance);
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

  const handleSlippageChange = (value: string) => {
    setSlippage(value);
    // Clear slippage error when user starts typing
    if (errors.slippage) {
      setErrors(prev => ({ ...prev, slippage: undefined }));
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Swap Tokens</h2>
      
      {/* Error Display */}
      {errors.general && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
        </div>
      )}

      {/* From Asset */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          From
        </label>
        <div className="relative">
          <select
            value={fromAsset}
            onChange={(e) => setFromAsset(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:text-white"
            disabled={loading}
          >
            {assets.map((asset) => (
              <option key={asset.address} value={asset.address}>
                {asset.symbol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Amount
          </label>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Balance: {isRefreshing ? 'Loading...' : balance}
            </span>
            <button
              type="button"
              onClick={loadBalance}
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
            step="0.00000001"
            min="0"
            max={balance}
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
              onClick={handleMaxAmount}
              disabled={loading || !isConnected || Number(balance) <= 0}
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

      {/* Swap Button */}
      <div className="flex justify-center mb-4">
        <button
          onClick={swapAssets}
          disabled={loading}
          className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4" />
        </button>
      </div>

      {/* To Asset */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          To
        </label>
        <select
          value={toAsset}
          onChange={(e) => setToAsset(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-zinc-800 dark:text-white"
          disabled={loading}
        >
          {assets.map((asset) => (
            <option key={asset.address} value={asset.address}>
              {asset.symbol}
            </option>
          ))}
        </select>
      </div>

      {/* Estimated Output */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          You will receive
        </label>
        <div className="p-3 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {estimatedOutput || '0.0'} {getAssetByAddress(toAsset)?.symbol}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {exchangeRate}
          </div>
        </div>
      </div>

      {/* Slippage Settings */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Slippage Tolerance (%)
        </label>
        <input
          type="number"
          value={slippage}
          onChange={(e) => handleSlippageChange(e.target.value)}
          placeholder="1.0"
          step="0.1"
          min="0"
          max="50"
          className={`
            w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            dark:bg-zinc-800 dark:border-zinc-700 dark:text-white
            ${errors.slippage ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-zinc-600'}
          `}
          disabled={loading}
        />
        {errors.slippage && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.slippage}</p>
        )}
      </div>

      {/* Swap Details */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Price Impact:</span>
            <span className={Number(priceImpact) > 5 ? 'text-red-600' : 'text-gray-900 dark:text-white'}>
              {priceImpact}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Minimum Received:</span>
            <span className="text-gray-900 dark:text-white">
              {minAmountOut} {getAssetByAddress(toAsset)?.symbol}
            </span>
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={loading || !isConnected || !amount || Number(amount) <= 0 || fromAsset === toAsset}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Swapping...
          </div>
        ) : (
          'Swap'
        )}
      </button>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>• Slippage tolerance protects you from price changes</p>
        <p>• High price impact may result in unfavorable rates</p>
        <p>• Transaction fees are minimal on Stellar</p>
      </div>
    </div>
  );
} 