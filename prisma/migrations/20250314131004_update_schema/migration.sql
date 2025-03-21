/*
  Warnings:

  - A unique constraint covering the columns `[phone_no]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user_phone_no_key" ON "user"("phone_no");
