// Simplified Stellar/Soroban utilities for Blendifi
import { 
  isConnected as isFreighterConnected, 
  signTransaction, 
  getAddress, 
  getNetwork
} from '@stellar/freighter-api';
import {
  SorobanRpc,
  TransactionBuilder,
  Networks,
  Contract,
  nativeToScVal,
  scValToNative,
  BASE_FEE
} from '@stellar/stellar-sdk';

// Contract configuration
export const DEFI_HUB_CONTRACT_ID = 'CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH'; 
export const BLEND_POOL_ADDRESS = 'CCLBPEYS3XFK65MYYXSBMOGKUI4ODN5S7SUZBGD7NALUQF64QILLX5B5';

// Asset addresses from CONFIG
export const ASSET_ADDRESSES = {
  XLM: 'native',
  BLND: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY',
  USDC: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  wETH: 'GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH',
  wBTC: 'GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB'
};

// Network configuration
const TESTNET_SOROBAN_SERVER = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const MAINNET_SOROBAN_SERVER = new SorobanRpc.Server('https://soroban.stellar.org');

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
}

// Helper function to get the correct server and network passphrase
function getServerAndNetwork(network?: string) {
  const isMainnet = network === 'MAINNET' || network === 'PUBLIC';
  return {
    sorobanServer: isMainnet ? MAINNET_SOROBAN_SERVER : TESTNET_SOROBAN_SERVER,
    networkPassphrase: isMainnet ? Networks.PUBLIC : Networks.TESTNET
  };
}

// Check if Freighter is installed
export function isFreighterInstalled(): boolean {
  try {
    return typeof window !== 'undefined' && 'stellar' in window;
  } catch {
    return false;
  }
}

