#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, IntoVal,
    Address, Env, String, Vec, Map
};

// Stellar Blend Pool Interface
#[contracttype]
pub struct BlendPool {
    pub pool_id: Address,
    pub underlying_asset: Address,
    pub reserve_asset: Address, // blended token (bToken)
}

// User position tracking
#[contracttype]
pub struct UserPosition {
    pub supplied_assets: Map<Address, u128>, // asset -> amount supplied to Blend
    pub borrowed_assets: Map<Address, u128>, // asset -> amount borrowed from Blend
    pub staked_lp_tokens: Map<Address, u128>, // LP token -> amount staked
    pub rewards_earned: u128,
    pub last_reward_update: u64, // For reward calculation
}

// Liquidity Pool for staking rewards
#[contracttype]
pub struct StakingPool {
    pub total_staked: u128,
    pub reward_rate: u128, // rewards per second per token staked
    pub last_update_time: u64,
    pub reward_per_token_stored: u128,
    pub total_rewards_distributed: u128,
}

// Asset configuration
#[contracttype]
pub struct AssetConfig {
    pub address: Address,
    pub symbol: String,
    pub decimals: u32,
    pub collateral_factor: u128, // In basis points (8000 = 80%)
    pub is_collateral: bool,
    pub dia_symbol: String, // Symbol used in DIA oracle
}

// Error types
#[contracttype]
pub enum HubError {
    OracleFailure = 1,
    InsufficientLiquidity = 2,
    InvalidAsset = 3,
    PriceStale = 4,
    PoolNotFound = 5,
    InsufficientCollateral = 6,
    AssetNotSupported = 7,
    SwapFailed = 8,
}

#[contract]
pub struct StellarDeFiHub;

const PROTOCOL_FEE: u128 = 50; // 0.5% (50 basis points)
const MAX_PRICE_AGE: u64 = 3600; // 1 hour in seconds
const LIQUIDATION_THRESHOLD: u128 = 8000; // 80% in basis points
const SECONDS_PER_DAY: u64 = 86400;

// Stellar Testnet Addresses
const BLEND_POOL_FACTORY: &str = "CDEVVU3G2CFH6LJQG6LLSCSIU2BNRWDSJMDA44OA64XFV4YNWG7T22IU";
const SOROSWAP_ROUTER: &str = "CAALXMGZL3JZHGXCPTJ2YFWYQN2F4CLHAKBLMGNR42XQNBTADSFQJCZD"; 

// DIA Oracle (Testnet only)
const DIA_ORACLE_TESTNET: &str = "CAEDPEZDRCEJCF73ASC5JGNKCIJDV2QJQSW6DJ6B74MYALBNKCJ5IFP4";

// Supported assets on Stellar Testnet
const SUPPORTED_ASSETS: [(&str, &str, u32, u128, &str); 11] = [
    ("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5", "USDC", 6, 8500, "USDC"),
    ("GCKFBEIYTKP5RDBKDC7QNURHCZGB2HMCQSZXEBT4OATXKBMUWQE5H7J4", "USDT", 6, 8500, "USDT"),
    ("native", "XLM", 7, 7000, "XLM"),
    ("GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB", "BTC", 8, 7500, "BTC"),
    ("GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH", "ETH", 18, 7500, "ETH"),
    ("GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", "AQUA", 7, 6000, "AQUA"),
    ("GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M", "VELO", 7, 6000, "VELO"),
    ("GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", "SHX", 6, 6500, "SHX"),
    ("GASBLVHS5FOABSDNW5SPPH3QRJYXY5JHA2AOA2QHH2FJLZBRXSG4SWXT", "WXT", 6, 6000, "WXT"),
    ("GBNLJIYH34UWO5YZFA3A3HD3N76R6DOI33N4JONUOHEEYZYCAYTEJ5AK", "RIO", 7, 6000, "RIO"),
    // (Contract Address, Symbol, Decimals, Collateral Factor, DIA Symbol)
// (Issuer, Asset Code, Decimals, Collateral %, Display Name)

("GA5ZSE9EQLFZB5E34TRTFWNW5T76W2KQZ7ZYPZB2O2C3Y5QTKH7C5OL6", "USDC", 6, 8500, "USDC"),   // USDC
("GAP5LETOVHK3YHGGQ5DLVZ5P7FSVJYZAPVZCFAWAW7A4M23TLH6Y2D2I", "USDT", 6, 8500, "USDT"),   // USDT
("native", "XLM", 7, 7000, "XLM"),                                                       // XLM 
("GDXTJEK4JZNSTNQAWA53RZNS2MDXYD2SMT6Q7JH2CU2B6Y2DRX6XM3UB", "BTC", 8, 7500, "BTC"),     // Wrapped BTC
("GBETHKBLNBSBXVLTKWLB6L3X3RTMAKKI64JUNNQO5EUXYYTYO3O3G2YH", "ETH", 18, 7500, "ETH"),    // Wrapped ETH
("GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA", "AQUA", 7, 6000, "AQUA"),   // AQUA Token
("GDM4RQUQQUVSKQA7S6EM7XBZP3FCGH4Q7CL6TABQ7B2BEJ5ERARM2M5M", "VELO", 7, 6000, "VELO"),   // VELO Token
("GDSTRSHXHGJ7ZIVRBXEYE5Q74XUVCUSEKEBR7UCHEUUEK72N7I7KJ6JH", "SHX", 6, 6500, "SHX"),     // Stronghold SHX
("GASBLVHS5FOABSDNW5SPPH3QRJYXY5JHA2AOA2QHH2FJLZBRXSG4SWXT", "WXT", 6, 6000, "WXT"),     // Wirex WXT
("GBNLJIYH34UWO5YZFA3A3HD3N76R6DOI33N4JONUOHEEYZYCAYTEJ5AK", "RIO", 7, 6000, "RIO"),     // Realio RIO
("GDJEHTBE6ZHUXSWFI642DCGLUOECLHPF3KSXHPXTSTJ7E3JF6MQ5EZYY", "BLND", 7, 6500, "BLND"),  // BLEND

];

