import { useState, useEffect, useCallback } from 'react';
import { CONFIG } from '../lib/config';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { 
  stakeBTokens, 
  unstakeBTokens,
  getUserStakingInfo
} from '../lib/contract-calls';
import { getTokenBalance } from '../lib/stellar-utils';

// BLEND token configuration
const BLEND_TOKEN = CONFIG.SUPPORTED_ASSETS.find(asset => asset.symbol === 'BLND') || {
  address: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
  symbol: 'BLND',
  decimals: 7
};

interface FormErrors {
  amount?: string;
  general?: string;
}

export default function Stake() {
  const { publicKey, isConnected } = useWallet();
  const { showToast, updateToast } = useToast();
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<string>('0');
  const [stakedAmount, setStakedAmount] = useState<string>('0');
  const [pendingRewards, setPendingRewards] = useState<string>('0');
  const [lastRewardUpdate, setLastRewardUpdate] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Validation functions
  const validateAmount = useCallback((value: string, type: 'stake' | 'unstake'): string | undefined => {
    if (!value || value.trim() === '') {
      return 'Amount is required';
    }
    
    const numValue = Number(value);
    if (isNaN(numValue) || numValue <= 0) {
      return 'Amount must be greater than 0';
    }
    
    if (numValue <= 0.0000001) {
      return 'Amount too small (minimum 0.0000001 BLEND)';
    }
    
    const maxAmount = type === 'stake' ? Number(balance) : Number(stakedAmount);
    if (numValue > maxAmount) {
      return `Insufficient ${type === 'stake' ? 'balance' : 'staked amount'}`;
    }
    
    return undefined;
  }, [balance, stakedAmount]);

  const validateForm = useCallback((type: 'stake' | 'unstake'): boolean => {
    const newErrors: FormErrors = {};
    
    if (!isConnected || !publicKey) {
      newErrors.general = 'Please connect your Freighter wallet';
    } else {
      const amountError = validateAmount(amount, type);
      if (amountError) {
        newErrors.amount = amountError;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [isConnected, publicKey, amount, validateAmount]);

  // Load user's BLEND balance and staking info
  const loadUserData = useCallback(async () => {
    try {
      if (!isConnected || !publicKey) {
        setBalance('0');
        setStakedAmount('0');
        setPendingRewards('0');
        setLastRewardUpdate('Never');
        return;
      }

      setIsRefreshing(true);

      // Get BLEND balance
      const blendBalance = await getTokenBalance(BLEND_TOKEN.address, publicKey);
      const formattedBalance = (Number(blendBalance) / Math.pow(10, BLEND_TOKEN.decimals)).toFixed(7);
      setBalance(formattedBalance);

      // Get staking info
      const stakingInfo = await getUserStakingInfo(publicKey);
      const formattedStaked = (Number(stakingInfo.stakedAmount) / Math.pow(10, BLEND_TOKEN.decimals)).toFixed(7);
      const formattedRewards = (Number(stakingInfo.pendingRewards) / Math.pow(10, BLEND_TOKEN.decimals)).toFixed(7);
      
      setStakedAmount(formattedStaked);
      setPendingRewards(formattedRewards);
      
      // Format last reward update time
      if (stakingInfo.lastRewardUpdate > 0) {
        const date = new Date(stakingInfo.lastRewardUpdate * 1000);
        setLastRewardUpdate(date.toLocaleDateString());
      } else {
        setLastRewardUpdate('Never');
      }
    } catch (e) {
      console.error('Failed to load user data:', e);
      // Use placeholder values on error
      setBalance('0');
      setStakedAmount('0');
      setPendingRewards('0');
      setLastRewardUpdate('Never');
    } finally {
      setIsRefreshing(false);
    }
  }, [isConnected, publicKey]);

  // Load data on component mount and when wallet changes
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Reset form after successful transaction
  const resetForm = useCallback(() => {
    setAmount('');
    setErrors({});
  }, []);

  const handleStake = async () => {
    if (!validateForm('stake')) {
      return;
    }

    setLoading(true);
    const toastId = showToast(
      'loading',
      'Staking BLEND tokens...',
      'Please wait while your transaction is being processed'
    );

    try {
      const numericAmount = Number(amount);
      const contractAmount = BigInt(Math.floor(numericAmount * Math.pow(10, BLEND_TOKEN.decimals)));
      
      // Call the stake_blend function on the smart contract
      await stakeBTokens(contractAmount, publicKey!);
      
      // Update toast to success
      updateToast(toastId, {
        type: 'success',
        title: 'Staking Successful!',
        message: `${amount} BLEND tokens have been staked successfully`,
        duration: 5000
      });
      
      resetForm();
      
      // Reload user data after successful stake
      await loadUserData();
      
    } catch (e: any) {
      console.error('Staking error:', e);
      
      // Update toast to error
      updateToast(toastId, {
        type: 'error',
        title: 'Staking Failed',
        message: e.message || 'Failed to stake BLEND tokens',
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnstake = async () => {
    if (!validateForm('unstake')) {
      return;
    }

    setLoading(true);
    const toastId = showToast(
      'loading',
      'Unstaking BLEND tokens...',
      'Please wait while your transaction is being processed'
    );

    try {
      const numericAmount = Number(amount);
      const contractAmount = BigInt(Math.floor(numericAmount * Math.pow(10, BLEND_TOKEN.decimals)));
      
      // Call the unstake_blend function
      const rewards = await unstakeBTokens(contractAmount, publicKey!);
      
      const formattedRewards = (Number(rewards) / Math.pow(10, BLEND_TOKEN.decimals)).toFixed(7);
      
      // Update toast to success
      updateToast(toastId, {
        type: 'success',
        title: 'Unstaking Successful!',
        message: `${amount} BLEND tokens unstaked. Rewards claimed: ${formattedRewards} BLEND`,
        duration: 5000
      });
      
      resetForm();
      
      // Reload user data after successful unstake
      await loadUserData();
      
    } catch (e: any) {
      console.error('Unstaking error:', e);
      
      // Update toast to error
      updateToast(toastId, {
        type: 'error',
        title: 'Unstaking Failed',
        message: e.message || 'Failed to unstake BLEND tokens',
        duration: 8000
      });
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = (type: 'stake' | 'unstake') => {
    const maxAmount = type === 'stake' ? balance : stakedAmount;
    setAmount(maxAmount);
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
      <h2 className="text-xl font-bold mb-4">Stake BLEND Tokens</h2>
      
      {/* Info Section */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200">
            Your BLEND Staking Info
          </h3>
          <button
            onClick={loadUserData}
            disabled={isRefreshing}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Available Balance:</span>
            <span className="font-mono">{balance} BLEND</span>
          </div>
          <div className="flex justify-between">
            <span>Staked Amount:</span>
            <span className="font-mono">{stakedAmount} BLEND</span>
          </div>
          <div className="flex justify-between">
            <span>Pending Rewards:</span>
            <span className="font-mono text-green-600">{pendingRewards} BLEND</span>
          </div>
          <div className="flex justify-between">
            <span>Last Reward Update:</span>
            <span className="font-mono text-gray-600">{lastRewardUpdate}</span>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {errors.general && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-800 dark:text-red-200 text-sm">{errors.general}</p>
        </div>
      )}

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Amount (BLEND)
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            placeholder="0.0"
            step="0.0000001"
            min="0.0000001"
            max={Math.max(Number(balance), Number(stakedAmount))}
            className={`
              w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              dark:bg-zinc-800 dark:border-zinc-700 dark:text-white
              ${errors.amount ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-zinc-600'}
            `}
            disabled={loading || !isConnected}
          />
          <div className="absolute right-2 top-2 space-x-1">
            <button
              type="button"
              onClick={() => setMaxAmount('stake')}
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

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleStake}
          disabled={loading || !isConnected || !amount || Number(amount) <= 0}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Staking...' : 'Stake BLEND'}
        </button>
        
        <button
          onClick={handleUnstake}
          disabled={loading || !isConnected || !amount || Number(amount) <= 0 || Number(stakedAmount) <= 0}
          className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Unstaking...' : 'Unstake BLEND'}
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        <p>• Minimum stake amount: 0.0000001 BLEND</p>
        <p>• Unstaking will also claim your accumulated rewards</p>
        <p>• Rewards are distributed based on your staked amount and time</p>
      </div>
    </div>
  );
} 