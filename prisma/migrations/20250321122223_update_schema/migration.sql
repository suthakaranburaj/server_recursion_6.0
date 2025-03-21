/*
  Warnings:

  - You are about to drop the column `Balance` on the `user_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `Date` on the `user_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `Narration` on the `user_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `Other` on the `user_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user_transactions" DROP COLUMN "Balance",
DROP COLUMN "Date",
DROP COLUMN "Narration",
DROP COLUMN "Other",
ADD COLUMN     "balance" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "chqRefNo" TEXT,
ADD COLUMN     "date" TEXT,
ADD COLUMN     "narration" TEXT,
ADD COLUMN     "type" TEXT;