// Oracle configuration
#[contracttype]
pub struct DIAOracleConfig {
    pub oracle_address: Address,
    pub max_price_age: u64,
    pub price_precision: u128, // DIA uses 8 decimals
}

#[contracttype]
pub struct DIAPriceData {
    pub price: u128,        // Price in 8 decimals (DIA standard)
    pub timestamp: u64,     // Last update timestamp
    pub round_id: u64,      // Round ID for tracking
}


#[contracttype]
pub struct PriceSource {
    pub source_type: String, // "oracle", "dex", "admin", "mock"
    pub price: u128,
    pub timestamp: u64,
    pub confidence: u32, // 0-100, higher = more reliable
}

#[contracttype]
pub struct DexPriceInfo {
    pub price: u128,
    pub liquidity: u128,
    pub last_trade_time: u64,
}

#[contractimpl]
impl StellarDeFiHub {
    
    /// Initialize the DeFi Hub with supported assets
    pub fn initialize(env: Env, admin: Address) {
        env.storage().instance().set(&symbol_short!("admin"), &admin);
        
        // Set DIA oracle configuration (testnet only)
        let oracle_config = DIAOracleConfig {
            oracle_address: Address::from_string(&String::from_str(&env, DIA_ORACLE_TESTNET)),
            max_price_age: MAX_PRICE_AGE,
            price_precision: 100_000_000, // 8 decimals = 10^8
        };
        env.storage().instance().set(&symbol_short!("oracle"), &oracle_config);
        
        // Initialize supported assets
        Self::initialize_assets(&env);
        
        // Initialize reward system
        Self::initialize_rewards(&env);
        
        env.storage().instance().set(&symbol_short!("init"), &true);
    }

    /// Swap tokens using Soroswap with fee collection
    pub fn swap_tokens(
        env: Env,
        user: Address,
        token_a: Address,
        token_b: Address,
        amount_in: u128,
        min_amount_out: u128,
        deadline: u64,
    ) -> u128 {
        user.require_auth();
        
        // Validate assets are supported
        assert!(Self::is_asset_supported(&env, &token_a), "Token A not supported");
        assert!(Self::is_asset_supported(&env, &token_b), "Token B not supported");
        
        // Check deadline
        assert!(env.ledger().timestamp() <= deadline, "Transaction expired");
        
        // Calculate protocol fee
        let fee_amount = (amount_in * PROTOCOL_FEE) / 10000;
        let swap_amount = amount_in - fee_amount;
        
        // Transfer tokens from user
        Self::transfer_from_user(&env, &token_a, &user, &env.current_contract_address(), amount_in);
        
        // Perform swap via Soroswap
        let amount_out = Self::execute_soroswap(&env, &token_a, &token_b, swap_amount, min_amount_out);
        
        // Add fee to reward pool
        Self::add_to_reward_pool(&env, &token_a, fee_amount);
        
        // Transfer swapped tokens to user
        Self::transfer_to_user(&env, &token_b, &user, amount_out);
        
        // Emit swap event
        env.events().publish(
            (symbol_short!("swap"), &user),
            (token_a, token_b, amount_in, amount_out, fee_amount)
        );
        
        amount_out
    }

