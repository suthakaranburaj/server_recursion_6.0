/*
  Warnings:

  - You are about to drop the column `profile_image` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[image]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "user_profile_image_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "profile_image",
ADD COLUMN     "image" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "user_image_key" ON "user"("image");
