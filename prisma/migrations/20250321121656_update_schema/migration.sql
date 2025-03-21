-- CreateTable
CREATE TABLE "user_transactions" (
    "id" SERIAL NOT NULL,
    "user_statement_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "Date" TEXT,
    "Narration" TEXT,
    "Balance" TEXT,
    "Other" TEXT,
    "status" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_user_statement_id_fkey" FOREIGN KEY ("user_statement_id") REFERENCES "user_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