    /// Supply assets to Blend lending pool
    pub fn supply_to_blend(
        env: Env,
        user: Address,
        asset: Address,
        amount: u128,
    ) -> Address {
        user.require_auth();
        
        // Validate asset is supported
        assert!(Self::is_asset_supported(&env, &asset), "Asset not supported");
        
        // Get Blend pool for asset
        let blend_pool = Self::get_or_create_blend_pool(&env, &asset);
        
        // Transfer asset from user
        Self::transfer_from_user(&env, &asset, &user, &env.current_contract_address(), amount);
        
        // Supply to Blend pool and receive bTokens
        let btokens_received = Self::supply_to_blend_pool(&env, &blend_pool, &asset, amount);
        
        // Update user position
        Self::update_user_supply_position(&env, &user, &asset, amount);
        
        // Transfer bTokens to user
        Self::transfer_to_user(&env, &blend_pool.reserve_asset, &user, btokens_received);
        
        env.events().publish(
            (symbol_short!("supply"), &user),
            (asset, amount, btokens_received)
        );
        
        blend_pool.reserve_asset
    }

    /// Borrow assets from Blend with collateral check
    pub fn borrow_from_blend(
        env: Env,
        user: Address,
        asset: Address,
        amount: u128,
    ) {
        user.require_auth();
        
        // Validate asset
        assert!(Self::is_asset_supported(&env, &asset), "Asset not supported");
        
        // Check user's collateral health BEFORE borrowing
        let health_factor = Self::calculate_health_factor(env.clone(), user.clone(), Some((asset.clone(), amount)));
        assert!(health_factor >= 1_200_000, "Insufficient collateral for borrow"); // 120% minimum
        
        // Get Blend pool
        let blend_pool = Self::get_or_create_blend_pool(&env, &asset);
        
        // Borrow from Blend
        Self::borrow_from_blend_pool(&env, &blend_pool, &asset, amount);
        
        // Update user position
        Self::update_user_borrow_position(&env, &user, &asset, amount);
        
        // Transfer borrowed asset to user
        Self::transfer_to_user(&env, &asset, &user, amount);
        
        env.events().publish(
            (symbol_short!("borrow"), &user),
            (asset, amount, health_factor)
        );
    }

    /// Stake bTokens to earn protocol fees
    pub fn stake_btokens(
        env: Env,
        user: Address,
        btoken: Address,
        amount: u128,
    ) {
        user.require_auth();
        
        // Transfer bTokens from user
        Self::transfer_from_user(&env, &btoken, &user, &env.current_contract_address(), amount);
        
        // Update user rewards before changing stake
        Self::update_user_rewards(&env, &user, &btoken);
        
        // Update staking position
        Self::update_staking_position(&env, &user, &btoken, amount, true);
        
        // Update staking pool
        Self::update_staking_pool(&env, &btoken, amount, true);
        
        env.events().publish(
            (symbol_short!("stake"), &user),
            (btoken, amount)
        );
    }

    /// Unstake bTokens and claim rewards
    pub fn unstake_and_claim(
        env: Env,
        user: Address,
        btoken: Address,
        amount: u128,
    ) -> u128 {
        user.require_auth();
        
        // Update user rewards before unstaking
        Self::update_user_rewards(&env, &user, &btoken);
        
        // Calculate claimable rewards
        let rewards = Self::get_claimable_rewards(&env, &user);
        
        // Update staking position
        Self::update_staking_position(&env, &user, &btoken, amount, false);
        
        // Update staking pool
        Self::update_staking_pool(&env, &btoken, amount, false);
        
        // Transfer bTokens back to user
        Self::transfer_to_user(&env, &btoken, &user, amount);
        
        // Transfer rewards if any (in collected fee tokens)
        if rewards > 0 {
            Self::distribute_rewards(&env, &user, rewards);
        }
        
        env.events().publish(
            (symbol_short!("unstake"), &user),
            (btoken, amount, rewards)
        );
        
        rewards
    }

    /// Get user's position across all protocols
    pub fn get_user_position(env: Env, user: Address) -> UserPosition {
        env.storage()
            .persistent()
            .get(&(symbol_short!("pos"), user))
            .unwrap_or(UserPosition {
                supplied_assets: Map::new(&env),
                borrowed_assets: Map::new(&env),
                staked_lp_tokens: Map::new(&env),
                rewards_earned: 0,
                last_reward_update: env.ledger().timestamp(),
            })
    }

    /// Calculate user's health factor for borrowing
    pub fn calculate_health_factor(
        env: Env,
        user: Address,
        additional_borrow: Option<(Address, u128)>
    ) -> u128 {
        match Self::calculate_health_factor_internal(env, user, additional_borrow) {
            Ok(val) => val,
            Err(HubError::AssetNotSupported) => panic!("Asset not supported"),
            Err(_) => panic!("Health factor calculation failed"),
        }
    }

