
import { useState, useEffect } from 'react'
import {
  StellarWalletsKit,
  WalletNetwork,
  XBULL_ID,
  ISupportedWallet
} from '@creit.tech/stellar-wallets-kit';

import {
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from '@creit.tech/stellar-wallets-kit/modules/walletconnect.module';

import { 
  xBullModule, 
  FreighterModule, 
  AlbedoModule 
} from '@creit.tech/stellar-wallets-kit';

// Singleton instance - create only once
let stellarWalletKit: StellarWalletsKit | null = null;

// Configuration
const WALLET_CONFIG = {
  network: WalletNetwork.TESTNET, // Change to WalletNetwork.PUBLIC for mainnet
  selectedWalletId: XBULL_ID, // This is just the DEFAULT - users can still choose any wallet
};

// Initialize the wallet kit (call this once when your app starts)
function initializeWalletKit(): StellarWalletsKit {
  if (stellarWalletKit) {
    return stellarWalletKit;
  }

  stellarWalletKit = new StellarWalletsKit({
    network: WALLET_CONFIG.network,
    selectedWalletId: WALLET_CONFIG.selectedWalletId,
    modules: [
      new xBullModule(),
      new FreighterModule(),
      new AlbedoModule(),
      new WalletConnectModule({
        url: 'https://yoursite.com', // Replace with your site URL
        projectId: 'your-walletconnect-project-id', // Get from WalletConnect dashboard
        method: WalletConnectAllowedMethods.SIGN,
        description: 'Connect your Stellar wallet to interact with our dApp',
        name: 'Your DApp Name',
        icons: ['https://yoursite.com/logo.png'], // Your app logo
        network: WALLET_CONFIG.network,
      }),
    ],
  });

  return stellarWalletKit;
}

// Connect wallet function
async function connectWallet(): Promise<{
  address: string;
  walletId: string;
}> {
  const kit = initializeWalletKit();
  
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option: ISupportedWallet) => {
        try {
          // Set the selected wallet
          kit.setWallet(option.id);
          
          // Get the wallet address
          const { address } = await kit.getAddress();
          
          console.log('Wallet connected:', {
            walletId: option.id,
            address: address,
            walletName: option.name
          });

          resolve({
            address,
            walletId: option.id
          });
        } catch (error) {
          console.error('Error connecting wallet:', error);
          reject(error);
        }
      },
      onClosed: (err: Error) => {
        if (err) {
          console.error('Modal closed with error:', err);
          reject(err);
        } else {
          reject(new Error('Modal closed without wallet selection'));
        }
      },
      modalTitle: 'Connect Your Stellar Wallet',
      notAvailableText: 'This wallet is not available on your device'
    });
  });
}

// Get current wallet address (if already connected)
async function getCurrentWalletAddress(): Promise<string | null> {
  if (!stellarWalletKit) {
    return null;
  }
  
  try {
    const { address } = await stellarWalletKit.getAddress();
    return address;
  } catch (error) {
    console.error('Error getting wallet address:', error);
    return null;
  }
}

// Sign transaction
async function signTransaction(
  txXdr: string, 
  address: string,
  networkPassphrase: string = WalletNetwork.TESTNET
): Promise<string> {
  if (!stellarWalletKit) {
    throw new Error('Wallet kit not initialized');
  }

  try {
    const { signedTxXdr } = await stellarWalletKit.signTransaction(txXdr, {
      address,
      networkPassphrase
    });
    
    return signedTxXdr;
  } catch (error) {
    console.error('Error signing transaction:', error);
    throw error;
  }
}

// Disconnect wallet
function disconnectWallet(): void {
  if (stellarWalletKit) {
    stellarWalletKit.setWallet('');
  }
}

// Check if wallet is connected
async function isWalletConnected(): Promise<boolean> {
  try {
    const address = await getCurrentWalletAddress();
    return address !== null;
  } catch {
    return false;
  }
}

// Usage example in your component/app
async function handleConnectWallet() {
  try {
    const { address, walletId } = await connectWallet();
    
    // Store wallet info in your state management
    console.log('Connected wallet:', { address, walletId });
    
    // Now you can use the address for your business logic
    // - Call smart contracts
    // - Create deposits
    // - Handle payments
    
    return { address, walletId };
  } catch (error) {
    console.error('Failed to connect wallet:', error);
    throw error;
  }
}

// Example: Your deposit function
async function handleDeposit(amount: string, address: string) {
  try {
    // Your deposit logic here
    // 1. Create transaction XDR
    // 2. Sign it using signTransaction()
    // 3. Submit to network
    
    console.log(`Depositing ${amount} from ${address}`);
    
    // Example transaction signing:
    // const txXdr = createDepositTransaction(amount, address);
    // const signedTx = await signTransaction(txXdr, address);
    // const result = await submitTransaction(signedTx);
    
  } catch (error) {
    console.error('Deposit failed:', error);
    throw error;
  }
}

