import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useFreighter, UseFreighterResult } from '../lib/useFreighter';

interface WalletContextType extends UseFreighterResult {
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
  const freighterWallet = useFreighter();

  const refreshConnection = useCallback(async () => {
    await freighterWallet.checkConnection();
  }, [freighterWallet]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (freighterWallet.isConnected) {
        refreshConnection();
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [freighterWallet.isConnected, refreshConnection]);

  const contextValue: WalletContextType = {
    ...freighterWallet,
    refreshConnection,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
