-- Hair Rap by YOYO — Database Verification Script
-- Run this after SUPABASE_MANUAL_SETUP.sql to verify everything was created correctly
-- Generated: 2026-09-15

-- ============================================================
-- VERIFY EXTENSIONS
-- ============================================================

SELECT 
    extname AS extension_name,
    extversion AS version
FROM pg_extension 
WHERE extname IN ('uuid-ossp', 'citext')
ORDER BY extname;

-- Expected: 2 rows (uuid-ossp, citext)

-- ============================================================
-- VERIFY ENUMS
-- ============================================================

SELECT 
    t.typname AS enum_name,
    e.enumlabel AS enum_value,
    e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN (
    'user_role', 'user_status', 'phone_status', 
    'account_status', 'recovery_method_type', 'relationship_type',
    'device_status', 'whatsapp_session_status'
)
ORDER BY t.typname, e.enumsortorder;

-- Expected: 24 rows total
-- user_role: ADMIN, EDITOR, VIEWER (3)
-- user_status: ACTIVE, DISABLED (2)
-- phone_status: ACTIVE, INACTIVE, ARCHIVED (3)
-- account_status: ACTIVE, INACTIVE, LOGIN_ISSUE, SUSPENDED, UNKNOWN (5)
-- recovery_method_type: EMAIL, PHONE (2)
-- relationship_type: GENERAL, LOGIN, RECOVERY (3)
-- device_status: ONLINE, OFFLINE, UNKNOWN, DISABLED (4)
-- whatsapp_session_status: SETUP_REQUIRED, LINKING, LINKED, RELOGIN_REQUIRED, DISABLED, ERROR, UNKNOWN (7)

-- ============================================================
-- VERIFY TABLES
-- ============================================================

SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'app_users', 'phone_numbers', 'platforms', 'platform_accounts',
        'phone_account_links', 'account_credentials', 'account_recovery_methods',
        'audit_logs', 'registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs'
    )
ORDER BY table_name;

-- Expected: 11 rows

-- ============================================================
-- VERIFY COLUMNS - Phase 1 Tables
-- ============================================================

-- app_users columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'app_users'
ORDER BY ordinal_position;

-- phone_numbers columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'phone_numbers'
ORDER BY ordinal_position;

-- platforms columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platforms'
ORDER BY ordinal_position;

-- platform_accounts columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'platform_accounts'
ORDER BY ordinal_position;

-- ============================================================
-- VERIFY COLUMNS - Phase 2 Tables
-- ============================================================

-- registered_devices columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'registered_devices'
ORDER BY ordinal_position;

-- whatsapp_sessions columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'whatsapp_sessions'
ORDER BY ordinal_position;

-- whatsapp_audit_logs columns
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'whatsapp_audit_logs'
ORDER BY ordinal_position;

-- ============================================================
-- VERIFY INDEXES
-- ============================================================

SELECT 
    indexname,
    tablename,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'phone_numbers', 'platform_accounts', 'phone_account_links',
        'account_recovery_methods', 'audit_logs', 'whatsapp_audit_logs'
    )
ORDER BY tablename, indexname;

-- Expected indexes:
-- idx_phone_numbers_status
-- idx_platform_accounts_platform_status
-- idx_platform_accounts_login_identifier
-- idx_phone_account_links_account
-- idx_phone_account_links_phone
-- idx_recovery_methods_account
-- idx_audit_logs_created_at
-- idx_audit_logs_actor
-- idx_audit_logs_entity
-- idx_wa_audit_logs_created_at
-- idx_wa_audit_logs_action

-- ============================================================
-- VERIFY FOREIGN KEYS
-- ============================================================

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================
-- VERIFY UNIQUE CONSTRAINTS
-- ============================================================

SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================================
-- VERIFY PLATFORM SEEDS
-- ============================================================

SELECT 
    id,
    slug,
    display_name,
    icon_key,
    is_active
FROM platforms
ORDER BY id;

-- Expected: 8 rows
-- 1 | instagram | Instagram | instagram | true
-- 2 | facebook | Facebook | facebook | true
-- 3 | whatsapp | WhatsApp | whatsapp | true
-- 4 | telegram | Telegram | telegram | true
-- 5 | tiktok | TikTok | tiktok | true
-- 6 | youtube | YouTube | youtube | true
-- 7 | twitter | Twitter/X | twitter | true
-- 8 | snapchat | Snapchat | snapchat | true

-- ============================================================
-- VERIFY ADMIN USER
-- ============================================================

SELECT 
    id,
    full_name,
    email,
    role,
    status,
    created_at
FROM app_users
WHERE email = 'admin@hairrap.com';

