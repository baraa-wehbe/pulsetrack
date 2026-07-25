-- CreateTable
CREATE TABLE "clinician_sessions" (
    "id" UUID NOT NULL,
    "clinician_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinician_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clinician_sessions_token_hash_key" ON "clinician_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "clinician_sessions_clinician_revoked_idx" ON "clinician_sessions"("clinician_id", "revoked_at");

-- CreateIndex
CREATE INDEX "clinician_sessions_expires_at_idx" ON "clinician_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "clinician_sessions" ADD CONSTRAINT "clinician_sessions_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
