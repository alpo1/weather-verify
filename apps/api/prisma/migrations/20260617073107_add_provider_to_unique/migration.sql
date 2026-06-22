/*
  Warnings:

  - A unique constraint covering the columns `[locationId,provider,issuedDate,targetDate]` on the table `Forecast` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Forecast_locationId_issuedDate_targetDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "Forecast_locationId_provider_issuedDate_targetDate_key" ON "Forecast"("locationId", "provider", "issuedDate", "targetDate");
