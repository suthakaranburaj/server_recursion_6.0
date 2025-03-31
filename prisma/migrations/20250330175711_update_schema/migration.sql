/*
  Warnings:

  - A unique constraint covering the columns `[wallet_address]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_web3_user" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nonce" TEXT,
ADD COLUMN     "wallet_address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_wallet_address_key" ON "user"("wallet_address");
