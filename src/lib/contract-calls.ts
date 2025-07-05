// Simplified contract calls for Blendifi
import { 
  signTransaction, 
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

// Network configuration
const TESTNET_SOROBAN_SERVER = new SorobanRpc.Server('https://soroban-testnet.stellar.org');
const MAINNET_SOROBAN_SERVER = new SorobanRpc.Server('https://soroban.stellar.org');

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
    
    // Submit to network using raw XDR
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
    
    // Submit to network using raw XDR
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
    
    // Submit to network using raw XDR
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
    
    // Submit to network using raw XDR
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
    
    // Submit to network using raw XDR
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
    
    // Submit to network using raw XDR
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

export async function getUserStakingInfo(userAddress: string): Promise<{
  stakedAmount: bigint;
  pendingRewards: bigint;
  lastRewardUpdate: number;
}> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer, networkPassphrase } = getServerAndNetwork(networkResult.network);
    const contract = new Contract(DEFI_HUB_CONTRACT_ID);

    // Get account for simulation
    const sourceAccount = await sorobanServer.getAccount(userAddress);

    // Build transaction to call get_user_position
    const transaction = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_user_position',
          nativeToScVal(userAddress, { type: 'address' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate the transaction
    const sim = await sorobanServer.simulateTransaction(transaction);
    
    if (SorobanRpc.Api.isSimulationError(sim)) {
      console.error('Get user staking info simulation error:', sim.error);
      return {
        stakedAmount: 0n,
        pendingRewards: 0n,
        lastRewardUpdate: Date.now()
      };
    }

    if (sim.result && sim.result.retval) {
      const position = scValToNative(sim.result.retval);
      return {
        stakedAmount: position.staked_blend || 0n,
        pendingRewards: position.rewards_earned || 0n,
        lastRewardUpdate: position.last_reward_update || Date.now()
      };
    }

    return {
      stakedAmount: 0n,
      pendingRewards: 0n,
      lastRewardUpdate: Date.now()
    };
  } catch (error) {
    console.error('Failed to get user staking info:', error);
    return {
      stakedAmount: 0n,
      pendingRewards: 0n,
      lastRewardUpdate: Date.now()
    };
  }
}

export async function executeTransaction(transactionXdr: string): Promise<any> {
  try {
    const networkResult = await getNetwork();
    if (networkResult.error) {
      throw new Error('Failed to get network');
    }
    
    const { sorobanServer } = getServerAndNetwork(networkResult.network);
    
    // Submit the transaction using raw XDR
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