    fn calculate_health_factor_internal(
        env: Env,
        user: Address,
        additional_borrow: Option<(Address, u128)>
    ) -> Result<u128, HubError> {
        let position = Self::get_user_position(env.clone(), user.clone());
        let mut total_collateral_value = 0u128;
        let mut total_debt_value = 0u128;
        // Calculate collateral value (supplied assets)
        for (asset, amount) in position.supplied_assets.iter() {
            if let Some(price) = Self::get_asset_price_safe(&env, &asset) {
                let asset_config = Self::get_asset_config(&env, &asset)?;
                if asset_config.is_collateral {
                    let collateral_value = (amount * price * asset_config.collateral_factor) /
                                         (Self::get_price_precision(&env, &asset)? * 10000);
                    total_collateral_value += collateral_value;
                }
            }
        }
        // Calculate debt value (borrowed assets + potential new borrow)
        for (asset, amount) in position.borrowed_assets.iter() {
            if let Some(price) = Self::get_asset_price_safe(&env, &asset) {
                let debt_value = (amount * price) / Self::get_price_precision(&env, &asset)?;
                total_debt_value += debt_value;
            }
        }
        // Add additional borrow if provided
        if let Some((borrow_asset, borrow_amount)) = additional_borrow {
            if let Some(price) = Self::get_asset_price_safe(&env, &borrow_asset) {
                let additional_debt = (borrow_amount * price) / Self::get_price_precision(&env, &borrow_asset)?;
                total_debt_value += additional_debt;
            }
        }
        if total_debt_value == 0 {
            return Ok(u128::MAX); // No debt = infinite health
        }
        // Health factor = collateral_value / debt_value (in 6 decimals)
        Ok((total_collateral_value * 1_000_000) / total_debt_value)
    }

    /// Get asset price with DIA oracle
    pub fn get_asset_price(env: Env, asset: Address) -> u128 {
        Self::get_asset_price_safe(&env, &asset)
            .unwrap_or_else(|| panic!("Price unavailable"))
    }

    /// Get supported assets list
    pub fn get_supported_assets(env: Env) -> Vec<AssetConfig> {
        let mut assets = Vec::new(&env);
        
        for i in 0..10 {
            let key = (symbol_short!("asset"), i);
            if let Some(config) = env.storage().instance().get::<_, AssetConfig>(&key) {
                assets.push_back(config);
            }
        }
        
        assets
    }

    /// Get staking pool information
    pub fn get_staking_pool(env: Env, btoken: Address) -> StakingPool {
        let key = (symbol_short!("pool"), btoken);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(StakingPool {
                total_staked: 0,
                reward_rate: 1000, // Default 1000 per day
                last_update_time: env.ledger().timestamp(),
                reward_per_token_stored: 0,
                total_rewards_distributed: 0,
            })
    }

    /// Admin function to update reward rate
    pub fn update_reward_rate(env: Env, admin: Address, new_rate: u128) {
        admin.require_auth();
        
        let stored_admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert_eq!(admin, stored_admin, "Only admin can update reward rate");
        
        env.storage().instance().set(&symbol_short!("rwd_rate"), &new_rate);
        
        env.events().publish(
            (symbol_short!("rate_upd"), &admin),
            new_rate
        );
    }


    fn initialize_assets(env: &Env) {
        for (i, (addr_str, symbol, decimals, collateral_factor, dia_symbol)) in SUPPORTED_ASSETS.iter().enumerate() {
            let config = AssetConfig {
                address: Address::from_string(&String::from_str(env, addr_str)),
                symbol: String::from_str(env, symbol),
                decimals: *decimals,
                collateral_factor: *collateral_factor,
                is_collateral: *collateral_factor > 0,
                dia_symbol: String::from_str(env, dia_symbol),
            };
            
            let key = (symbol_short!("asset"), i as u32);
            env.storage().instance().set(&key, &config);
        }
    }

    fn initialize_rewards(env: &Env) {
        // Initialize global reward tracking
        env.storage().instance().set(&symbol_short!("rwd_rate"), &1000u128); // 1000 tokens per day base rate
        env.storage().instance().set(&symbol_short!("rwd_start"), &env.ledger().timestamp());
    }