-- Expected: 1 row
-- id: 00000000-0000-0000-0000-000000000001
-- full_name: System Admin
-- role: ADMIN
-- status: ACTIVE

-- ============================================================
-- VERIFY PHASE 2 TABLES ARE PROPERLY LINKED
-- ============================================================

-- Check whatsapp_sessions links to phone_numbers
SELECT 
    ws.id AS session_id,
    ws.session_code,
    pn.e164_number,
    pn.status AS phone_status,
    ws.status AS wa_status
FROM whatsapp_sessions ws
JOIN phone_numbers pn ON ws.phone_number_id = pn.id
LIMIT 5;

-- Check whatsapp_sessions links to registered_devices
SELECT 
    ws.id AS session_id,
    ws.session_code,
    rd.device_code,
    rd.friendly_name,
    rd.status AS device_status,
    ws.status AS wa_status
FROM whatsapp_sessions ws
JOIN registered_devices rd ON ws.device_id = rd.id
LIMIT 5;

-- ============================================================
-- COUNT SYNTHETIC TEST DATA (if seeded)
-- ============================================================

SELECT 'app_users' AS table_name, COUNT(*) AS row_count FROM app_users
UNION ALL
SELECT 'phone_numbers', COUNT(*) FROM phone_numbers
UNION ALL
SELECT 'platforms', COUNT(*) FROM platforms
UNION ALL
SELECT 'platform_accounts', COUNT(*) FROM platform_accounts
UNION ALL
SELECT 'phone_account_links', COUNT(*) FROM phone_account_links
UNION ALL
SELECT 'account_credentials', COUNT(*) FROM account_credentials
UNION ALL
SELECT 'account_recovery_methods', COUNT(*) FROM account_recovery_methods
UNION ALL
SELECT 'audit_logs', COUNT(*) FROM audit_logs
UNION ALL
SELECT 'registered_devices', COUNT(*) FROM registered_devices
UNION ALL
SELECT 'whatsapp_sessions', COUNT(*) FROM whatsapp_sessions
UNION ALL
SELECT 'whatsapp_audit_logs', COUNT(*) FROM whatsapp_audit_logs
ORDER BY table_name;

-- ============================================================
-- VERIFY TABLE COMMENTS
-- ============================================================

SELECT 
    c.relname AS table_name,
    pgd.description AS table_comment
FROM pg_class c
LEFT JOIN pg_description pgd ON pgd.objoid = c.oid AND pgd.objsubid = 0
WHERE c.relname IN (
    'app_users', 'phone_numbers', 'platforms', 'platform_accounts',
    'phone_account_links', 'account_credentials', 'account_recovery_methods',
    'audit_logs', 'registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs'
)
ORDER BY c.relname;

-- ============================================================
-- SUMMARY
-- ============================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_enum_count INTEGER;
    v_index_count INTEGER;
    v_fk_count INTEGER;
    v_platform_count INTEGER;
    v_admin_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
        AND table_name IN (
            'app_users', 'phone_numbers', 'platforms', 'platform_accounts',
            'phone_account_links', 'account_credentials', 'account_recovery_methods',
            'audit_logs', 'registered_devices', 'whatsapp_sessions', 'whatsapp_audit_logs'
        );
    
    -- Count enums
    SELECT COUNT(DISTINCT t.typname) INTO v_enum_count
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN (
        'user_role', 'user_status', 'phone_status', 
        'account_status', 'recovery_method_type', 'relationship_type',
        'device_status', 'whatsapp_session_status'
    );
    
    -- Count indexes
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%';
    
    -- Count foreign keys
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = 'public';
    
    -- Count platforms
    SELECT COUNT(*) INTO v_platform_count FROM platforms;
    
    -- Count admin users
    SELECT COUNT(*) INTO v_admin_count FROM app_users WHERE role = 'ADMIN';
    
    RAISE NOTICE '=== VERIFICATION SUMMARY ===';
    RAISE NOTICE 'Tables: % (expected: 11)', v_table_count;
    RAISE NOTICE 'Enums: % (expected: 8)', v_enum_count;
    RAISE NOTICE 'Indexes: % (expected: >= 11)', v_index_count;
    RAISE NOTICE 'Foreign Keys: % (expected: >= 15)', v_fk_count;
    RAISE NOTICE 'Platforms seeded: % (expected: 8)', v_platform_count;
    RAISE NOTICE 'Admin users: % (expected: >= 1)', v_admin_count;
    
    IF v_table_count = 11 AND v_enum_count = 8 AND v_platform_count = 8 AND v_admin_count >= 1 THEN
        RAISE NOTICE '✅ ALL VERIFICATIONS PASSED';
    ELSE
        RAISE WARNING '❌ SOME VERIFICATIONS FAILED - Check results above';
    END IF;
END $$;
