import { useState, useEffect, useCallback } from 'react';
import { ArrowUpDown, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { CONFIG } from '../lib/config';
import { 
  swapTokens, 
  getWalletState
} from '../lib/stellar-utils';

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

// Real functions from stellar-utils
const getWalletStateReal = getWalletState;
const swapTokensReal = swapTokens;

const assets = CONFIG.SUPPORTED_ASSETS;

export default function EnhancedSwap() {
  const [fromAsset, setFromAsset] = useState<string>(assets[0].address);
  const [toAsset, setToAsset] = useState<string>(assets[1].address);
  const [amount, setAmount] = useState('');
  const [estimatedOutput, setEstimatedOutput] = useState('');
  const [minAmountOut, setMinAmountOut] = useState('');
  const [slippage, setSlippage] = useState('1.0');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [priceImpact, setPriceImpact] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');

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

  // Swap assets
  const swapAssets = () => {
    const tempFromAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempFromAsset);
    
    // Clear amount to avoid confusion
    setAmount('');
    setEstimatedOutput('');
    setMinAmountOut('');
    setPriceImpact('');
  };

  // Validate swap parameters
  const validateSwap = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Enter a valid amount');
    }
    
    if (fromAsset === toAsset) {
      throw new Error('Select different tokens');
    }
    
    if (!estimatedOutput || Number(estimatedOutput) <= 0) {
      throw new Error('Invalid output amount calculated');
    }
    
    if (Number(slippage) < 0 || Number(slippage) > 50) {
      throw new Error('Slippage must be between 0% and 50%');
    }
    
    if (Number(priceImpact) > 15) {
      throw new Error('Price impact too high (>15%). Consider reducing amount.');
    }
  };

  // Handle swap execution
  const handleSwap = async () => {
    setStatus('');
    setError('');
    setLoading(true);
    
    try {
      // Check wallet connection
      const wallet = await getWalletStateReal();
      if (!wallet.isConnected || !wallet.publicKey) {
        throw new Error('Please connect your Freighter wallet');
      }
      
      // Validate swap parameters
      validateSwap();
      
      // Calculate deadline (10 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
      
      // Convert amounts to proper format
      const fromAssetInfo = getAssetByAddress(fromAsset);
      const toAssetInfo = getAssetByAddress(toAsset);
      
      if (!fromAssetInfo || !toAssetInfo) {
        throw new Error('Invalid asset selection');
      }
      
      const amountIn = BigInt(Math.floor(Number(amount) * Math.pow(10, fromAssetInfo.decimals)));
      const minOut = BigInt(Math.floor(Number(minAmountOut) * Math.pow(10, toAssetInfo.decimals)));
      
      setStatus('Executing swap...');
      
      // Execute the swap
      const result = await swapTokensReal(
        fromAsset,
        toAsset,
        amountIn,
        minOut,
        deadline,
        wallet.publicKey!
      );
      
      const resultAmount = Number(result) / Math.pow(10, toAssetInfo.decimals);
      setStatus(`Swap successful! Received: ${resultAmount.toFixed(6)} ${toAssetInfo.symbol}`);
      
      // Clear form after successful swap
      setTimeout(() => {
        setAmount('');
        setEstimatedOutput('');
        setMinAmountOut('');
        setPriceImpact('');
        setStatus('');
      }, 5000);
      
    } catch (e: any) {
      setError(e.message || 'Swap failed');
    } finally {
      setLoading(false);
    }
  };

  // Handle max amount (placeholder - would need balance check)
  const handleMaxAmount = () => {
    // This would typically fetch the user's balance for the selected asset
    setAmount('1000'); // Placeholder max amount
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-6 text-center">Swap Tokens</h2>
      
      {/* From Asset */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From</label>
          <button 
            onClick={handleMaxAmount}
            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Max
          </button>
        </div>
        <div className="flex space-x-2">
          <select
            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 text-sm"
            value={fromAsset}
            onChange={e => setFromAsset(e.target.value)}
          >
            {assets.map(asset => (
              <option key={asset.address} value={asset.address}>
                {asset.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 text-sm"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.0"
            min="0"
            step="any"
          />
        </div>
      </div>

      {/* Swap Button */}
      <div className="flex justify-center mb-4">
        <button
          onClick={swapAssets}
          className="p-2 rounded-full bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
          disabled={loading}
        >
          <ArrowUpDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* To Asset */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">To</label>
        <div className="flex space-x-2">
          <select
            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 text-sm"
            value={toAsset}
            onChange={e => setToAsset(e.target.value)}
          >
            {assets.map(asset => (
              <option key={asset.address} value={asset.address}>
                {asset.symbol}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="flex-1 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 text-sm"
            value={estimatedOutput}
            readOnly
            placeholder="0.0"
          />
        </div>
      </div>

      {/* Slippage Settings */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Slippage Tolerance (%)
        </label>
        <div className="flex space-x-2">
          {['0.5', '1.0', '2.0'].map(preset => (
            <button
              key={preset}
              onClick={() => setSlippage(preset)}
              className={`px-3 py-1 rounded text-sm ${
                slippage === preset
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {preset}%
            </button>
          ))}
          <input
            type="number"
            className="flex-1 p-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-zinc-800 text-sm text-center"
            value={slippage}
            onChange={e => setSlippage(e.target.value)}
            min="0"
            max="50"
            step="0.1"
          />
        </div>
      </div>

      {/* Swap Details */}
      {amount && estimatedOutput && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400">Exchange Rate:</span>
            <span className="text-gray-900 dark:text-gray-100">{exchangeRate}</span>
          </div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-600 dark:text-gray-400">Min. Received:</span>
            <span className="text-gray-900 dark:text-gray-100">
              {minAmountOut} {getAssetByAddress(toAsset)?.symbol}
            </span>
          </div>
          {priceImpact && (
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Price Impact:</span>
              <span className={`${
                Number(priceImpact) > 5 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'
              }`}>
                {priceImpact}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Swap Button */}
      <button
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        onClick={handleSwap}
        disabled={loading || !amount || !estimatedOutput}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Swapping...</span>
          </>
        ) : (
          <span>Swap</span>
        )}
      </button>

      {/* Status Messages */}
      {status && (
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-300 text-sm">{status}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-300 text-sm">{error}</span>
        </div>
      )}
    </div>
  );
} 