    fn execute_soroswap(
        env: &Env,
        token_a: &Address,
        token_b: &Address,
        amount_in: u128,
        min_amount_out: u128,
    ) -> u128 {
        let router_address = Address::from_string(&String::from_str(env, SOROSWAP_ROUTER));
        
        // Call Soroswap router's swapExactTokensForTokens
        env.invoke_contract::<u128>(
            &router_address,
            &symbol_short!("swap_ex"),
            soroban_sdk::vec![
                env,
                amount_in.into_val(env),
                min_amount_out.into_val(env),
                token_a.into_val(env),
                token_b.into_val(env),
                env.current_contract_address().into_val(env),
                (env.ledger().timestamp() + 300).into_val(env), // 5 min deadline
            ],
        )
    }

    fn get_or_create_blend_pool(env: &Env, asset: &Address) -> BlendPool {
        let factory_address = Address::from_string(&String::from_str(env, BLEND_POOL_FACTORY));
        
        // Try to get existing pool
        let pool_result = env.try_invoke_contract::<Address, soroban_sdk::xdr::Error>(
            &factory_address,
            &symbol_short!("get_pool"),
            soroban_sdk::vec![env, asset.into_val(env)],
        );
        
        let pool_address = match pool_result {
            Ok(Ok(addr)) => addr,
            _ => {
                // Create new pool if doesn't exist
                env.invoke_contract::<Address>(
                    &factory_address,
                    &symbol_short!("create_pl"),
                    soroban_sdk::vec![env, asset.into_val(env)],
                )
            }
        };
        
        // Get bToken address from pool
        let btoken_address: Address = env.invoke_contract(
            &pool_address,
            &symbol_short!("get_rsrv"),
            soroban_sdk::vec![env, asset.into_val(env)],
        );
        
        BlendPool {
            pool_id: pool_address,
            underlying_asset: asset.clone(),
            reserve_asset: btoken_address,
        }
    }

    fn supply_to_blend_pool(
        env: &Env,
        blend_pool: &BlendPool,
        asset: &Address,
        amount: u128,
    ) -> u128 {
        env.invoke_contract::<u128>(
            &blend_pool.pool_id,
            &symbol_short!("supply"),
            soroban_sdk::vec![
                env,
                asset.into_val(env),
                amount.into_val(env),
            ],
        )
    }

    fn borrow_from_blend_pool(
        env: &Env,
        blend_pool: &BlendPool,
        asset: &Address,
        amount: u128,
    ) {
        env.invoke_contract::<()>(
            &blend_pool.pool_id,
            &symbol_short!("borrow"),
            soroban_sdk::vec![
                env,
                asset.into_val(env),
                amount.into_val(env),
            ],
        );
    }

    fn get_asset_price_safe(env: &Env, asset: &Address) -> Option<u128> {
        let mut price_sources = Vec::new(env);

        if let Some(oracle_price) = Self::try_dia_oracle(env, asset) {
            price_sources.push_back(PriceSource {
                source_type: String::from_str(env, "oracle"),
                price: oracle_price,
                timestamp: env.ledger().timestamp(),
                confidence: 90,
            });
        }

        if let Some(dex_price) = Self::get_dex_price(env, asset) {
            price_sources.push_back(PriceSource {
                source_type: String::from_str(env, "dex"),
                price: dex_price,
                timestamp: env.ledger().timestamp(),
                confidence: 85,
            });
        }
        
        if let Some(admin_price) = Self::get_admin_price(env, asset) {
            price_sources.push_back(PriceSource {
                source_type: String::from_str(env, "admin"),
                price: admin_price,
                timestamp: env.ledger().timestamp(),
                confidence: 70,
            });
        }

        if let Some(mock_price) = Self::get_mock_price(env, asset) {
            price_sources.push_back(PriceSource {
                source_type: String::from_str(env, "mock"),
                price: mock_price,
                timestamp: env.ledger().timestamp(),
                confidence: 50,
            });
        }
        // Select best price source
        Self::select_best_price(env, price_sources)
    }

    fn get_asset_config(env: &Env, asset: &Address) -> Result<AssetConfig, HubError> {
        for i in 0..10 {
            let key = (symbol_short!("asset"), i);
            if let Some(config) = env.storage().instance().get::<_, AssetConfig>(&key) {
                if config.address == *asset {
                    return Ok(config);
                }
            }
        }
        Err(HubError::AssetNotSupported)
    }

    fn get_price_precision(env: &Env, asset: &Address) -> Result<u128, HubError> {
        let config = Self::get_asset_config(env, asset)?;
        Ok(10u128.pow(config.decimals))
    }

    fn is_asset_supported(env: &Env, asset: &Address) -> bool {
        for i in 0..10 {
            let key = (symbol_short!("asset"), i);
            if let Some(config) = env.storage().instance().get::<_, AssetConfig>(&key) {
                if config.address == *asset {
                    return true;
                }
            }
        }
        false
    }

