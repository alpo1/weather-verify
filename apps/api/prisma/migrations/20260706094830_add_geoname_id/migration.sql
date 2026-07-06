/*
  Warnings:

  - A unique constraint covering the columns `[geonameId]` on the table `Location` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "geonameId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Location_geonameId_key" ON "Location"("geonameId");
