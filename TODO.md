# TODO: Blendifi DeFi App Completion Checklist

## 1. Portfolio/Balance Fetching
- [ ] Implement real balance/portfolio fetching in `useWalletBalances.ts`
  - Replace stub with logic to fetch balances from Stellar/Soroban for the connected wallet.

## 2. Contract Interaction Utilities ✅ COMPLETED
- [x] Add contract utility functions for all DeFi actions
  - Functions for stake, swap, borrow, repay, get user position, etc., using Soroban contract calls.
  - Fixed prices implemented (no oracle dependency)
  - Proper error handling and type safety

## 3. Global Wallet Context
- [ ] Create a global wallet context/provider
  - Use React Context to provide wallet state across the app, preventing disconnects on navigation.

## 4. User Feedback & Spinners
- [ ] Add user feedback for pending/confirmed/failed transactions
  - Spinners, error/success toasts, and transaction status indicators for all DeFi actions.

## 5. Form State Management
- [ ] Implement form state management and reset logic
  - Reset forms after successful actions and add validation for user inputs.

## 6. Auto-Refresh/Live Updates
- [ ] Add auto-refresh for dashboard/portfolio after actions
  - Refresh balances and user positions automatically after transactions.

## 7. Network Switching (Optional)
- [ ] Add network switcher UI and logic
  - Allow switching between testnet/mainnet or custom RPC endpoints.

## 8. Type Definitions
- [ ] Add robust TypeScript types for contract data and UI state
  - Shared interfaces for user positions, contract responses, and transaction results.

## 9. Token Utility Functions
- [ ] Add utility functions for token formatting and address validation
  - Helpers for formatting token amounts, parsing, and validating addresses.

## 10. Page Directory (Optional)
- [ ] Consider moving route components to a `src/pages/` directory
  - For better organization in larger apps (not strictly required).

---

**Prioritize items 1–6 for core DeFi functionality.** 