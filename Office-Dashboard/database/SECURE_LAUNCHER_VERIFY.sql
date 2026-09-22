-- Run with search_path set to the reviewed target schema.
-- Returns no secrets or account contents.
SELECT current_schema() AS target_schema;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = current_schema()
  AND table_name IN ('device_platform_sessions', 'whatsapp_device_sessions', 'launch_grants', 'launch_tickets')
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'registered_devices'
  AND column_name IN ('approval_state', 'supports_platform_launcher')
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE connamespace = current_schema()::regnamespace
  AND conname IN (
    'device_platform_profile_key_format', 'whatsapp_device_profile_key_format',
    'launch_grant_one_target', 'launch_grant_lifetime',
    'launch_ticket_one_mapping', 'launch_ticket_lifetime', 'launch_ticket_result'
  )
ORDER BY conname;

SELECT
  (SELECT count(*) FROM phone_numbers) AS existing_phone_count,
  (SELECT count(*) FROM whatsapp_sessions) AS primary_whatsapp_count,
  (SELECT count(*) FROM whatsapp_device_sessions WHERE legacy_primary) AS legacy_child_count,
  (SELECT count(*) FROM device_platform_sessions) AS platform_mapping_count;
