/*
  Warnings:

  - A unique constraint covering the columns `[user_id,cat_name]` on the table `category_spend` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "category_spend_user_id_cat_name_key" ON "category_spend"("user_id", "cat_name");
