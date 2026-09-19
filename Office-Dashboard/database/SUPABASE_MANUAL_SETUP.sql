-- Hair Rap by YOYO — Complete Database Setup
-- Phase 1 + Phase 2 (WhatsApp Session Management)
-- Run this against your Supabase/PostgreSQL database
-- Generated: 2026-09-15

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- PHASE 1 ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
CREATE TYPE user_status AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE phone_status AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'INACTIVE', 'LOGIN_ISSUE', 'SUSPENDED', 'UNKNOWN');
CREATE TYPE recovery_method_type AS ENUM ('EMAIL', 'PHONE');
CREATE TYPE relationship_type AS ENUM ('GENERAL', 'LOGIN', 'RECOVERY');

-- ============================================================
-- PHASE 2 ENUMS
-- ============================================================

CREATE TYPE device_status AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED');
CREATE TYPE whatsapp_session_status AS ENUM ('SETUP_REQUIRED', 'LINKING', 'LINKED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN');

-- ============================================================
-- PHASE 1 TABLES
-- ============================================================

-- App Users table
CREATE TABLE app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(120) NOT NULL,
    email CITEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role user_role NOT NULL DEFAULT 'VIEWER',
    status user_status NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phone Numbers table
CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    e164_number VARCHAR(20) NOT NULL UNIQUE,
    country_code VARCHAR(5) NOT NULL,
    national_number VARCHAR(20) NOT NULL,
    sim_provider VARCHAR(80),
    label VARCHAR(120),
    status phone_status NOT NULL DEFAULT 'ACTIVE',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES app_users(id),
    updated_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Platforms table
CREATE TABLE platforms (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(40) NOT NULL UNIQUE,
    display_name VARCHAR(80) NOT NULL,
    icon_key VARCHAR(80),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Platform Accounts table
CREATE TABLE platform_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_id INTEGER NOT NULL REFERENCES platforms(id),
    display_name VARCHAR(160),
    account_handle VARCHAR(160),
    login_identifier CITEXT,
    profile_url TEXT,
    external_account_id VARCHAR(160),
    account_status account_status NOT NULL DEFAULT 'UNKNOWN',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES app_users(id),
    updated_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMPTZ
);

-- Phone-Account Links table
CREATE TABLE phone_account_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number_id UUID NOT NULL REFERENCES phone_numbers(id) ON DELETE CASCADE,
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    relationship_type relationship_type NOT NULL DEFAULT 'GENERAL',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    linked_by UUID NOT NULL REFERENCES app_users(id),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phone_number_id, platform_account_id, relationship_type)
);

-- Account Credentials table
CREATE TABLE account_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_account_id UUID NOT NULL UNIQUE REFERENCES platform_accounts(id) ON DELETE CASCADE,
    password_ciphertext TEXT NOT NULL,
    nonce TEXT NOT NULL,
    auth_tag TEXT,
    key_version INTEGER NOT NULL,
    secret_updated_by UUID NOT NULL REFERENCES app_users(id),
    secret_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Account Recovery Methods table
CREATE TABLE account_recovery_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_account_id UUID NOT NULL REFERENCES platform_accounts(id) ON DELETE CASCADE,
    method_type recovery_method_type NOT NULL,
    value_normalized TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit Logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID REFERENCES app_users(id),
    action TEXT NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PHASE 2 TABLES
-- ============================================================

-- Registered Devices table
CREATE TABLE registered_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_code VARCHAR(20) NOT NULL UNIQUE,
    friendly_name VARCHAR(120) NOT NULL,
    hostname VARCHAR(255),
    status device_status NOT NULL DEFAULT 'UNKNOWN',
    launcher_version VARCHAR(40),
    launcher_api_key_hash TEXT,
    last_seen_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Sessions table
