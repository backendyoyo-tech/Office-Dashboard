BEGIN;

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'device_approval_state'
  ) THEN
    CREATE TYPE device_approval_state AS ENUM (
      'PENDING',
      'APPROVED',
      'REVOKED'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'launch_operation'
  ) THEN
    CREATE TYPE launch_operation AS ENUM (
      'SETUP',
      'OPEN',
      'RECONNECT'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'device_platform_session_state'
  ) THEN
    CREATE TYPE device_platform_session_state AS ENUM (
      'SETUP_IN_PROGRESS',
      'USER_CONFIRMED_ON_DEVICE',
      'UNKNOWN',
      'RELOGIN_REQUIRED',
      'DISABLED'
    );
  END IF;
END
$$;


-- ============================================================
-- 2. REGISTERED DEVICES
-- ============================================================

ALTER TABLE "registered_devices"
  ADD COLUMN IF NOT EXISTS "approval_state"
    device_approval_state
    NOT NULL
    DEFAULT 'PENDING';

ALTER TABLE "registered_devices"
  ADD COLUMN IF NOT EXISTS "supports_platform_launcher"
    BOOLEAN
    NOT NULL
    DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "registered_devices_approval_state_idx"
  ON "registered_devices" ("approval_state");


-- ============================================================
-- 3. PLATFORM ACCOUNTS
-- ============================================================

ALTER TABLE "platform_accounts"
  ADD COLUMN IF NOT EXISTS "version"
    INTEGER
    NOT NULL
    DEFAULT 1;


-- ============================================================
-- 4. ACCOUNT RECOVERY METHODS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  "account_recovery_methods_platform_account_id_method_type_key"
ON "account_recovery_methods"
  ("platform_account_id", "method_type");


-- ============================================================
-- 5. DEVICE PLATFORM SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "device_platform_sessions" (
  "id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "platform_account_id" TEXT NOT NULL,
  "profile_key" VARCHAR(32) NOT NULL,
  "state" device_platform_session_state NOT NULL DEFAULT 'UNKNOWN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "confirmed_at" TIMESTAMP(3),
  "confirmed_by_user_id" TEXT,
  "confirmed_identifier" VARCHAR(160),
  "last_launch_requested_at" TIMESTAMP(3),
  "last_launch_result" VARCHAR(80),
  "disabled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "device_platform_sessions_pkey"
    PRIMARY KEY ("id")
);


-- ============================================================
-- 6. DEVICE PLATFORM SESSION CONSTRAINTS
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  "device_platform_sessions_device_id_platform_account_id_key"
ON "device_platform_sessions"
  ("device_id", "platform_account_id");

CREATE UNIQUE INDEX IF NOT EXISTS
  "device_platform_sessions_profile_key_key"
ON "device_platform_sessions"
  ("profile_key");

CREATE INDEX IF NOT EXISTS
  "device_platform_sessions_device_id_idx"
ON "device_platform_sessions"
  ("device_id");

CREATE INDEX IF NOT EXISTS
  "device_platform_sessions_platform_account_id_idx"
ON "device_platform_sessions"
  ("platform_account_id");

CREATE INDEX IF NOT EXISTS
  "device_platform_sessions_state_idx"
ON "device_platform_sessions"
  ("state");


-- ============================================================
-- 7. DEVICE PLATFORM SESSION FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_platform_sessions_device_id_fkey'
  ) THEN
    ALTER TABLE "device_platform_sessions"
      ADD CONSTRAINT "device_platform_sessions_device_id_fkey"
      FOREIGN KEY ("device_id")
      REFERENCES "registered_devices"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_platform_sessions_platform_account_id_fkey'
  ) THEN
    ALTER TABLE "device_platform_sessions"
      ADD CONSTRAINT "device_platform_sessions_platform_account_id_fkey"
      FOREIGN KEY ("platform_account_id")
      REFERENCES "platform_accounts"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'device_platform_sessions_confirmed_by_user_id_fkey'
  ) THEN
    ALTER TABLE "device_platform_sessions"
      ADD CONSTRAINT "device_platform_sessions_confirmed_by_user_id_fkey"
      FOREIGN KEY ("confirmed_by_user_id")
      REFERENCES "app_users"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END
$$;


