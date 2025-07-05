// Stellar DeFi Hub Configuration
export const CONFIG = {
  // Deployed contract ID
  CONTRACT_ID: "CA26SDP73CGMH5E5HHTHT3DN4YPH4DJUNRBRHPB4ZJTF2DQXDMCXXTZH",
  
  // Network configuration
  NETWORK: "testnet" as const,
  NETWORK_URL: "https://soroban-testnet.stellar.org",
  
  // External contract addresses (Stellar Testnet)
  BLEND_POOL_FACTORY: "CDEVVU3G2CFH6LJQG6LLSCSIU2BNRWDSJMDA44OA64XFV4YNWG7T22IU",
  SOROSWAP_ROUTER: "CAALXMGZL3JZHGXCPTJ2YFWYQN2F4CLHAKBLMGNR42XQNBTADSFQJCZD",
  DIA_ORACLE: "CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4",
  
  // Supported assets configuration - Updated to only 5 assets
  SUPPORTED_ASSETS: [
    {
      address: "native",
      symbol: "XLM",
      decimals: 7,
      collateralFactor: 7000, // 70%
      isCollateral: true,
      diaSymbol: "XLM",
      displayName: "Stellar"
    },
    {
      address: "GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY",
      symbol: "BLND",
      decimals: 7,
      collateralFactor: 6500, // 65%
      isCollateral: true,
      diaSymbol: "BLND",
      displayName: "Blend"
    },
    {
      address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      symbol: "USDC",
      decimals: 6,
      collateralFactor: 8500, // 85%
      isCollateral: true,
      diaSymbol: "USDC",
      displayName: "USD Coin"
    },
    {
      address: "GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH",
      symbol: "wETH",
      decimals: 18,
      collateralFactor: 7500, // 75%
      isCollateral: true,
      diaSymbol: "ETH",
      displayName: "Wrapped Ethereum"
    },
    {
      address: "GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB",
      symbol: "wBTC",
      decimals: 8,
      collateralFactor: 7500, // 75%
      isCollateral: true,
      diaSymbol: "BTC",
      displayName: "Wrapped Bitcoin"
    }
  ],
  
  // Protocol settings
  PROTOCOL_FEE: 50, // 0.5% (50 basis points)
  MAX_PRICE_AGE: 3600, // 1 hour in seconds
  LIQUIDATION_THRESHOLD: 8000, // 80% in basis points
  SECONDS_PER_DAY: 86400,
  
  // UI settings
  DEFAULT_SLIPPAGE: 0.5, // 0.5%
  MAX_SLIPPAGE: 5, // 5%
  MIN_HEALTH_FACTOR: 120, // 120%
  
  // API endpoints
  DIA_API_URL: "https://api.diadata.org/v1/assetQuotation",
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
} as const;

export type Network = typeof CONFIG.NETWORK;
export type SupportedAsset = typeof CONFIG.SUPPORTED_ASSETS[number]; 