CREATE TABLE whatsapp_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_code VARCHAR(20) NOT NULL UNIQUE,
    phone_number_id UUID NOT NULL UNIQUE REFERENCES phone_numbers(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES registered_devices(id),
    status whatsapp_session_status NOT NULL DEFAULT 'SETUP_REQUIRED',
    session_directory VARCHAR(500) NOT NULL,
    linked_at TIMESTAMPTZ,
    last_opened_at TIMESTAMPTZ,
    last_error TEXT,
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- WhatsApp Audit Logs table
CREATE TABLE whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_session_id UUID REFERENCES whatsapp_sessions(id),
    device_id UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    actor_user_id UUID REFERENCES app_users(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PHASE 1 INDEXES
-- ============================================================

CREATE INDEX idx_phone_numbers_status ON phone_numbers(status);
CREATE INDEX idx_platform_accounts_platform_status ON platform_accounts(platform_id, account_status);
CREATE INDEX idx_platform_accounts_login_identifier ON platform_accounts(login_identifier);
CREATE INDEX idx_phone_account_links_account ON phone_account_links(platform_account_id);
CREATE INDEX idx_phone_account_links_phone ON phone_account_links(phone_number_id);
CREATE INDEX idx_recovery_methods_account ON account_recovery_methods(platform_account_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at);

-- ============================================================
-- PHASE 2 INDEXES
-- ============================================================

CREATE INDEX idx_wa_audit_logs_created_at ON whatsapp_audit_logs(created_at);
CREATE INDEX idx_wa_audit_logs_action ON whatsapp_audit_logs(action);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Seed Platforms
INSERT INTO platforms (slug, display_name, icon_key, is_active) VALUES
    ('instagram', 'Instagram', 'instagram', true),
    ('facebook', 'Facebook', 'facebook', true),
    ('whatsapp', 'WhatsApp', 'whatsapp', true),
    ('telegram', 'Telegram', 'telegram', true),
    ('tiktok', 'TikTok', 'tiktok', true),
    ('youtube', 'YouTube', 'youtube', true),
    ('twitter', 'Twitter/X', 'twitter', true),
    ('snapchat', 'Snapchat', 'snapchat', true);

-- Seed Admin User (password: admin123 - change in production!)
-- Password hash is for argon2id of 'admin123'
INSERT INTO app_users (id, full_name, email, password_hash, role, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'System Admin', 'admin@hairrap.com', '$argon2id$v=19$m=65536,t=3,p=4$placeholder_hash_change_me', 'ADMIN', 'ACTIVE');

-- ============================================================
-- GRANTS (Supabase specific - adjust for your setup)
-- ============================================================

-- Grant usage on schemas to authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app_users IS 'Dashboard users with role-based access';
COMMENT ON TABLE phone_numbers IS 'Phone numbers managed by Hair Rap';
COMMENT ON TABLE platforms IS 'Social media platforms (seed data)';
COMMENT ON TABLE platform_accounts IS 'Accounts on social platforms';
COMMENT ON TABLE phone_account_links IS 'Links between phone numbers and platform accounts';
COMMENT ON TABLE account_credentials IS 'Encrypted credentials for platform accounts';
COMMENT ON TABLE account_recovery_methods IS 'Recovery methods for platform accounts';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail';
COMMENT ON TABLE registered_devices IS 'PCs running the Hair Rap launcher';
COMMENT ON TABLE whatsapp_sessions IS 'WhatsApp Web session mappings';
COMMENT ON TABLE whatsapp_audit_logs IS 'WhatsApp-specific audit trail';

COMMENT ON COLUMN registered_devices.device_code IS 'Human-readable code (PC-01, PC-02)';
COMMENT ON COLUMN registered_devices.launcher_api_key_hash IS 'Hashed API key - raw key shown once at registration';
COMMENT ON COLUMN whatsapp_sessions.session_code IS 'Auto-generated code (HR-WA-0001)';
COMMENT ON COLUMN whatsapp_sessions.session_directory IS 'Isolated Chrome user-data directory path';
