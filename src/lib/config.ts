import { Networks } from '@stellar/stellar-sdk';

// Type definitions for better type safety
type AssetConfig = {
  address: string;
  symbol: string;
  issuer: string | null;
  decimals: number;
  collateralFactor?: number; // 0-10000 (where 10000 = 100%)
  isNative?: boolean;
  contractId?: string; // For Soroban contract assets
};

type Config = {
  RPC_URL: string;
  NETWORK_PASSPHRASE: string;
  SOROSWAP_ROUTER_ADDRESS: string;
  BLEND_CONTRACT_ADDRESS: string;
  ORACLE_ADDRESS: string;
  SUPPORTED_ASSETS: ReadonlyArray<AssetConfig>;
  DEFAULT_SLIPPAGE: number;
  DEFAULT_TX_FEE: string;
  MAX_TX_RETRIES: number;
  TX_TIMEOUT: number;
  SWAP_CONTRACT_ID: string;
  BORROW_CONTRACT_ID: string;
  SUPPLY_CONTRACT_ID: string;
};

export const CONFIG: Config = {
  RPC_URL: 'https://soroban-testnet.stellar.org',
  NETWORK_PASSPHRASE: Networks.TESTNET,
  SOROSWAP_ROUTER_ADDRESS: 'CAALXMGZL3JZHGXCPTJ2YFWYQN2F4CLHAKBLMGNR42XQNBTADSFQJCZD',
  BLEND_CONTRACT_ADDRESS: 'CB22KRA3YZVCNCQI64JQ5WE7UY2VAV7WFLK6A2JN3HEX56T2EDAFO7QF',
  ORACLE_ADDRESS: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  DEFAULT_SLIPPAGE: 1.0, // 1%
  DEFAULT_TX_FEE: '100000', // 0.1 XLM
  MAX_TX_RETRIES: 3,
  TX_TIMEOUT: 30000, // 30 seconds
  SWAP_CONTRACT_ID: 'CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH',
  BORROW_CONTRACT_ID: 'CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH',
  SUPPLY_CONTRACT_ID: 'CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH',
  
  SUPPORTED_ASSETS: [
    {
      address: 'native',
      symbol: 'XLM',
      issuer: null,
      decimals: 7,
      isNative: true,
      collateralFactor: 7000 // 70%
    },
    {
      address: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY',
      symbol: 'BLND',
      issuer: 'GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY',
      decimals: 7,
      collateralFactor: 6500 // 65%
    },
    {
      address: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      symbol: 'USDC',
      issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
      decimals: 6,
      collateralFactor: 8500 // 85%
    },
    {
      address: 'GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH',
      symbol: 'wETH',
      issuer: 'GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH',
      decimals: 18,
      collateralFactor: 7500 // 75%
    },
    {
      address: 'GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB',
      symbol: 'wBTC',
      issuer: 'GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB',
      decimals: 8,
      collateralFactor: 7500 // 75%
    }
  ] as const
};

// Helper types and functions
export type SupportedAsset = typeof CONFIG.SUPPORTED_ASSETS[number];

export function getAssetBySymbol(symbol: string): SupportedAsset | undefined {
  return CONFIG.SUPPORTED_ASSETS.find(asset => asset.symbol === symbol);
}

export function getAssetByAddress(address: string): SupportedAsset | undefined {
  return CONFIG.SUPPORTED_ASSETS.find(asset => 
    asset.address === address || (asset.isNative && address === 'native')
  );
}

export function isNativeAsset(asset: SupportedAsset): boolean {
  return asset.isNative === true;
}

// Network helper functions
export function isTestnet(): boolean {
  return CONFIG.NETWORK_PASSPHRASE === Networks.TESTNET;
}

export function isMainnet(): boolean {
  return CONFIG.NETWORK_PASSPHRASE === Networks.PUBLIC;
}