// Connect to Freighter wallet
export async function connectWallet(): Promise<WalletState> {
  try {
    console.log('Attempting to connect to Freighter...');
    
    if (!isFreighterInstalled()) {
      throw new Error('Freighter wallet is not installed. Please install it from https://www.freighter.app/');
    }

    const publicKeyResult = await getAddress();
    const networkResult = await getNetwork();
    
    if (publicKeyResult.error) {
      throw new Error(publicKeyResult.error.message || 'Failed to get public key');
    }
    
    if (networkResult.error) {
      throw new Error(networkResult.error.message || 'Failed to get network');
    }
    
    console.log('Successfully connected:', { publicKey: publicKeyResult.address, network: networkResult.network });
    
    return {
      isConnected: true,
      publicKey: publicKeyResult.address,
      network: networkResult.network
    };
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}

// Get current wallet state
export async function getWalletState(): Promise<WalletState> {
  try {
    if (!isFreighterInstalled()) {
      return { isConnected: false, publicKey: null, network: null };
    }

    const isConnected = await isFreighterConnected();
    
    if (isConnected) {
      const publicKeyResult = await getAddress();
      const networkResult = await getNetwork();
      
      if (!publicKeyResult.error && !networkResult.error) {
        return {
          isConnected: true,
          publicKey: publicKeyResult.address,
          network: networkResult.network
        };
      }
    }
  } catch (error) {
    console.error('Failed to get wallet state:', error);
  }
  
  return { isConnected: false, publicKey: null, network: null };
}

// Sign transaction using Freighter
export async function signAndSubmitTransaction(transactionXdr: string, networkPassphrase?: string): Promise<string> {
  try {
    if (!isFreighterInstalled()) {
      throw new Error('Freighter wallet is not installed');
    }

    console.log('Signing transaction with Freighter...');
    
    const result = await signTransaction(transactionXdr, {
      networkPassphrase: networkPassphrase || undefined
    });
    
    if (result.error) {
      throw new Error(result.error.message || 'Transaction signing failed');
    }
    
    console.log('Transaction signed successfully');
    return result.signedTxXdr;
  } catch (error) {
    console.error('Failed to sign transaction:', error);
    throw error;
  }
}

// Wait for transaction confirmation
export async function waitForTransaction(sorobanServer: SorobanRpc.Server, transactionHash: string): Promise<void> {
  try {
    console.log('Waiting for transaction confirmation...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
      try {
        const response = await sorobanServer.getTransaction(transactionHash);
        if (response.status === 'SUCCESS') {
          console.log('Transaction confirmed successfully');
          return;
        } else if (response.status === 'FAILED') {
          throw new Error(`Transaction failed: ${response.resultMetaXdr}`);
        }
      } catch (error) {
        // Transaction might not be available yet, continue waiting
        console.log(`Transaction not ready yet, attempt ${attempts + 1}/${maxAttempts}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      attempts++;
    }
    
    throw new Error('Transaction confirmation timeout');
  } catch (error) {
    console.error('Failed to wait for transaction:', error);
    throw error;
  }
}

// Get token balance for a user using Horizon for all assets
export async function getTokenBalance(tokenAddress: string, userAddress: string): Promise<bigint> {
  try {
    // Use Horizon for all assets
    const HORIZON_URL = 'https://horizon-testnet.stellar.org';
    const res = await fetch(`${HORIZON_URL}/accounts/${userAddress}`);
    if (!res.ok) return 0n;
    const data = await res.json();
    if (tokenAddress === 'native') {
      // XLM
      const xlm = data.balances.find((b: any) => b.asset_type === 'native');
      return xlm ? BigInt(Math.floor(Number(xlm.balance) * 1e7)) : 0n;
    } else {
      // Issued asset
      const asset = data.balances.find((b: any) => b.asset_code && b.asset_code === getAssetCode(tokenAddress));
      if (!asset) return 0n;
      // Use asset decimals from config
      const decimals = getAssetDecimals(tokenAddress);
      return BigInt(Math.floor(Number(asset.balance) * Math.pow(10, decimals)));
    }
  } catch (error) {
    console.error('Failed to get token balance:', error);
    return 0n;
  }
}

// Helper to map token address to asset code
function getAssetCode(tokenAddress: string): string {
  if (tokenAddress === ASSET_ADDRESSES.XLM) return 'XLM';
  if (tokenAddress === ASSET_ADDRESSES.BLND) return 'BLND';
  if (tokenAddress === ASSET_ADDRESSES.USDC) return 'USDC';
  if (tokenAddress === ASSET_ADDRESSES.wETH) return 'wETH';
  if (tokenAddress === ASSET_ADDRESSES.wBTC) return 'wBTC';
  return '';
}

// Get asset price using fixed prices
export async function getAssetPrice(assetAddress: string): Promise<string> {
  // Fixed prices for MVP - no oracle dependency
  const fixedPrices: { [key: string]: string } = {
    [ASSET_ADDRESSES.XLM]: '0.12',
    [ASSET_ADDRESSES.BLND]: '0.05',
    [ASSET_ADDRESSES.USDC]: '1.00',
    [ASSET_ADDRESSES.wETH]: '2500',
    [ASSET_ADDRESSES.wBTC]: '45000',
  };
  
  const price = fixedPrices[assetAddress] || '0';
  // Return price in wei format (18 decimals)
  return (Number(price) * 1e18).toString();
}

// Get asset decimals
export function getAssetDecimals(assetAddress: string): number {
  const assetMap: { [key: string]: number } = {
    [ASSET_ADDRESSES.XLM]: 7,
    [ASSET_ADDRESSES.BLND]: 7,
    [ASSET_ADDRESSES.USDC]: 6,
    [ASSET_ADDRESSES.wETH]: 18,
    [ASSET_ADDRESSES.wBTC]: 8
  };
  
  return assetMap[assetAddress] || 7;
}

// Convert human readable amount to contract amount
export function toContractAmount(humanAmount: string, assetAddress: string): bigint {
  const decimals = getAssetDecimals(assetAddress);
  const factor = BigInt(10 ** decimals);
  const amount = parseFloat(humanAmount);
  return BigInt(Math.floor(amount * Number(factor)));
}

// Convert contract amount to human readable
export function fromContractAmount(contractAmount: bigint, assetAddress: string): string {
  const decimals = getAssetDecimals(assetAddress);
  const factor = BigInt(10 ** decimals);
  return (Number(contractAmount) / Number(factor)).toString();
}

// Real contract functions using Soroban
export async function stakeBTokens(amount: bigint, userPublicKey: string): Promise<void> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call stake_blend
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'stake_blend',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(amount, { type: 'u128' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Staking simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Staking error:', error);
    throw error;
  }
}

export async function unstakeBTokens(amount: bigint, userPublicKey: string): Promise<bigint> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call unstake_blend
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'unstake_blend',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(amount, { type: 'u128' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Unstaking simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
      
      // Get the result from simulation (rewards claimed)
      if (sim.result && sim.result.retval) {
        return scValToNative(sim.result.retval);
      }
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
    
    return 0n;
  } catch (error) {
    console.error('Unstaking error:', error);
    throw error;
  }
}

export async function swapTokens(
  tokenA: string,
  tokenB: string,
  amountIn: bigint,
  minAmountOut: bigint,
  deadline: bigint,
  userPublicKey: string
): Promise<string> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call swap_tokens
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'swap_tokens',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(tokenA, { type: 'address' }),
          nativeToScVal(tokenB, { type: 'address' }),
          nativeToScVal(amountIn, { type: 'u128' }),
          nativeToScVal(minAmountOut, { type: 'u128' }),
          nativeToScVal(deadline, { type: 'u64' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Swap simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
      return result.hash;
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Swap error:', error);
    throw error;
  }
}

export async function supplyToBlend(
  asset: string,
  amount: bigint,
  asCollateral: boolean,
  userPublicKey: string
): Promise<string> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call supply_to_blend
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'supply_to_blend',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(asset, { type: 'address' }),
          nativeToScVal(amount, { type: 'u128' }),
          nativeToScVal(asCollateral, { type: 'bool' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Supply simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
      return result.hash;
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Supply error:', error);
    throw error;
  }
}

export async function borrowFromBlend(
  asset: string,
  amount: bigint,
  userPublicKey: string
): Promise<string> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call borrow_from_blend
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'borrow_from_blend',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(asset, { type: 'address' }),
          nativeToScVal(amount, { type: 'u128' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Borrow simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
      return result.hash;
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Borrow error:', error);
    throw error;
  }
}

export async function getUserPosition(userPublicKey: string): Promise<any> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for simulation
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call get_user_position
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_user_position',
          nativeToScVal(userPublicKey, { type: 'address' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      console.error('Get user position simulation error:', sim.error);
      return {
        supplied: {},
        borrowed: {},
        healthFactor: 1.5
      };
    }

    if (sim.result && sim.result.retval) {
      return scValToNative(sim.result.retval);
    }

    return {
      supplied: {},
      borrowed: {},
      healthFactor: 1.5
    };
  } catch (error) {
    console.error('Failed to get user position:', error);
    return {
      supplied: {},
      borrowed: {},
      healthFactor: 1.5
    };
  }
}

export async function getHealthStatus(userPublicKey: string): Promise<number> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for simulation
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call get_health_status
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_health_status',
          nativeToScVal(userPublicKey, { type: 'address' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      console.error('Get health status simulation error:', sim.error);
      return 1.5;
    }

    if (sim.result && sim.result.retval) {
      const healthStatus = scValToNative(sim.result.retval);
      // Convert enum to number (0=Healthy, 1=Warning, 2=Critical, 3=Liquidatable)
      return Number(healthStatus);
    }

    return 1.5;
  } catch (error) {
    console.error('Failed to get health status:', error);
    return 1.5;
  }
}

export async function setLiquidationProtection(
  enabled: boolean,
  userPublicKey: string
): Promise<void> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for transaction
    const sourceAccount = await sorobanServer.getAccount(userPublicKey);

    // Build transaction to call set_liquidation_protection
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'set_liquidation_protection',
          nativeToScVal(userPublicKey, { type: 'address' }),
          nativeToScVal(enabled, { type: 'bool' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      throw new Error(`Set liquidation protection simulation failed: ${sim.error}`);
    }

    // Sign and submit transaction
    const signedXdr = await signAndSubmitTransaction(transaction.toXDR(), networkPassphrase);
    
    // Submit to network
    const result = await sorobanServer.sendTransaction(signedXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Set liquidation protection error:', error);
    throw error;
  }
}

export async function getLiquidationProtectionStatus(_userAddress: string): Promise<boolean> {
  // This would require a view function in the contract
  // For now, return false as placeholder
  return false;
}

export async function executeTransaction(transactionXdr: string): Promise<any> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer } = getServerAndNetwork(networkResult.network);
    
    // Submit the transaction
    const result = await sorobanServer.sendTransaction(transactionXdr as any);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      await waitForTransaction(sorobanServer, result.hash);
      return { success: true, hash: result.hash };
    } else {
      throw new Error(`Transaction failed: ${result.status}`);
    }
  } catch (error) {
    console.error('Execute transaction error:', error);
    throw error;
  }
} 