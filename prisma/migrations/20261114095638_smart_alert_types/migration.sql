-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_MOVE', 'GAP', 'VOLUME_SPIKE', 'NEW_52W_HIGH', 'NEW_52W_LOW');

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "type" "AlertType" NOT NULL DEFAULT 'PRICE_MOVE';
