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
