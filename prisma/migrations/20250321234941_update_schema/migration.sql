-- CreateTable
CREATE TABLE "category_spend" (
    "id" SERIAL NOT NULL,
    "average" TEXT,
    "cat_name" TEXT,
    "user_id" INTEGER NOT NULL,
    "status" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_spend_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "category_spend" ADD CONSTRAINT "category_spend_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
