-- CreateEnum
CREATE TYPE "device_approval_state" AS ENUM ('PENDING', 'APPROVED', 'REVOKED');

-- CreateEnum
CREATE TYPE "account_session_state" AS ENUM ('SETUP_REQUIRED', 'SETUP_IN_PROGRESS', 'USER_CONFIRMED', 'RELOGIN_REQUIRED', 'DISABLED', 'ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "launch_operation" AS ENUM ('SETUP', 'OPEN', 'RECONNECT');

-- AlterTable
ALTER TABLE "registered_devices" ADD COLUMN     "approval_state" "device_approval_state" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "supports_platform_launcher" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "device_platform_sessions" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "platform_account_id" UUID NOT NULL,
    "profile_key" VARCHAR(64) NOT NULL,
    "state" "account_session_state" NOT NULL DEFAULT 'SETUP_REQUIRED',
    "confirmed_identifier" VARCHAR(160),
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "last_launch_requested_at" TIMESTAMPTZ,
    "last_launch_result" VARCHAR(32),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "disabled_at" TIMESTAMPTZ,

    CONSTRAINT "device_platform_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_device_sessions" (
    "id" UUID NOT NULL,
    "whatsapp_session_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "profile_key" VARCHAR(64) NOT NULL,
    "legacy_primary" BOOLEAN NOT NULL DEFAULT false,
    "state" "account_session_state" NOT NULL DEFAULT 'SETUP_REQUIRED',
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "disabled_at" TIMESTAMPTZ,

    CONSTRAINT "whatsapp_device_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_grants" (
    "id" UUID NOT NULL,
    "secret_hash" VARCHAR(64) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "auth_session_hash" VARCHAR(64) NOT NULL,
    "user_version" INTEGER NOT NULL,
    "device_id" UUID NOT NULL,
    "phone_number_id" UUID NOT NULL,
    "platform_account_id" UUID,
    "whatsapp_session_id" UUID,
    "operation" "launch_operation" NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launch_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "launch_tickets" (
    "id" UUID NOT NULL,
    "nonce_hash" VARCHAR(64) NOT NULL,
    "grant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "device_platform_session_id" UUID,
    "whatsapp_device_session_id" UUID,
    "operation" "launch_operation" NOT NULL,
    "mapping_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "ack_at" TIMESTAMPTZ,
    "launch_result" VARCHAR(16),
    "error_code" VARCHAR(64),
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "launch_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_device_platform_session_state" ON "device_platform_sessions"("state");

-- CreateIndex
CREATE UNIQUE INDEX "uq_device_platform_account" ON "device_platform_sessions"("device_id", "platform_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_device_platform_profile_key" ON "device_platform_sessions"("device_id", "profile_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_whatsapp_session_device" ON "whatsapp_device_sessions"("whatsapp_session_id", "device_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_whatsapp_device_profile_key" ON "whatsapp_device_sessions"("device_id", "profile_key");

-- CreateIndex
CREATE UNIQUE INDEX "launch_grants_secret_hash_key" ON "launch_grants"("secret_hash");

-- CreateIndex
CREATE INDEX "idx_launch_grant_actor_expiry" ON "launch_grants"("actor_user_id", "expires_at");

-- CreateIndex
CREATE INDEX "idx_launch_grant_device_expiry" ON "launch_grants"("device_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "launch_tickets_nonce_hash_key" ON "launch_tickets"("nonce_hash");

-- CreateIndex
CREATE INDEX "idx_launch_ticket_device_expiry" ON "launch_tickets"("device_id", "expires_at");

-- AddForeignKey
ALTER TABLE "device_platform_sessions" ADD CONSTRAINT "device_platform_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_platform_sessions" ADD CONSTRAINT "device_platform_sessions_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_platform_sessions" ADD CONSTRAINT "device_platform_sessions_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_device_sessions" ADD CONSTRAINT "whatsapp_device_sessions_whatsapp_session_id_fkey" FOREIGN KEY ("whatsapp_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_device_sessions" ADD CONSTRAINT "whatsapp_device_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_device_sessions" ADD CONSTRAINT "whatsapp_device_sessions_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "app_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grants_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grants_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grants_phone_number_id_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "phone_numbers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grants_platform_account_id_fkey" FOREIGN KEY ("platform_account_id") REFERENCES "platform_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grants_whatsapp_session_id_fkey" FOREIGN KEY ("whatsapp_session_id") REFERENCES "whatsapp_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_tickets_grant_id_fkey" FOREIGN KEY ("grant_id") REFERENCES "launch_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_tickets_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "registered_devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_tickets_device_platform_session_id_fkey" FOREIGN KEY ("device_platform_session_id") REFERENCES "device_platform_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_tickets_whatsapp_device_session_id_fkey" FOREIGN KEY ("whatsapp_device_session_id") REFERENCES "whatsapp_device_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Constraints not expressible in Prisma's schema language.
ALTER TABLE "device_platform_sessions" ADD CONSTRAINT "device_platform_profile_key_format"
  CHECK ("profile_key" ~ '^[a-f0-9]{32}$' AND "version" >= 1);
ALTER TABLE "whatsapp_device_sessions" ADD CONSTRAINT "whatsapp_device_profile_key_format"
  CHECK ("profile_key" ~ '^[a-f0-9]{32}$' AND "version" >= 1);
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grant_one_target"
  CHECK (("platform_account_id" IS NOT NULL) <> ("whatsapp_session_id" IS NOT NULL));
ALTER TABLE "launch_grants" ADD CONSTRAINT "launch_grant_lifetime"
  CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + INTERVAL '5 minutes');
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_ticket_one_mapping"
  CHECK (("device_platform_session_id" IS NOT NULL) <> ("whatsapp_device_session_id" IS NOT NULL));
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_ticket_lifetime"
  CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + INTERVAL '60 seconds' AND "mapping_version" >= 1);
ALTER TABLE "launch_tickets" ADD CONSTRAINT "launch_ticket_result"
  CHECK ("launch_result" IS NULL OR "launch_result" IN ('DELIVERED', 'FAILED'));

-- Keep the Phase 2 primary row and its local directory intact. The child row
-- identifies that existing assignment; N12's adapter uses the old directory
-- when legacy_primary is true. No identity confirmation is inferred.
INSERT INTO "whatsapp_device_sessions" (
  "id", "whatsapp_session_id", "device_id", "profile_key", "legacy_primary",
  "state", "version", "created_at", "updated_at"
)
SELECT gen_random_uuid(), w."id", w."device_id", md5(w."id"::text || ':' || w."device_id"::text),
  true, 'UNKNOWN'::"account_session_state", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "whatsapp_sessions" w
ON CONFLICT ("whatsapp_session_id", "device_id") DO NOTHING;