// Example: Smart contract call
async function callSmartContract(
  contractAddress: string, 
  method: string, 
  params: (string | number | boolean)[], 
  userAddress: string
) {
  try {
    // Your smart contract logic here
    // 1. Build contract invocation XDR
    // 2. Sign it
    // 3. Submit
    
    console.log(`Calling contract ${contractAddress}.${method} for user ${userAddress}`, params);
    
    // const contractTxXdr = buildContractTransaction(contractAddress, method, params, userAddress);
    // const signedTx = await signTransaction(contractTxXdr, userAddress);
    // const result = await submitTransaction(signedTx);
    
  } catch (error) {
    console.error('Smart contract call failed:', error);
    throw error;
  }
}

// MAIN BUTTON COMPONENT
export default function RootWalletButton() {
  const [isConnected, setIsConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if wallet is already connected on component mount
  useEffect(() => {
    const checkWalletConnection = async () => {
      try {
        const connected = await isWalletConnected()
        setIsConnected(connected)
        
        if (connected) {
          const address = await getCurrentWalletAddress()
          setWalletAddress(address)
          
          // Try to get wallet ID from localStorage
          const storedWalletId = localStorage.getItem('walletId')
          setWalletId(storedWalletId)
        }
      } catch (error) {
        console.error('Error checking wallet connection:', error)
        setError('Failed to check wallet connection')
      }
    }

    checkWalletConnection()
  }, [])

  const handleClick = async () => {
    if (isConnected) {
      // Disconnect wallet
      disconnectWallet()
      setIsConnected(false)
      setWalletAddress(null)
      setWalletId(null)
      setError(null)
      
      // Clear from localStorage
      localStorage.removeItem('walletAddress')
      localStorage.removeItem('walletId')
      
      console.log('Wallet disconnected')
    } else {
      // Connect wallet
      setIsConnecting(true)
      setError(null)
      
      try {
        const { address, walletId: connectedWalletId } = await handleConnectWallet()
        
        setIsConnected(true)
        setWalletAddress(address)
        setWalletId(connectedWalletId)
        
        // Store in localStorage for persistence
        localStorage.setItem('walletAddress', address)
        localStorage.setItem('walletId', connectedWalletId)
        
        console.log('Wallet connected successfully:', { address, walletId: connectedWalletId })
        
        // Optional: You can call additional functions here after successful connection
        // For example:
        // await checkWalletBalance(address)
        // await loadUserData(address)
        
      } catch (error) {
        console.error('Failed to connect wallet:', error)
        setError(error instanceof Error ? error.message : 'Failed to connect wallet')
      } finally {
        setIsConnecting(false)
      }
    }
  }

  // Helper function to get button text
  const getButtonText = () => {
    if (isConnecting) return 'Connecting...'
    if (isConnected && walletAddress) {
      // Show shortened address like "GA7X...Y2Z3"
      return `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    }
    return 'Connect Wallet'
  }

  // Helper function to get button title (tooltip)
  const getButtonTitle = () => {
    if (isConnected && walletAddress) {
      return `Connected: ${walletAddress} (${walletId || 'Unknown wallet'})`
    }
    return 'Connect your Stellar wallet'
  }

  // Example functions you can call after wallet connection
  const handleDepositExample = async () => {
    if (!walletAddress) return
    
    try {
      await handleDeposit('100', walletAddress)
      console.log('Deposit successful')
    } catch (error) {
      console.error('Deposit failed:', error)
    }
  }

  const handleSmartContractExample = async () => {
    if (!walletAddress) return
    
    try {
      await callSmartContract(
        'CONTRACT_ADDRESS_HERE',
        'methodName',
        ['param1', 'param2'],
        walletAddress
      )
      console.log('Smart contract call successful')
    } catch (error) {
      console.error('Smart contract call failed:', error)
    }
  }

  // Example of how to use signTransaction
  const handleSignTransactionExample = async () => {
    if (!walletAddress) return
    
    try {
      const txXdr = 'YOUR_TRANSACTION_XDR_HERE' // Replace with actual transaction XDR
      const signedTx = await signTransaction(txXdr, walletAddress)
      console.log('Transaction signed:', signedTx)
    } catch (error) {
      console.error('Transaction signing failed:', error)
    }
  }


  // Remove Freighter-specific check and UI

  if (isConnected) {
    return (
      <div className="flex items-center gap-4">
        <div className="wallet-status wallet-connected flex items-center gap-2">
          <span role="img" aria-label="connected">✅</span>
          {walletInfo && walletInfo.icon && (
            <img src={walletInfo.icon} alt={walletInfo.name} className="w-6 h-6 rounded-full border" />
          )}
          {walletInfo && walletInfo.name && (
            <span className="font-medium text-sm">{walletInfo.name}</span>
          )}
          <span>{formatAddress(publicKey)}</span>
          <span className="text-sm">({network})</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="btn btn-sm btn-secondary"
          disabled={isLoading}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <div className="wallet-status wallet-disconnected">
        <span role="img" aria-label="not connected">🔌</span>
        <span>Not connected</span>
      </div>
      <button
        onClick={handleConnect}
        className="btn btn-sm btn-primary"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="spinner"></div>
            Connecting...
          </>
        ) : (
          'Connect Stellar Wallet'
        )}
      </button>
      {error && (
        <div className="text-error text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default WalletConnect; 
