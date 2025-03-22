-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('credit', 'debit');

-- CreateTable
CREATE TABLE "UserTransaction" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT,
    "type" "TransactionType" NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "UserTransaction_pkey" PRIMARY KEY ("id")
);
