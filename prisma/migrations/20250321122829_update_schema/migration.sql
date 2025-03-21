/*
  Warnings:

  - The `balance` column on the `user_transactions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "user_transactions" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION,
DROP COLUMN "balance",
ADD COLUMN     "balance" DOUBLE PRECISION;
