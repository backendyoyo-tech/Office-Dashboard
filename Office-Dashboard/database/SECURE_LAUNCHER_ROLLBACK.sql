-- MANUAL ONLY, after backup and explicit release-owner review.
-- This removes only the secure-launcher extension. The original WhatsApp
-- primary table, session_directory, and Phase 1 account records remain.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM launch_tickets)
    OR EXISTS (SELECT 1 FROM launch_grants)
    OR EXISTS (SELECT 1 FROM device_platform_sessions)
    OR EXISTS (SELECT 1 FROM whatsapp_device_sessions WHERE NOT legacy_primary)
  THEN
    RAISE EXCEPTION 'Rollback refused: active secure-launcher data exists';
  END IF;
END $$;

DROP TABLE launch_tickets;
DROP TABLE launch_grants;
DROP TABLE device_platform_sessions;
DROP TABLE whatsapp_device_sessions;
ALTER TABLE registered_devices DROP COLUMN approval_state;
ALTER TABLE registered_devices DROP COLUMN supports_platform_launcher;
DROP TYPE launch_operation;
DROP TYPE account_session_state;
DROP TYPE device_approval_state;

COMMIT;
