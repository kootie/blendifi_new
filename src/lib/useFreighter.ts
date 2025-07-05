import { useState, useEffect, useCallback } from 'react';
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
import { CONFIG } from './config';

const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const DEFAULT_NETWORK = 'TESTNET';
const DEFAULT_NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

export interface FreighterKit {
  server: any;
  networkPassphrase: string;
  horizonUrl: string;
}

export interface UseFreighterResult {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
  networkPassphrase: string | null;
  isLoading: boolean;
  error: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  signTransaction: (transaction: any, options?: any) => Promise<string>;
  getAddress: () => Promise<string>;
  getNetworkDetails: () => Promise<any>;
  addToken: (contractId: string, networkPassphrase: string) => Promise<string>;
  checkConnection: () => Promise<boolean>;
  kit: FreighterKit | null;
}

export const useFreighter = (): UseFreighterResult => {
  const [isConnectedState, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [networkPassphrase, setNetworkPassphrase] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kit, setKit] = useState<FreighterKit | null>(null);

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

  const connect = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const connected = await checkConnection();
      if (!connected) {
        setError('Freighter wallet is not installed. Please install it from https://www.freighter.app/');
        return false;
      }
      const allowed = await isAllowed();
      if (!allowed) {
        const allowedSet = await setAllowed();
        if (!allowedSet) {
          setError('Permission denied. Please allow this app to access Freighter.');
          return false;
        }
      }
      const accessResult = await requestAccess();
      if (accessResult.error) {
        setError(accessResult.error.message || 'Could not get address from Freighter.');
        return false;
      }
      setPublicKey(accessResult.address);
      const networkResult = await getNetwork();
      if (networkResult.error) {
        setNetwork(DEFAULT_NETWORK);
        setNetworkPassphrase(DEFAULT_NETWORK_PASSPHRASE);
      } else {
        setNetwork(networkResult.network || DEFAULT_NETWORK);
        setNetworkPassphrase(networkResult.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE);
      }
      setIsConnected(true);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Freighter wallet');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [checkConnection]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setPublicKey(null);
    setNetwork(null);
    setNetworkPassphrase(null);
    setError(null);
  }, []);

  const signTransactionCb = useCallback(async (transaction: any, options: any = {}): Promise<string> => {
    if (!isConnectedState) throw new Error('Wallet not connected');
    try {
      const result = await signTransaction(transaction, options);
      if (result.error) throw new Error(result.error.message);
      return result.signedTxXdr;
    } catch (err: any) {
      throw new Error(`Transaction signing failed: ${err.message}`);
    }
  }, [isConnectedState]);

  const getAddressCb = useCallback(async (): Promise<string> => {
    if (!isConnectedState) throw new Error('Wallet not connected');
    try {
      const result = await getAddress();
      if (result.error) throw new Error(result.error.message);
      return result.address;
    } catch (err: any) {
      throw new Error(`Failed to get address: ${err.message}`);
    }
  }, [isConnectedState]);

  const getNetworkDetailsCb = useCallback(async (): Promise<any> => {
    if (!isConnectedState) throw new Error('Wallet not connected');
    try {
      return await getNetworkDetails();
    } catch (err: any) {
      throw new Error(`Failed to get network details: ${err.message}`);
    }
  }, [isConnectedState]);

  const addTokenCb = useCallback(async (contractId: string, networkPassphrase: string): Promise<string> => {
    if (!isConnectedState) throw new Error('Wallet not connected');
    try {
      const result = await addToken({ contractId, networkPassphrase });
      if (result.error) throw new Error(result.error.message);
      return result.contractId;
    } catch (err: any) {
      throw new Error(`Failed to add token: ${err.message}`);
    }
  }, [isConnectedState]);

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const connected = await checkConnection();
        if (connected) {
          const allowed = await isAllowed();
          if (allowed) {
            const addressResult = await getAddress();
            if (!addressResult.error) {
              setPublicKey(addressResult.address);
              setIsConnected(true);
              const networkResult = await getNetwork();
              if (networkResult.error) {
                setNetwork(DEFAULT_NETWORK);
                setNetworkPassphrase(DEFAULT_NETWORK_PASSPHRASE);
              } else {
                setNetwork(networkResult.network || DEFAULT_NETWORK);
                setNetworkPassphrase(networkResult.networkPassphrase || DEFAULT_NETWORK_PASSPHRASE);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing Freighter connection:', error);
      }
    };
    initializeConnection();
  }, [checkConnection]);

  useEffect(() => {
    if (isConnectedState && publicKey && network) {
      const server = new SorobanClient.Server(SOROBAN_RPC, { allowHttp: true });
      setKit({
        server,
        networkPassphrase: NETWORK_PASSPHRASE,
        horizonUrl: CONFIG.STELLAR_HORIZON_URL,
      });
    } else {
      setKit(null);
    }
  }, [isConnectedState, publicKey, network]);

  return {
    isConnected: isConnectedState,
    publicKey,
    network,
    networkPassphrase,
    isLoading,
    error,
    connect,
    disconnect,
    signTransaction: signTransactionCb,
    getAddress: getAddressCb,
    getNetworkDetails: getNetworkDetailsCb,
    addToken: addTokenCb,
    checkConnection,
    kit,
  };
}; 