    fn add_to_reward_pool(env: &Env, token: &Address, amount: u128) {
        let key = (symbol_short!("rewards"), token.clone());
        let current: u128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
    }

    fn update_user_rewards(env: &Env, user: &Address, btoken: &Address) {
        let mut position = Self::get_user_position(env.clone(), user.clone());
        let current_time = env.ledger().timestamp();
        
        let time_elapsed = current_time - position.last_reward_update;
        let staked_amount = position.staked_lp_tokens.get(btoken.clone()).unwrap_or(0);
        
        if staked_amount > 0 && time_elapsed > 0 {
            let base_rate: u128 = env.storage().instance().get(&symbol_short!("rwd_rate")).unwrap_or(1000);
            let daily_rewards = (staked_amount * base_rate) / 1_000_000; // Base rate per million tokens
            let rewards_earned = (daily_rewards * time_elapsed as u128) / SECONDS_PER_DAY as u128;
            
            position.rewards_earned += rewards_earned;
        }
        
        position.last_reward_update = current_time;
        env.storage().persistent().set(&(symbol_short!("pos"), user), &position);
    }

    fn get_claimable_rewards(env: &Env, user: &Address) -> u128 {
        let position = Self::get_user_position(env.clone(), user.clone());
        position.rewards_earned
    }

    fn distribute_rewards(env: &Env, user: &Address, amount: u128) {
        // For now, distribute rewards in USDC (or most liquid collected fee token)
        // In production, you might want to distribute a mix of collected fees
        let usdc_address = Address::from_string(&String::from_str(env, SUPPORTED_ASSETS[0].0));
        
        let available_rewards: u128 = env.storage()
            .persistent()
            .get(&(symbol_short!("rewards"), usdc_address.clone()))
            .unwrap_or(0);
        
        let reward_amount = amount.min(available_rewards);
        
        if reward_amount > 0 {
            // Transfer rewards to user
            Self::transfer_to_user(env, &usdc_address, user, reward_amount);
            
            // Update reward pool
            env.storage().persistent().set(
                &(symbol_short!("rewards"), usdc_address),
                &(available_rewards - reward_amount)
            );
            
            // Reset user's earned rewards
            let mut position = Self::get_user_position(env.clone(), user.clone());
            position.rewards_earned = position.rewards_earned.saturating_sub(amount);
            env.storage().persistent().set(&(symbol_short!("pos"), user), &position);
        }
    }

    /// Update staking pool state when users stake/unstake
    fn update_staking_pool(env: &Env, btoken: &Address, amount: u128, is_stake: bool) {
        let key = (symbol_short!("pool"), btoken);
        let mut pool = Self::get_staking_pool(env.clone(), btoken.clone());
        let current_time = env.ledger().timestamp();
        
        // Update reward per token before changing total staked
        if pool.total_staked > 0 {
            let time_elapsed = current_time - pool.last_update_time;
            let reward_per_token_increment = (pool.reward_rate * time_elapsed as u128) / pool.total_staked;
            pool.reward_per_token_stored += reward_per_token_increment;
        }
        
        // Update total staked amount
        if is_stake {
            pool.total_staked += amount;
        } else {
            pool.total_staked = pool.total_staked.saturating_sub(amount);
        }
        
        pool.last_update_time = current_time;
        
        // Save updated pool
        env.storage().persistent().set(&key, &pool);
    }

    fn update_staking_position(env: &Env, user: &Address, btoken: &Address, amount: u128, is_stake: bool) {
        let mut position = Self::get_user_position(env.clone(), user.clone());
        let current_staked = position.staked_lp_tokens.get(btoken.clone()).unwrap_or(0);
        if is_stake {
            // Add to current staked amount
            position.staked_lp_tokens.set(btoken.clone(), current_staked + amount);
        } else {
            // Subtract from current staked amount safely
            let new_amount = current_staked.saturating_sub(amount);
            if new_amount == 0 {
                position.staked_lp_tokens.remove(btoken.clone());
            } else {
                position.staked_lp_tokens.set(btoken.clone(), new_amount);
            }
        }
        // Save updated position
        Self::save_user_position(env, user, &position);
    }

    fn transfer_from_user(
        env: &Env,
        token: &Address,
        user: &Address,
        to: &Address,
        amount: u128,
    ) {
        env.invoke_contract::<()>(
            token,
            &symbol_short!("xferfrom"),
            soroban_sdk::vec![
                env,
                user.into_val(env),
                to.into_val(env),
                amount.into_val(env),
            ],
        );
    }

    fn transfer_to_user(
        env: &Env,
        token: &Address,
        user: &Address,
        amount: u128,
    ) {
        env.invoke_contract::<()>(
            token,
            &symbol_short!("transfer"),
            soroban_sdk::vec![
                env,
                user.into_val(env),
                amount.into_val(env),
            ],
        );
    }

