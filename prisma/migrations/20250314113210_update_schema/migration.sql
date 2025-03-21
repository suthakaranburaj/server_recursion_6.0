/*
  Warnings:

  - You are about to drop the column `profile_img` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[profile_image]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_profile_img_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "profile_img",
ADD COLUMN     "profile_image" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_profile_image_key" ON "User"("profile_image");
