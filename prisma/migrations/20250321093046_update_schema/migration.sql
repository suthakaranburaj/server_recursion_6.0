-- CreateTable
CREATE TABLE "user_statements" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "url" TEXT,
    "user_id" INTEGER NOT NULL,
    "status" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_statements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_statements" ADD CONSTRAINT "user_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