    fn update_user_supply_position(
        env: &Env,
        user: &Address,
        asset: &Address,
        amount: u128,
    ) {
        let mut position = Self::get_user_position(env.clone(), user.clone());
        let current = position.supplied_assets.get(asset.clone()).unwrap_or(0);
        position.supplied_assets.set(asset.clone(), current + amount);
        Self::save_user_position(env, user, &position);
    }

    fn update_user_borrow_position(
        env: &Env,
        user: &Address,
        asset: &Address,
        amount: u128,
    ) {
        let mut position = Self::get_user_position(env.clone(), user.clone());
        let current = position.borrowed_assets.get(asset.clone()).unwrap_or(0);
        position.borrowed_assets.set(asset.clone(), current + amount);
        Self::save_user_position(env, user, &position);
    }

    fn save_user_position(
        env: &Env,
        user: &Address,
        position: &UserPosition,
    ) {
        env.storage().persistent().set(&(symbol_short!("pos"), user.clone()), position);
    }

    fn try_dia_oracle(env: &Env, asset: &Address) -> Option<u128> {
        let oracle_config: DIAOracleConfig = env.storage().instance().get(&symbol_short!("oracle"))?;
        let asset_config = match Self::get_asset_config(env, asset) {
            Ok(cfg) => cfg,
            Err(_) => return None,
        };
        let price_result = env.try_invoke_contract::<DIAPriceData, soroban_sdk::xdr::Error>(
            &oracle_config.oracle_address,
            &symbol_short!("getValue"),
            soroban_sdk::vec![env, asset_config.dia_symbol.into_val(env)],
        );
        if let Ok(Ok(price_data)) = price_result {
            let price_age = env.ledger().timestamp() - price_data.timestamp;
            if price_age <= oracle_config.max_price_age {
                let normalized_price = if asset_config.decimals < 8 {
                    price_data.price / (10u128.pow(8 - asset_config.decimals))
                } else {
                    price_data.price * (10u128.pow(asset_config.decimals - 8))
                };
                return Some(normalized_price);
            }
        }
        None
    }

    fn get_dex_price(env: &Env, asset: &Address) -> Option<u128> {
        let usdc_address = Address::from_string(&String::from_str(env, SUPPORTED_ASSETS[0].0));
        if *asset == usdc_address {
            return Some(Self::get_asset_base_price(env, asset).unwrap_or_else(|_| panic!("Price unavailable")));
        }
        let test_amount = 1_000_000u128;
        if let Some(dex_info) = Self::simulate_dex_swap(env, asset, &usdc_address, test_amount) {
            if dex_info.liquidity > 10_000_000_000 && dex_info.price > 0 {
                return Some(dex_info.price);
            }
        }
        if let Some(reverse_info) = Self::simulate_dex_swap(env, &usdc_address, asset, test_amount) {
            if reverse_info.liquidity > 10_000_000_000 && reverse_info.price > 0 {
                let inverse_price = (test_amount * test_amount) / reverse_info.price;
                return Some(inverse_price);
            }
        }
        None
    }


    fn simulate_dex_swap(
        env: &Env,
        token_in: &Address,
        token_out: &Address,
        amount_in: u128
    ) -> Option<DexPriceInfo> {
        let router_address = Address::from_string(&String::from_str(env, SOROSWAP_ROUTER));
        let quote_result = env.try_invoke_contract::<(u128, u128), soroban_sdk::xdr::Error>(
            &router_address,
            &symbol_short!("get_quote"),
            soroban_sdk::vec![
                env,
                amount_in.into_val(env),
                token_in.into_val(env),
                token_out.into_val(env),
            ],
        );
        if let Ok(Ok((amount_out, liquidity))) = quote_result {
            return Some(DexPriceInfo {
                price: amount_out,
                liquidity,
                last_trade_time: env.ledger().timestamp(),
            });
        }
        None
    }

    fn get_admin_price(env: &Env, asset: &Address) -> Option<u128> {
        let key = (symbol_short!("price"), asset);
        let price_data = env.storage().persistent().get::<_, (u128, u64)>(&key)?;
        let (price, set_time) = price_data;
        let age = env.ledger().timestamp() - set_time;
        if age <= 86400 {
            Some(price)
        } else {
            None
        }
    }

