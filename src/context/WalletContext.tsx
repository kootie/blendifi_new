import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  ISupportedWallet
} from '@creit.tech/stellar-wallets-kit';
import * as SorobanClient from 'soroban-client';
import { CONFIG } from '../lib/config';
import { useToast } from './ToastContext';

const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface FreighterKit {
  server: any;
  networkPassphrase: string;
  horizonUrl: string;
}

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isLoading: boolean;
  error: string | null;
  kit: any; // Updated to any for kit instance
  walletId: string | null; // Add walletId to track selected wallet
  walletInfo?: ISupportedWallet | null; // Store full wallet info
}

interface WalletContextType extends WalletState {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  signTransaction: (transaction: any, options?: any) => Promise<string>;
  getAddress: () => Promise<string>;
  getNetworkDetails: () => Promise<any>;
  addToken: (contractId: string, networkPassphrase: string) => Promise<string>;
  checkConnection: () => Promise<boolean>;
  refreshConnection: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

// Add kit instance outside component to avoid re-instantiation
const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  modules: allowAllModules(),
});

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    network: null,
    networkPassphrase: null,
    isLoading: false,
    error: null,
    kit: kit,
    walletId: null,
    walletInfo: null,
  });

  const { showToast } = useToast();

  const connect = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      await kit.openModal({
        onWalletSelected: async (option: ISupportedWallet) => {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          setState(prev => ({
            ...prev,
            isConnected: true,
            publicKey: address,
            network: 'TESTNET',
            networkPassphrase: 'Test SDF Network ; September 2015',
            isLoading: false,
            error: null,
            walletId: option.id,
            walletInfo: option, // Store full wallet info
          }));
          showToast('success', 'Wallet Connected', {
            message: `Connected to ${option.name || 'wallet'}: ${address.slice(0, 6)}...${address.slice(-4)}`,
          });
        },
        onClosed: (err: any) => {
          setState(prev => ({ ...prev, isLoading: false, error: err ? err.message : null }));
          if (err) {
            showToast('error', 'Wallet Connection Cancelled', {
              message: err.message,
            });
          } else {
            showToast('info', 'Wallet Connection Cancelled', {
              message: 'No wallet was selected.',
            });
          }
        },
        modalTitle: 'Select a Stellar Wallet',
      });
      return true;
    } catch (err: any) {
      setState(prev => ({ ...prev, isLoading: false, error: err.message || 'Failed to connect to wallet' }));
      showToast('error', 'Wallet Connection Error', {
        message: err.message || 'Failed to connect to wallet',
      });
      return false;
    }
  }, [showToast]);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
      isLoading: false,
      error: null,
      kit: kit,
      walletId: null,
      walletInfo: null,
    });
    showToast('info', 'Wallet Disconnected', {
      message: 'You have disconnected your wallet.',
    });
  }, [showToast]);

  // Update signTransaction, getAddress, getNetworkDetails, addToken to use kit methods if available
  const signTransactionCb = useCallback(async (transaction: any, options: any = {}): Promise<string> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    if (!kit) throw new Error('Wallet kit not initialized');
    // Use kit's signTransaction if available, otherwise throw
    if (typeof kit.signTransaction === 'function') {
      return await kit.signTransaction(transaction, options);
    }
    throw new Error('signTransaction not supported by selected wallet');
  }, [state.isConnected]);

  const getAddressCb = useCallback(async (): Promise<string> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    if (!kit) throw new Error('Wallet kit not initialized');
    const { address } = await kit.getAddress();
    return address;
  }, [state.isConnected]);

  const getNetworkDetailsCb = useCallback(async (): Promise<any> => {
    // If kit exposes network details, use them; otherwise return defaults
    return {
      network: 'TESTNET',
      networkPassphrase: 'Test SDF Network ; September 2015',
    };
  }, []);

  const addTokenCb = useCallback(async (contractId: string, networkPassphrase: string): Promise<string> => {
    // If kit exposes addToken, use it; otherwise throw
    if (typeof kit.addToken === 'function') {
      return await kit.addToken(contractId, networkPassphrase);
    }
    throw new Error('addToken not supported by selected wallet');
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    // refreshConnection(); // No longer needed
  }, []);

  // Set up Soroban kit when connected
  useEffect(() => {
    if (state.isConnected && state.publicKey && state.network) {
      const server = new SorobanClient.Server(SOROBAN_RPC, { allowHttp: true });
      setState(prev => ({
        ...prev,
        kit: {
          server,
          networkPassphrase: NETWORK_PASSPHRASE,
          horizonUrl: CONFIG.RPC_URL,
        },
      }));
    } else {
      setState(prev => ({ ...prev, kit: null }));
    }
  }, [state.isConnected, state.publicKey, state.network]);

  // Set up periodic connection check
  useEffect(() => {
    const interval = setInterval(() => {
      if (state.isConnected) {
        // refreshConnection(); // No longer needed
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [state.isConnected]);

  // Example network mismatch detection (expand as needed)
  useEffect(() => {
    if (state.isConnected && state.network !== 'TESTNET') {
      showToast('warning', 'Network Mismatch', {
        message: `Connected wallet is on ${state.network}, but the app requires TESTNET.`,
      });
    }
  }, [state.isConnected, state.network, showToast]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        signTransaction: signTransactionCb,
        getAddress: getAddressCb,
        getNetworkDetails: getNetworkDetailsCb,
        addToken: addTokenCb,
        checkConnection: async () => state.isConnected,
        refreshConnection: async () => {},
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}; 