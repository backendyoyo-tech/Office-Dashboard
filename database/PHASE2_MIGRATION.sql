-- Hair Rap by YOYO — Phase 2 Migration Script
-- For upgrading existing Phase 1 database to include WhatsApp session management
-- This script ONLY adds Phase 2 tables — does NOT modify existing Phase 1 tables
-- Generated: 2026-09-15

-- ============================================================
-- PREREQUISITES CHECK
-- ============================================================

DO $$
BEGIN
    -- Verify Phase 1 tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'app_users' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Phase 1 table app_users not found. Run SUPABASE_MANUAL_SETUP.sql first.';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'phone_numbers' AND table_schema = 'public') THEN
        RAISE EXCEPTION 'Phase 1 table phone_numbers not found. Run SUPABASE_MANUAL_SETUP.sql first.';
    END IF;
    
    -- Verify uuid-ossp extension
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        RAISE EXCEPTION 'uuid-ossp extension not found. Enable it first.';
    END IF;
    
    RAISE NOTICE '✅ Phase 1 prerequisites verified';
END $$;

-- ============================================================
-- PHASE 2 ENUMS
-- ============================================================

-- Device status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_status') THEN
        CREATE TYPE device_status AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN', 'DISABLED');
        RAISE NOTICE 'Created enum: device_status';
    ELSE
        RAISE NOTICE 'Enum device_status already exists, skipping';
    END IF;
END $$;

-- WhatsApp session status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_session_status') THEN
        CREATE TYPE whatsapp_session_status AS ENUM ('SETUP_REQUIRED', 'LINKING', 'LINKED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN');
        RAISE NOTICE 'Created enum: whatsapp_session_status';
    ELSE
        RAISE NOTICE 'Enum whatsapp_session_status already exists, skipping';
    END IF;
END $$;

-- ============================================================
-- PHASE 2 TABLES
-- ============================================================

-- Registered Devices table
CREATE TABLE IF NOT EXISTS registered_devices (
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

RAISE NOTICE 'Created table: registered_devices';

-- WhatsApp Sessions table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
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

RAISE NOTICE 'Created table: whatsapp_sessions';

-- WhatsApp Audit Logs table
CREATE TABLE IF NOT EXISTS whatsapp_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_session_id UUID REFERENCES whatsapp_sessions(id),
    device_id UUID REFERENCES registered_devices(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    actor_user_id UUID REFERENCES app_users(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

RAISE NOTICE 'Created table: whatsapp_audit_logs';

-- ============================================================
-- PHASE 2 INDEXES
-- ============================================================

-- WhatsApp audit logs indexes
CREATE INDEX IF NOT EXISTS idx_wa_audit_logs_created_at ON whatsapp_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_wa_audit_logs_action ON whatsapp_audit_logs(action);

RAISE NOTICE 'Created Phase 2 indexes';

-- ============================================================
-- TABLE COMMENTS
-- ============================================================

COMMENT ON TABLE registered_devices IS 'PCs running the Hair Rap launcher';
COMMENT ON COLUMN registered_devices.device_code IS 'Human-readable code (PC-01, PC-02)';
COMMENT ON COLUMN registered_devices.launcher_api_key_hash IS 'Hashed API key - raw key shown once at registration';

COMMENT ON TABLE whatsapp_sessions IS 'WhatsApp Web session mappings';
COMMENT ON COLUMN whatsapp_sessions.session_code IS 'Auto-generated code (HR-WA-0001)';
COMMENT ON COLUMN whatsapp_sessions.session_directory IS 'Isolated Chrome user-data directory path';

COMMENT ON TABLE whatsapp_audit_logs IS 'WhatsApp-specific audit trail';

RAISE NOTICE 'Added table comments';

-- ============================================================
-- GRANTS (Supabase specific)
-- ============================================================

-- Grant permissions to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON registered_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_audit_logs TO authenticated;

-- Grant select to anon role
GRANT SELECT ON registered_devices TO anon;
GRANT SELECT ON whatsapp_sessions TO anon;
GRANT SELECT ON whatsapp_audit_logs TO anon;

RAISE NOTICE 'Granted permissions';

-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_enum_count INTEGER;
    v_index_count INTEGER;
BEGIN
    -- Count Phase 2 tables
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs');
    
    -- Count Phase 2 enums
    SELECT COUNT(DISTINCT t.typname) INTO v_enum_count
    FROM pg_type t
    WHERE t.typname IN ('device_status', 'whatsapp_session_status');
    
    -- Count Phase 2 indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND indexname LIKE 'idx_wa_%';
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Phase 2 Migration Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables created: % (expected: 3)', v_table_count;
    RAISE NOTICE 'Enums created: % (expected: 2)', v_enum_count;
    RAISE NOTICE 'Indexes created: % (expected: 2)', v_index_count;
    
    IF v_table_count = 3 AND v_enum_count = 2 THEN
        RAISE NOTICE '✅ Phase 2 migration successful!';
        RAISE NOTICE '';
        RAISE NOTICE 'Next steps:';
        RAISE NOTICE '1. Verify with: SELECT * FROM registered_devices;';
        RAISE NOTICE '2. Register your first device via the dashboard';
        RAISE NOTICE '3. Create WhatsApp sessions for phone numbers';
    ELSE
        RAISE WARNING '❌ Phase 2 migration may have issues - check output above';
    END IF;
END $$;
