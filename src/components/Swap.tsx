import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../lib/config';
import { getTokenBalance as getTokenBalanceFromContract, executeSwap as executeSwapFromContract } from '../lib/contract-calls';

const assets = CONFIG.SUPPORTED_ASSETS;

interface FormErrors {
  fromAmount?: string;
  toAmount?: string;
  general?: string;
}

interface SwapQuote {
  fromAmount: string;
  toAmount: string;
  priceImpact: number;
  minimumReceived: string;
}

export default function Swap() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [fromAsset, setFromAsset] = useState(assets[0]);
  const [toAsset, setToAsset] = useState(assets[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [balances, setBalances] = useState<Record<string, string>>({});

  // Real contract functions
  const getTokenBalanceReal = useCallback(async (): Promise<string> => {
    return await getTokenBalanceFromContract();
  }, []);

  const getSwapQuoteReal = useCallback(async (): Promise<SwapQuote | null> => {
    return await getSwapQuote();
  }, []);

  const executeSwapReal = useCallback(async (fromToken: string, toToken: string, amountIn: string, minAmountOut: string): Promise<void> => {
    const txHash = await executeSwapFromContract(fromToken, toToken, amountIn, minAmountOut);
    console.log('Swap transaction hash:', txHash);
  }, []);

  // Use real functions instead of mocks
  const getTokenBalance = getTokenBalanceReal;
  const getSwapQuote = getSwapQuoteReal;

  // Load balances
  const loadBalances = useCallback(async () => {
    if (!isConnected || !publicKey) {
      setBalances({});
      return;
    }

    try {
      const balancePromises = assets.map(async (asset) => {
        const balance = await getTokenBalance(asset.address);
        return [asset.symbol, balance];
      });

      const balanceResults = await Promise.all(balancePromises);
      const balanceMap = Object.fromEntries(balanceResults);
      setBalances(balanceMap);
    } catch (error) {
      console.error('Error loading balances:', error);
      showToast('error', 'Error loading balances');
    }
  }, [isConnected, publicKey, getTokenBalance, showToast]);

  // Get quote when inputs change
  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || Number(fromAmount) <= 0) {
        setQuote(null);
        setToAmount('');
        return;
      }

      try {
        const quoteResult = await getSwapQuoteReal();
        setQuote(quoteResult);
        if (quoteResult) {
          setToAmount(quoteResult.toAmount);
        }
      } catch (error) {
        console.error('Error getting quote:', error);
        setQuote(null);
        setToAmount('');
      }
    };

    getQuote();
  }, [fromAsset, toAsset, fromAmount, getSwapQuoteReal]);

  // Load balances on mount and when wallet changes
  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  // Validation functions
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      if (!fromAmount || Number(fromAmount) <= 0) {
        newErrors.fromAmount = 'Please enter a valid amount';
      } else {
        const balance = balances[fromAsset.symbol] || '0';
        if (Number(fromAmount) > Number(balance)) {
          newErrors.fromAmount = 'Insufficient balance';
        }
      }

      if (!quote) {
        newErrors.toAmount = 'Unable to get quote';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, fromAmount, fromAsset.symbol, balances, quote]);

  // Handle swap
  const handleSwap = async () => {
    if (!validateForm() || !quote) return;

    const toastId = showToast('loading', 'Executing swap...');
    setLoading(true);

    try {
      await executeSwapReal(fromAsset.address, toAsset.address, fromAmount, quote.minimumReceived);
      updateToast(toastId, { type: 'success', title: `Successfully swapped ${fromAmount} ${fromAsset.symbol} for ${toAmount} ${toAsset.symbol}` });
      setFromAmount('');
      setToAmount('');
      setQuote(null);
      await loadBalances();
    } catch (error) {
      console.error('Swap error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to execute swap. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Switch assets
  const switchAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
    setQuote(null);
  };

  // Set max amount
  const setMaxAmount = () => {
    const balance = balances[fromAsset.symbol] || '0';
    setFromAmount(balance);
  };

  // Handle amount change
  const handleFromAmountChange = (value: string) => {
    // Only allow numbers and decimal points
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitizedValue.split('.');
    if (parts.length > 2) return;
    
    // Limit decimal places
    if (parts[1] && parts[1].length > 7) return;
    
    setFromAmount(sanitizedValue);
    
    // Clear errors when user starts typing
    if (errors.fromAmount) {
      setErrors(prev => ({ ...prev, fromAmount: undefined }));
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-6">Swap Tokens</h2>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 mb-4">Connect your wallet to start swapping</p>
        </div>
      ) : (
        <>
          {/* Error Display */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* From Asset */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              From
            </label>
            <div className="relative">
              <input
                type="text"
                value={fromAmount}
                onChange={(e) => handleFromAmountChange(e.target.value)}
                placeholder="0.0000000"
                className={`w-full px-3 py-2 pr-20 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.fromAmount 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-zinc-300 dark:border-zinc-600'
                } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white`}
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={setMaxAmount}
                  disabled={loading}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
                >
                  Max
                </button>
                <select
                  value={fromAsset.symbol}
                  onChange={(e) => {
                    const asset = assets.find(a => a.symbol === e.target.value);
                    if (asset) setFromAsset(asset);
                  }}
                  className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-600"
                  disabled={loading}
                >
                  {assets.map(asset => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {errors.fromAmount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.fromAmount}</p>
            )}
            <p className="mt-1 text-xs text-zinc-500">
              Balance: {balances[fromAsset.symbol] || '0.0000000'} {fromAsset.symbol}
            </p>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center mb-4">
            <button
              onClick={switchAssets}
              disabled={loading}
              className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Asset */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              To
            </label>
            <div className="relative">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0000000"
                className={`w-full px-3 py-2 pr-20 border rounded-lg ${
                  errors.toAmount 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-zinc-300 dark:border-zinc-600'
                } bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white`}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <select
                  value={toAsset.symbol}
                  onChange={(e) => {
                    const asset = assets.find(a => a.symbol === e.target.value);
                    if (asset) setToAsset(asset);
                  }}
                  className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-300 dark:border-zinc-600"
                  disabled={loading}
                >
                  {assets.map(asset => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.symbol}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {errors.toAmount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.toAmount}</p>
            )}
          </div>

          {/* Quote Info */}
          {quote && (
            <div className="mb-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Price Impact:</span>
                <span className={quote.priceImpact > 1 ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}>
                  {quote.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Minimum Received:</span>
                <span className="text-zinc-900 dark:text-zinc-100">
                  {quote.minimumReceived} {toAsset.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Slippage */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Slippage Tolerance
            </label>
            <div className="flex space-x-2">
              {[0.1, 0.5, 1.0].map((value) => (
                <button
                  key={value}
                  onClick={() => setSlippage(value)}
                  className={`px-3 py-1 text-sm rounded ${
                    slippage === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {value}%
                </button>
              ))}
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={loading || !fromAmount || !quote || Number(fromAmount) <= 0}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Swapping...' : 'Swap'}
          </button>
        </>
      )}
    </div>
  );
}