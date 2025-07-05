# Stellar DeFi Hub

A comprehensive DeFi application built on Stellar that integrates swap functionality, lending/borrowing through Blend pools, and staking rewards. The frontend is built with React, TypeScript, and integrates with the Stellar blockchain using Freighter wallet and Soroban smart contracts.

## Features

- **Token Swapping**: Exchange cryptocurrencies using Soroswap integration
- **Lending & Borrowing**: Supply assets to Blend pools and borrow against collateral
- **Staking Rewards**: Stake bTokens to earn protocol fees and rewards
- **Health Factor Monitoring**: Real-time monitoring of borrowing health factors
- **Multi-Asset Support**: Support for 11 major cryptocurrencies including BLND (Blend token)
- **Portfolio Management**: Comprehensive portfolio tracking and analytics
- **Freighter Wallet Integration**: Secure wallet connection and transaction signing
- **Soroban Contract Calls**: All DeFi actions interact directly with the deployed Soroban contract
- **Real-Time Price Feeds**: Asset prices fetched from DIA oracle, DEX, and fallback sources
- **Improved Error Handling**: User-friendly error messages for wallet, contract, and network issues

## Supported Assets

The application supports the following assets on Stellar testnet:

- **USDC** (USD Coin) - 85% collateral factor
- **USDT** (Tether) - 85% collateral factor
- **XLM** (Stellar) - 70% collateral factor
- **BLND** (Blend Token) - 65% collateral factor

## Prerequisites

- Node.js 18+ and npm/yarn
- Freighter wallet extension installed
- Stellar testnet account with test XLM
- Deployed Soroban smart contract on Stellar testnet

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd blendifi
```

2. Install dependencies:
```bash
npm install
```

3. Configure your contract:
   - Open `src/lib/config.ts`
   - Replace `YOUR_CONTRACT_ID_HERE` with your deployed contract ID
   - Ensure all external contract addresses are correct for your network

4. Start the development server:
```bash
npm run dev
```
   - If port 8080 is in use, the app will start on the next available port (e.g., 8081).

## Smart Contract Setup

Before using the frontend, ensure your smart contract is properly deployed and initialized:

1. **Deploy the contract** to Stellar testnet
2. **Initialize the contract** with an admin address
3. **Verify external contracts** are accessible:
   - Blend Pool Factory
   - Soroswap Router
   - DIA Oracle

## Usage

### Connecting Wallet

1. Click "Connect Freighter Wallet" button
2. Approve the connection in Freighter
3. Your wallet address will be displayed and portfolio data will load

### Swapping Tokens

1. Select the "Swap" tab
2. Choose the token you want to swap from and to
3. Enter the amount
4. Click "Swap Tokens"
5. Approve the transaction in Freighter

### Supplying Assets

1. Select the "Supply" tab
2. Choose the asset you want to supply
3. Enter the amount
4. Click "Supply to Blend"
5. Approve the transaction in Freighter

### Borrowing Assets

1. Select the "Borrow" tab
2. Choose the asset you want to borrow
3. Enter the amount
4. Ensure your health factor is above 120%
5. Click "Borrow from Blend"
6. Approve the transaction in Freighter

### Staking bTokens

1. Select the "Stake" tab
2. Choose the bToken you want to stake
3. Enter the amount
4. Click "Stake bTokens"
5. Approve the transaction in Freighter

## Portfolio Features

The application provides comprehensive portfolio management:

- **Health Factor Monitoring**: Real-time calculation and display of borrowing health
- **Asset Positions**: Detailed view of supplied and borrowed assets
- **Portfolio Value**: Total collateral, borrowed, and net position values
- **Price Information**: Real-time asset prices from DIA oracle, DEX, and fallback sources

## Technical Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **React Router** for navigation
- **React Query** for data fetching

### Blockchain Integration
- **@stellar/stellar-sdk** (latest) for Stellar operations
- **@stellar/freighter-api** for wallet integration
- **soroban-client** (latest) for smart contract interactions

### Key Components
- `CryptoExchange`: Main DeFi interface with tabs for different operations
- `UserPortfolio`: Detailed portfolio analytics and position tracking
- `CryptoSelector`: Asset selection dropdown with collateral factors
- `stellar.ts`: Core blockchain integration and contract calls

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
VITE_CONTRACT_ID=your_contract_id_here
VITE_NETWORK=testnet
```

### Contract Configuration
Update `src/lib/config.ts` with your specific contract addresses and settings.

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # Shadcn/ui components
│   ├── CryptoExchange.tsx
│   ├── CryptoSelector.tsx
│   ├── UserPortfolio.tsx
│   └── Navbar.tsx
├── lib/                # Utility functions
│   ├── stellar.ts      # Blockchain integration
│   ├── config.ts       # Configuration
│   └── utils.ts        # General utilities
├── hooks/              # Custom React hooks
├── pages/              # Page components
└── main.tsx           # Application entry point
```

## Troubleshooting

### Common Issues

1. **Wallet Connection Fails**
   - Ensure Freighter is installed and unlocked
   - Check that you're on the correct network (testnet)
   - Try refreshing the page

2. **Contract Calls Fail**
   - Verify your contract ID is correct in `config.ts`
   - Ensure your contract is properly initialized
   - Check that external contracts are accessible

3. **Health Factor Issues**
   - Ensure you have sufficient collateral before borrowing
   - Check that asset prices are available from the oracle
   - Verify collateral factors are correctly set

4. **Transaction Failures**
   - Ensure you have sufficient XLM for transaction fees
   - Check that you have sufficient token balances
   - Verify transaction parameters are within limits

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the troubleshooting section
- Review the smart contract documentation
- Open an issue on GitHub

## Security

- Never share your private keys
- Always verify contract addresses before transactions
- Use testnet for development and testing
- Review smart contract code before deployment
