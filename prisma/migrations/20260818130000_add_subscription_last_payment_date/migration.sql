-- Add lastPaymentDate to subscription (tracks the most recent payment,
-- falls back to startDate for renewal calculations)
ALTER TABLE "subscription" ADD COLUMN "lastPaymentDate" TIMESTAMP(3);

-- Backfill: subscriptions with payment history use the latest dayPaid
UPDATE "subscription" s
SET "lastPaymentDate" = sub."latestPaid"
FROM (
  SELECT "subscriptionId", MAX("dayPaid") AS "latestPaid"
  FROM "subscription_history"
  GROUP BY "subscriptionId"
) sub
WHERE s."id" = sub."subscriptionId"
  AND s."lastPaymentDate" IS NULL;

-- Remaining subscriptions default to their start date
UPDATE "subscription" SET "lastPaymentDate" = "startDate" WHERE "lastPaymentDate" IS NULL;