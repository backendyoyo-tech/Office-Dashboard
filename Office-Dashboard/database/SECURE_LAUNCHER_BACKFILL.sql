-- Idempotent primary WhatsApp child mapping backfill. Run only after migration.
-- The original whatsapp_sessions row and session_directory are untouched.
INSERT INTO "whatsapp_device_sessions" (
  "id", "whatsapp_session_id", "device_id", "profile_key", "legacy_primary",
  "state", "version", "created_at", "updated_at"
)
SELECT gen_random_uuid(), w."id", w."device_id", md5(w."id"::text || ':' || w."device_id"::text),
  true, 'UNKNOWN'::"account_session_state", 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "whatsapp_sessions" w
ON CONFLICT ("whatsapp_session_id", "device_id") DO NOTHING;