-- ============================================================
-- 8. LAUNCH GRANTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "launch_grants" (
  "id" TEXT NOT NULL,
  "secret_hash" VARCHAR(128) NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "auth_session_hash" VARCHAR(128) NOT NULL,
  "user_version" INTEGER NOT NULL,
  "device_id" TEXT NOT NULL,
  "phone_number_id" TEXT NOT NULL,
  "platform_account_id" TEXT NOT NULL,
  "operation" launch_operation NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "launch_grants_pkey"
    PRIMARY KEY ("id")
);


-- ============================================================
-- 9. LAUNCH GRANT INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  "launch_grants_secret_hash_key"
ON "launch_grants"
  ("secret_hash");

CREATE INDEX IF NOT EXISTS
  "launch_grants_actor_user_id_idx"
ON "launch_grants"
  ("actor_user_id");

CREATE INDEX IF NOT EXISTS
  "launch_grants_device_id_idx"
ON "launch_grants"
  ("device_id");

CREATE INDEX IF NOT EXISTS
  "launch_grants_phone_number_id_idx"
ON "launch_grants"
  ("phone_number_id");

CREATE INDEX IF NOT EXISTS
  "launch_grants_platform_account_id_idx"
ON "launch_grants"
  ("platform_account_id");

CREATE INDEX IF NOT EXISTS
  "launch_grants_expires_at_idx"
ON "launch_grants"
  ("expires_at");


-- ============================================================
-- 10. LAUNCH GRANT FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_grants_actor_user_id_fkey'
  ) THEN
    ALTER TABLE "launch_grants"
      ADD CONSTRAINT "launch_grants_actor_user_id_fkey"
      FOREIGN KEY ("actor_user_id")
      REFERENCES "app_users"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_grants_device_id_fkey'
  ) THEN
    ALTER TABLE "launch_grants"
      ADD CONSTRAINT "launch_grants_device_id_fkey"
      FOREIGN KEY ("device_id")
      REFERENCES "registered_devices"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_grants_phone_number_id_fkey'
  ) THEN
    ALTER TABLE "launch_grants"
      ADD CONSTRAINT "launch_grants_phone_number_id_fkey"
      FOREIGN KEY ("phone_number_id")
      REFERENCES "phone_numbers"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_grants_platform_account_id_fkey'
  ) THEN
    ALTER TABLE "launch_grants"
      ADD CONSTRAINT "launch_grants_platform_account_id_fkey"
      FOREIGN KEY ("platform_account_id")
      REFERENCES "platform_accounts"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;


-- ============================================================
-- 11. LAUNCH TICKETS
-- ============================================================

CREATE TABLE IF NOT EXISTS "launch_tickets" (
  "id" TEXT NOT NULL,
  "nonce_hash" VARCHAR(128) NOT NULL,
  "grant_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "device_platform_session_id" TEXT NOT NULL,
  "operation" launch_operation NOT NULL,
  "mapping_version" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "launch_tickets_pkey"
    PRIMARY KEY ("id")
);


-- ============================================================
-- 12. LAUNCH TICKET INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
  "launch_tickets_nonce_hash_key"
ON "launch_tickets"
  ("nonce_hash");

CREATE INDEX IF NOT EXISTS
  "launch_tickets_grant_id_idx"
ON "launch_tickets"
  ("grant_id");

CREATE INDEX IF NOT EXISTS
  "launch_tickets_device_id_idx"
ON "launch_tickets"
  ("device_id");

CREATE INDEX IF NOT EXISTS
  "launch_tickets_device_platform_session_id_idx"
ON "launch_tickets"
  ("device_platform_session_id");

CREATE INDEX IF NOT EXISTS
  "launch_tickets_expires_at_idx"
ON "launch_tickets"
  ("expires_at");


-- ============================================================
-- 13. LAUNCH TICKET FOREIGN KEYS
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_tickets_grant_id_fkey'
  ) THEN
    ALTER TABLE "launch_tickets"
      ADD CONSTRAINT "launch_tickets_grant_id_fkey"
      FOREIGN KEY ("grant_id")
      REFERENCES "launch_grants"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_tickets_device_id_fkey'
  ) THEN
    ALTER TABLE "launch_tickets"
      ADD CONSTRAINT "launch_tickets_device_id_fkey"
      FOREIGN KEY ("device_id")
      REFERENCES "registered_devices"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'launch_tickets_device_platform_session_id_fkey'
  ) THEN
    ALTER TABLE "launch_tickets"
      ADD CONSTRAINT "launch_tickets_device_platform_session_id_fkey"
      FOREIGN KEY ("device_platform_session_id")
      REFERENCES "device_platform_sessions"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;


COMMIT;