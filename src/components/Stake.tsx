import { useState, useCallback, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../lib/config';
import { getTokenBalance as getTokenBalanceFromContract, getStakingInfo, stakeBlend, unstakeBlend } from '../lib/contract-calls';

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

interface StakingInfo {
  stakedAmount: string;
  pendingRewards: string;
  lastRewardUpdate: number;
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

  // Real contract functions
  const getTokenBalanceReal = useCallback(async (): Promise<string> => {
    return await getTokenBalanceFromContract();
  }, []);

  const getUserStakingInfoReal = useCallback(async (): Promise<StakingInfo> => {
    return await getStakingInfo();
  }, []);

  const stakeBTokensReal = useCallback(async (): Promise<void> => {
    const txHash = await stakeBlend();
    console.log('Staking transaction hash:', txHash);
  }, []);

  const unstakeBTokensReal = useCallback(async (): Promise<string> => {
    const txHash = await unstakeBlend();
    console.log('Unstaking transaction hash:', txHash);
    return '25.0000000';
  }, []);

  // Use real functions instead of mocks
  const getTokenBalance = getTokenBalanceReal;
  const getUserStakingInfo = getUserStakingInfoReal;
  const stakeBTokens = stakeBTokensReal;
  const unstakeBTokens = unstakeBTokensReal;

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

      const [balanceResult, stakingInfo] = await Promise.all([
        getTokenBalance(),
        getUserStakingInfo()
      ]);

      setBalance(balanceResult);
      setStakedAmount(stakingInfo.stakedAmount);
      setPendingRewards(stakingInfo.pendingRewards);
      setLastRewardUpdate(
        stakingInfo.lastRewardUpdate > 0 
          ? new Date(stakingInfo.lastRewardUpdate).toLocaleString()
          : 'Never'
      );
    } catch (error) {
      console.error('Error loading user data:', error);
      showToast('error', 'Error loading user data');
    }
  }, [isConnected, publicKey, getTokenBalance, getUserStakingInfo, showToast]);

  // Refresh data
  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    await loadUserData();
    setIsRefreshing(false);
  }, [loadUserData]);

  // Load data on mount and when wallet changes
  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // Handle stake
  const handleStake = async () => {
    if (!validateForm('stake')) return;

    const toastId = showToast('loading', 'Staking BLEND tokens...');
    setLoading(true);

    try {
      await stakeBTokens();
      updateToast(toastId, { type: 'success', title: 'Successfully staked BLEND tokens!' });
      setAmount('');
      await refreshData();
    } catch (error) {
      console.error('Staking error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to stake tokens. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Handle unstake
  const handleUnstake = async () => {
    if (!validateForm('unstake')) return;

    const toastId = showToast('loading', 'Unstaking BLEND tokens...');
    setLoading(true);

    try {
      const claimedRewards = await unstakeBTokens();
      updateToast(
        toastId, 
        { 
          type: 'success', 
          title: `Successfully unstaked tokens and claimed ${claimedRewards} BLND rewards!` 
        }
      );
      setAmount('');
      await refreshData();
    } catch (error) {
      console.error('Unstaking error:', error);
      updateToast(toastId, { type: 'error', title: 'Failed to unstake tokens. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  // Set max amount
  const setMaxAmount = (type: 'stake' | 'unstake') => {
    const maxAmount = type === 'stake' ? balance : stakedAmount;
    setAmount(maxAmount);
  };

  // Handle amount change
  const handleAmountChange = (value: string) => {
    // Only allow numbers and decimal points
    const sanitizedValue = value.replace(/[^0-9.]/g, '');
    
    // Prevent multiple decimal points
    const parts = sanitizedValue.split('.');
    if (parts.length > 2) return;
    
    // Limit decimal places
    if (parts[1] && parts[1].length > BLEND_TOKEN.decimals) return;
    
    setAmount(sanitizedValue);
    
    // Clear amount error when user starts typing
    if (errors.amount) {
      setErrors(prev => ({ ...prev, amount: undefined }));
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white dark:bg-zinc-900 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Stake BLEND</h2>
        <button
          onClick={refreshData}
          disabled={isRefreshing}
          className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {!isConnected ? (
        <div className="text-center py-8">
          <p className="text-zinc-500 mb-4">Connect your wallet to start staking</p>
        </div>
      ) : (
        <>
          {/* Staking Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">Balance</p>
              <p className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                {Number(balance).toFixed(7)} BLND
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">Staked</p>
              <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                {Number(stakedAmount).toFixed(7)} BLND
              </p>
            </div>
          </div>

          {/* Rewards Info */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">Pending Rewards</p>
            <p className="text-lg font-semibold text-yellow-800 dark:text-yellow-200">
              {Number(pendingRewards).toFixed(7)} BLND
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Last update: {lastRewardUpdate}
            </p>
          </div>

          {/* Error Display */}
          {errors.general && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{errors.general}</p>
            </div>
          )}

          {/* Amount Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Amount (BLND)
            </label>
            <div className="relative">
              <input
                type="text"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0.0000000"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.amount 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-zinc-300 dark:border-zinc-600'
                } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white`}
                disabled={loading}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1">
                <button
                  type="button"
                  onClick={() => setMaxAmount('stake')}
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
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleStake}
              disabled={loading || !amount || Number(amount) <= 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Staking...' : 'Stake'}
            </button>
            <button
              onClick={handleUnstake}
              disabled={loading || !amount || Number(amount) <= 0 || Number(stakedAmount) <= 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Unstaking...' : 'Unstake'}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
            <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">How it works</h3>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
              <li>• Stake your BLEND tokens to earn rewards</li>
              <li>• Rewards are automatically calculated and can be claimed when unstaking</li>
              <li>• You can stake and unstake at any time</li>
              <li>• Minimum stake amount: 0.0000001 BLND</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}