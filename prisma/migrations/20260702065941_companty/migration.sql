/*
  Warnings:

  - A unique constraint covering the columns `[entityType,companyId]` on the table `SyncMetadata` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[gatewayId]` on the table `TallyConfiguration` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyId` to the `SyncMetadata` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Ledger" DROP CONSTRAINT "Ledger_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockGroup" DROP CONSTRAINT "StockGroup_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockItem" DROP CONSTRAINT "StockItem_companyId_fkey";

-- DropForeignKey
ALTER TABLE "StockItem" DROP CONSTRAINT "StockItem_stockGroupId_fkey";

-- DropForeignKey
ALTER TABLE "Voucher" DROP CONSTRAINT "Voucher_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Voucher" DROP CONSTRAINT "Voucher_voucherTypeId_fkey";

-- DropForeignKey
ALTER TABLE "VoucherEntry" DROP CONSTRAINT "VoucherEntry_companyId_fkey";

-- DropForeignKey
ALTER TABLE "VoucherEntry" DROP CONSTRAINT "VoucherEntry_ledgerId_fkey";

-- DropForeignKey
ALTER TABLE "VoucherEntry" DROP CONSTRAINT "VoucherEntry_stockItemId_fkey";

-- DropForeignKey
ALTER TABLE "VoucherEntry" DROP CONSTRAINT "VoucherEntry_voucherId_fkey";

-- DropIndex
DROP INDEX "SyncMetadata_entityType_key";

-- AlterTable
ALTER TABLE "SyncMetadata" ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TallyConfiguration" ADD COLUMN     "deviceInfo" JSONB,
ADD COLUMN     "deviceSecretHash" TEXT,
ADD COLUMN     "gatewayId" TEXT,
ADD COLUMN     "isRemote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'OFFLINE';

-- CreateIndex
CREATE INDEX "Ledger_companyId_idx" ON "Ledger"("companyId");

-- CreateIndex
CREATE INDEX "StockGroup_companyId_idx" ON "StockGroup"("companyId");

-- CreateIndex
CREATE INDEX "StockItem_companyId_idx" ON "StockItem"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMetadata_entityType_companyId_key" ON "SyncMetadata"("entityType", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "TallyConfiguration_gatewayId_key" ON "TallyConfiguration"("gatewayId");

-- CreateIndex
CREATE INDEX "Voucher_companyId_idx" ON "Voucher"("companyId");

-- CreateIndex
CREATE INDEX "VoucherEntry_companyId_idx" ON "VoucherEntry"("companyId");
