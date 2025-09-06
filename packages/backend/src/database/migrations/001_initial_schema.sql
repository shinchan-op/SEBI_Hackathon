-- Initial database schema for SEBI Fractional Bond Marketplace
-- This migration creates all core tables for the trading system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bonds table - core bond information
CREATE TABLE bonds (
    id SERIAL PRIMARY KEY,
    isin VARCHAR(20) UNIQUE NOT NULL,
    issuer VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    coupon DECIMAL(5,2) NOT NULL, -- % annual coupon
    maturity_date DATE NOT NULL,
    face_value DECIMAL(15,2) NOT NULL, -- e.g., 1,000,000
    fraction_size DECIMAL(15,2) NOT NULL, -- e.g., 1,000
    rating VARCHAR(10) NOT NULL, -- e.g., AAA
    issue_size DECIMAL(15,2), -- in crores
    listing_source VARCHAR(50), -- NSE/BSE/INX
    last_traded_price DECIMAL(8,4), -- % of face
    last_traded_yield DECIMAL(8,4),
    days_since_last_trade INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    kyc_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
    kyc_data_ref VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    pan_number VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolios table
CREATE TABLE portfolios (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    cash_balance DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Positions table - user holdings
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    portfolio_id INTEGER REFERENCES portfolios(id) ON DELETE CASCADE,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    qty_units INTEGER NOT NULL DEFAULT 0,
    avg_price_per_unit DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(portfolio_id, bond_id)
);

-- Orders table
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type VARCHAR(6) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT')),
    price_limit DECIMAL(15,2), -- nullable for market orders
    qty_units INTEGER NOT NULL,
    qty_filled_units INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'PARTIAL')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trades table
CREATE TABLE trades (
    id SERIAL PRIMARY KEY,
    buy_order_id INTEGER REFERENCES orders(id),
    sell_order_id INTEGER REFERENCES orders(id),
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    price_per_unit DECIMAL(15,2) NOT NULL,
    qty_units INTEGER NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trade_receipt_json JSONB NOT NULL
);

-- SIP Plans table
CREATE TABLE sip_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount_per_period DECIMAL(15,2) NOT NULL,
    frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('WEEKLY', 'MONTHLY')),
    target_bond_id INTEGER REFERENCES bonds(id),
    target_bucket_id VARCHAR(50), -- for diversified SIPs
    next_run_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lending Offers table
CREATE TABLE lending_offers (
    id SERIAL PRIMARY KEY,
    lender_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    qty_units INTEGER NOT NULL,
    fee_rate_per_annum DECIMAL(8,4) NOT NULL, -- as decimal (e.g., 0.05 for 5%)
    min_tenor_days INTEGER NOT NULL,
    collateral_type VARCHAR(20) DEFAULT 'CASH' CHECK (collateral_type IN ('CASH', 'SECURITIES')),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FILLED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Repo Positions table
CREATE TABLE repo_positions (
    id SERIAL PRIMARY KEY,
    borrower_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lender_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    qty_units INTEGER NOT NULL,
    collateral_amount DECIMAL(15,2) NOT NULL,
    fee_rate DECIMAL(8,4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'DEFAULTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs table
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    payload_json JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_service VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    bond_id INTEGER REFERENCES bonds(id)
);

-- Market Perception Index (MPI) metrics
CREATE TABLE mpi_metrics (
    id SERIAL PRIMARY KEY,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    page_views INTEGER DEFAULT 0,
    watchlist_count INTEGER DEFAULT 0,
    order_depth INTEGER DEFAULT 0,
    executed_volume_velocity DECIMAL(15,2) DEFAULT 0,
    computed_mpi DECIMAL(5,4) DEFAULT 0, -- 0 to 1 scale
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Maker registrations
CREATE TABLE market_makers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    tier VARCHAR(20) DEFAULT 'BRONZE' CHECK (tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
    min_spread_bps INTEGER DEFAULT 10, -- minimum spread in basis points
    min_size_units INTEGER DEFAULT 1000,
    obligation_hours JSONB, -- {"start": "09:00", "end": "17:00", "timezone": "IST"}
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SIP Pool balances for recycling
CREATE TABLE sip_pool_balances (
    id SERIAL PRIMARY KEY,
    bond_id INTEGER REFERENCES bonds(id) ON DELETE CASCADE,
    total_sip_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    reserved_for_recycling DECIMAL(15,2) NOT NULL DEFAULT 0,
    available_for_recycling DECIMAL(15,2) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_bonds_isin ON bonds(isin);
CREATE INDEX idx_bonds_rating ON bonds(rating);
CREATE INDEX idx_bonds_maturity ON bonds(maturity_date);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_bond_id ON orders(bond_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_trades_bond_id ON trades(bond_id);
CREATE INDEX idx_trades_executed_at ON trades(executed_at);
CREATE INDEX idx_positions_portfolio_id ON positions(portfolio_id);
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_mpi_metrics_bond_id ON mpi_metrics(bond_id);
CREATE INDEX idx_mpi_metrics_timestamp ON mpi_metrics(timestamp);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_bonds_updated_at BEFORE UPDATE ON bonds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sip_plans_updated_at BEFORE UPDATE ON sip_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lending_offers_updated_at BEFORE UPDATE ON lending_offers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_repo_positions_updated_at BEFORE UPDATE ON repo_positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_makers_updated_at BEFORE UPDATE ON market_makers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
