/*
  Warnings:

  - You are about to drop the column `phone_no` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[phone]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_phone_no_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "phone_no",
ADD COLUMN     "phone" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "user_phone_key" ON "user"("phone");
