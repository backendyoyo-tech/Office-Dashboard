-- Hair Rap by YOYO — Database Rollback Script
-- Phase 2 ONLY — Drops all Phase 2 tables and enums
-- WARNING: This will delete all WhatsApp session data!
-- Phase 1 rollback requires separate approval
-- Generated: 2026-09-15

-- ============================================================
-- SAFETY CHECK
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'WARNING: Phase 2 Rollback Script';
    RAISE NOTICE 'This will DROP all Phase 2 tables!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Tables to be dropped:';
    RAISE NOTICE '  - whatsapp_audit_logs';
    RAISE NOTICE '  - whatsapp_sessions';
    RAISE NOTICE '  - registered_devices';
    RAISE NOTICE '';
    RAISE NOTICE 'Enums to be dropped:';
    RAISE NOTICE '  - whatsapp_session_status';
    RAISE NOTICE '  - device_status';
    RAISE NOTICE '';
    RAISE NOTICE 'Press Ctrl+C within 5 seconds to cancel...';
    PERFORM pg_sleep(5);
END $$;

-- ============================================================
-- DROP PHASE 2 TABLES (reverse dependency order)
-- ============================================================

-- Drop whatsapp_audit_logs first (depends on whatsapp_sessions and registered_devices)
DROP TABLE IF EXISTS whatsapp_audit_logs CASCADE;

-- Drop whatsapp_sessions (depends on phone_numbers and registered_devices)
DROP TABLE IF EXISTS whatsapp_sessions CASCADE;

-- Drop registered_devices (depends on app_users)
DROP TABLE IF EXISTS registered_devices CASCADE;

-- ============================================================
-- DROP PHASE 2 ENUMS
-- ============================================================

DROP TYPE IF EXISTS whatsapp_session_status CASCADE;
DROP TYPE IF EXISTS device_status CASCADE;

-- ============================================================
-- VERIFY ROLLBACK
-- ============================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_enum_count INTEGER;
BEGIN
    -- Verify Phase 2 tables are gone
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN ('registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs');
    
    -- Verify Phase 2 enums are gone
    SELECT COUNT(DISTINCT t.typname) INTO v_enum_count
    FROM pg_type t
    WHERE t.typname IN ('device_status', 'whatsapp_session_status');
    
    IF v_table_count = 0 AND v_enum_count = 0 THEN
        RAISE NOTICE '✅ Phase 2 rollback completed successfully';
        RAISE NOTICE '   All Phase 2 tables and enums have been removed';
    ELSE
        RAISE WARNING '❌ Phase 2 rollback may have issues';
        RAISE WARNING '   Remaining Phase 2 tables: %', v_table_count;
        RAISE WARNING '   Remaining Phase 2 enums: %', v_enum_count;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Phase 1 tables remain intact.';
    RAISE NOTICE 'To rollback Phase 1, use a separate approved script.';
END $$;

-- ============================================================
-- AUDIT LOG (optional - log the rollback)
-- ============================================================

-- Uncomment if you want to log the rollback action
-- INSERT INTO audit_logs (actor_user_id, action, entity_type, metadata)
-- VALUES (
--     NULL,
--     'PHASE2_ROLLBACK',
--     'DATABASE',
--     '{"script": "SUPABASE_ROLLBACK.sql", "tables_dropped": ["whatsapp_audit_logs", "whatsapp_sessions", "registered_devices"], "enums_dropped": ["whatsapp_session_status", "device_status"]}'::jsonb
-- );
