-- Run only in an isolated sl_test_ schema with synthetic fixtures.
DO $$
DECLARE
  device_id uuid;
  account_id uuid;
  actor_id uuid;
  phone_id uuid;
BEGIN
  IF current_schema() NOT LIKE 'sl_test_%' THEN
    RAISE EXCEPTION 'Refusing negative test outside isolated schema';
  END IF;
  SELECT id INTO device_id FROM registered_devices LIMIT 1;
  SELECT id INTO account_id FROM platform_accounts LIMIT 1;
  SELECT id INTO actor_id FROM app_users LIMIT 1;
  SELECT id INTO phone_id FROM phone_numbers LIMIT 1;

  BEGIN
    INSERT INTO device_platform_sessions
      (id, device_id, platform_account_id, profile_key, updated_at)
    VALUES (gen_random_uuid(), device_id, account_id, '../escape', now());
    RAISE EXCEPTION 'unsafe profile key was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'unsafe profile key rejected';
  END;

  BEGIN
    INSERT INTO launch_grants
      (id, secret_hash, actor_user_id, device_id, phone_number_id, operation, expires_at)
    VALUES (gen_random_uuid(), repeat('a', 64), actor_id, device_id, phone_id, 'OPEN', now() + interval '1 minute');
    RAISE EXCEPTION 'grant with no target was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'grant with no target rejected';
  END;
END $$;
