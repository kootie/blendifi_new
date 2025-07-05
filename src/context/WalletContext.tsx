import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  getNetworkDetails,
  signTransaction,
  addToken
} from '@stellar/freighter-api';
import * as SorobanClient from 'soroban-client';
import { CONFIG } from '../lib/config';

const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const DEFAULT_NETWORK = 'TESTNET';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

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
  kit: FreighterKit | null;
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

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    publicKey: null,
    network: null,
    networkPassphrase: null,
    isLoading: false,
    error: null,
    kit: null,
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const result = await isConnected();
      if (result.error) return false;
      return result.isConnected;
    } catch (err) {
      console.error('Error checking Freighter connection:', err);
      return false;
    }
  }, []);

  const refreshConnection = useCallback(async (): Promise<void> => {
    try {
      const connected = await checkConnection();
      if (connected) {
        const allowed = await isAllowed();
        if (allowed) {
          const addressResult = await getAddress();
          if (!addressResult.error) {
            const networkResult = await getNetwork();
            const network = networkResult.error ? DEFAULT_NETWORK : (networkResult.network || DEFAULT_NETWORK);
            const networkPassphrase = networkResult.error ? DEFAULT_NETWORK_PASSPHRASE : (networkResult.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE);
            
            setState(prev => ({
              ...prev,
              isConnected: true,
              publicKey: addressResult.address,
              network,
              networkPassphrase,
              error: null,
            }));
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing connection:', error);
    }
  }, [checkConnection]);

  const connect = useCallback(async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const connected = await checkConnection();
      if (!connected) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Freighter wallet is not installed. Please install it from https://www.freighter.app/' 
        }));
        return false;
      }

      const allowed = await isAllowed();
      if (!allowed) {
        const allowedSet = await setAllowed();
        if (!allowedSet) {
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: 'Permission denied. Please allow this app to access Freighter.' 
          }));
          return false;
        }
      }

      const accessResult = await requestAccess();
      if (accessResult.error) {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: accessResult.error.message || 'Could not get address from Freighter.' 
        }));
        return false;
      }

      const networkResult = await getNetwork();
      const network = networkResult.error ? DEFAULT_NETWORK : (networkResult.network || DEFAULT_NETWORK);
      const networkPassphrase = networkResult.error ? DEFAULT_NETWORK_PASSPHRASE : (networkResult.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE);

      setState(prev => ({
        ...prev,
        isConnected: true,
        publicKey: accessResult.address,
        network,
        networkPassphrase,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: err.message || 'Failed to connect to Freighter wallet' 
      }));
      return false;
    }
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      publicKey: null,
      network: null,
      networkPassphrase: null,
      isLoading: false,
      error: null,
      kit: null,
    });
  }, []);

  const signTransactionCb = useCallback(async (transaction: any, options: any = {}): Promise<string> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    try {
      const result = await signTransaction(transaction, options);
      if (result.error) throw new Error(result.error.message);
      return result.signedTxXdr;
    } catch (err: any) {
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [state.isConnected]);

  const getAddressCb = useCallback(async (): Promise<string> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    try {
      const result = await getAddress();
      if (result.error) throw new Error(result.error.message);
      return result.address;
    } catch (err: any) {
      throw new Error(`Failed to get address: ${err.message}`);
    }
  }, [state.isConnected]);

  const getNetworkDetailsCb = useCallback(async (): Promise<any> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    try {
      return await getNetworkDetails();
    } catch (err: any) {
      throw new Error(`Failed to get network details: ${err.message}`);
    }
  }, [state.isConnected]);

  const addTokenCb = useCallback(async (contractId: string, networkPassphrase: string): Promise<string> => {
    if (!state.isConnected) throw new Error('Wallet not connected');
    try {
      const result = await addToken({ contractId, networkPassphrase });
      if (result.error) throw new Error(result.error.message);
      return result.contractId;
    } catch (err: any) {
      throw new Error(`Failed to add token: ${err.message}`);
    }
  }, [state.isConnected]);

  // Initialize connection on mount
  useEffect(() => {
    refreshConnection();
  }, [refreshConnection]);

  // Set up Soroban kit when connected
  useEffect(() => {
    if (state.isConnected && state.publicKey && state.network) {
      const server = new SorobanClient.Server(SOROBAN_RPC, { allowHttp: true });
      setState(prev => ({
        ...prev,
        kit: {
          server,
          networkPassphrase: NETWORK_PASSPHRASE,
          horizonUrl: CONFIG.STELLAR_HORIZON_URL,
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
        refreshConnection();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [state.isConnected, refreshConnection]);

  const contextValue: WalletContextType = {
    ...state,
    connect,
    disconnect,
    signTransaction: signTransactionCb,
    getAddress: getAddressCb,
    getNetworkDetails: getNetworkDetailsCb,
    addToken: addTokenCb,
    checkConnection,
    refreshConnection,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}; 