    fn get_mock_price(env: &Env, asset: &Address) -> Option<u128> {
        let asset_config = match Self::get_asset_config(env, asset) {
            Ok(cfg) => cfg,
            Err(_) => return None,
        };
        let symbol = &asset_config.symbol;
        let price = if *symbol == String::from_str(env, "USDC") {
            100_000_000
        } else if *symbol == String::from_str(env, "USDT") {
            100_000_000
        } else if *symbol == String::from_str(env, "XLM") {
            12_000_000
        } else if *symbol == String::from_str(env, "BTC") {
            4_300_000_000_000
        } else if *symbol == String::from_str(env, "ETH") {
            260_000_000_000
        } else if *symbol == String::from_str(env, "AQUA") {
            5_000_000
        } else if *symbol == String::from_str(env, "VELO") {
            8_000_000
        } else if *symbol == String::from_str(env, "SHX") {
            15_000_000
        } else if *symbol == String::from_str(env, "WXT") {
            3_000_000
        } else if *symbol == String::from_str(env, "RIO") {
            25_000_000
        } else if *symbol == String::from_str(env, "BLND") {
            45_000_000
        } else {
            return None;
        };
        let normalized_price = if asset_config.decimals < 8 {
            price / (10u128.pow(8 - asset_config.decimals))
        } else {
            price * (10u128.pow(asset_config.decimals - 8))
        };
        Some(normalized_price)
    }

    fn select_best_price(_env: &Env, price_sources: Vec<PriceSource>) -> Option<u128> {
        if price_sources.is_empty() {
            return None;
        }
        if price_sources.len() == 1 {
            return Some(price_sources.get(0).unwrap().price);
        }
        let mut sorted_sources = price_sources.clone();
        for i in 0..sorted_sources.len() {
            for j in (i + 1)..sorted_sources.len() {
                if sorted_sources.get(i).unwrap().confidence < sorted_sources.get(j).unwrap().confidence {
                    let temp = sorted_sources.get(i).unwrap();
                    sorted_sources.set(i, sorted_sources.get(j).unwrap());
                    sorted_sources.set(j, temp);
                }
            }
        }
        let best = sorted_sources.get(0).unwrap();
        if sorted_sources.len() == 1 || best.confidence >= 90 {
            return Some(best.price);
        }
        let second_best = sorted_sources.get(1).unwrap();
        let price_diff = if best.price > second_best.price {
            (best.price - second_best.price) * 100 / best.price
        } else {
            (second_best.price - best.price) * 100 / second_best.price
        };
        if price_diff <= 5 {
            let total_confidence = best.confidence + second_best.confidence;
            let weighted_price = (best.price * best.confidence as u128 +
                                 second_best.price * second_best.confidence as u128) /
                                 total_confidence as u128;
            Some(weighted_price)
        } else {
            Some(best.price)
        }
    }

    fn get_asset_base_price(env: &Env, asset: &Address) -> Result<u128, HubError> {
        let config = Self::get_asset_config(env, asset)?;
        Ok(10u128.pow(config.decimals))
    }

    pub fn set_emergency_price(
        env: Env,
        admin: Address,
        asset: Address,
        price: u128,
    ) {
        admin.require_auth();
        let stored_admin: Address = env.storage().instance().get(&symbol_short!("admin")).unwrap();
        assert_eq!(admin, stored_admin, "Only admin can set emergency prices");
        assert!(Self::is_asset_supported(&env, &asset), "Asset not supported");
        let key = (symbol_short!("price"), asset.clone());
        env.storage().persistent().set(&key, &(price, env.ledger().timestamp()));
        env.events().publish(
            (symbol_short!("emrgprc"), &admin),
            (asset, price, env.ledger().timestamp())
        );
    }

    pub fn get_price_sources(env: Env, asset: Address) -> Vec<PriceSource> {
        let mut sources = Vec::new(&env);
        if let Some(oracle_price) = Self::try_dia_oracle(&env, &asset) {
            sources.push_back(PriceSource {
                source_type: String::from_str(&env, "oracle"),
                price: oracle_price,
                timestamp: env.ledger().timestamp(),
                confidence: 90,
            });
        }
        if let Some(dex_price) = Self::get_dex_price(&env, &asset) {
            sources.push_back(PriceSource {
                source_type: String::from_str(&env, "dex"),
                price: dex_price,
                timestamp: env.ledger().timestamp(),
                confidence: 85,
            });
        }
        if let Some(admin_price) = Self::get_admin_price(&env, &asset) {
            sources.push_back(PriceSource {
                source_type: String::from_str(&env, "admin"),
                price: admin_price,
                timestamp: env.ledger().timestamp(),
                confidence: 70,
            });
        }
        if let Some(mock_price) = Self::get_mock_price(&env, &asset) {
            sources.push_back(PriceSource {
                source_type: String::from_str(&env, "mock"),
                price: mock_price,
                timestamp: env.ledger().timestamp(),
                confidence: 50,
            });
        }
        sources
    }
}