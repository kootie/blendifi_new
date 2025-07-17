import React from 'react';
import { useWallet } from '../context/WalletContext';

const WalletConnect: React.FC = () => {
  const {
    isConnected,
    publicKey,
    network,
    isLoading,
    error,
    connect,
    disconnect,
    walletInfo
  } = useWallet();

  const formatAddress = (address: string | null) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleConnect = async () => {
    await connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

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