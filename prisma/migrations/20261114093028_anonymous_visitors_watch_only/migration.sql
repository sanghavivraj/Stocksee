-- DropForeignKey
ALTER TABLE "holdings" DROP CONSTRAINT "holdings_userId_fkey";

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "passwordHash";

-- DropTable
DROP TABLE "holdings";

