-- CreateEnum
CREATE TYPE "DevicePairingStatus" AS ENUM ('PENDING', 'APPROVED', 'CONSUMED', 'EXPIRED', 'REJECTED');

-- CreateTable
CREATE TABLE "device_pairing_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "pairing_code" VARCHAR(20) NOT NULL,
    "secret_hash" VARCHAR(64) NOT NULL,
    "hostname" VARCHAR(255),
    "friendly_name" VARCHAR(120),
    "launcher_version" VARCHAR(40),
    "api_key_ciphertext" TEXT NOT NULL,
    "api_key_iv" VARCHAR(64) NOT NULL,
    "api_key_auth_tag" VARCHAR(64) NOT NULL,
    "device_id" UUID,
    "status" "DevicePairingStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" UUID,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_pairing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_pairing_requests_pairing_code_key" ON "device_pairing_requests"("pairing_code");

-- CreateIndex
CREATE INDEX "device_pairing_requests_status_expires_at_idx" ON "device_pairing_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "device_pairing_requests_device_id_idx" ON "device_pairing_requests"("device_id");

-- CreateIndex
CREATE INDEX "device_pairing_requests_hostname_status_idx" ON "device_pairing_requests"("hostname", "status");

