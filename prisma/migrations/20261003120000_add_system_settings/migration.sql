CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_key_key"
ON "system_settings"("key");

INSERT INTO "system_settings" (
    "id",
    "key",
    "value",
    "createdAt",
    "updatedAt"
)
VALUES (
    gen_random_uuid(),
    'cv_retention_days',
    '28',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);