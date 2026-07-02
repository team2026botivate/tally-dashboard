-- CreateIndex
CREATE INDEX "Ledger_companyId_parentGroup_idx" ON "Ledger"("companyId", "parentGroup");

-- CreateIndex
CREATE INDEX "StockItem_stockGroupId_idx" ON "StockItem"("stockGroupId");

-- CreateIndex
CREATE INDEX "SyncMetadata_companyId_idx" ON "SyncMetadata"("companyId");

-- CreateIndex
CREATE INDEX "Voucher_companyId_voucherDate_idx" ON "Voucher"("companyId", "voucherDate");

-- CreateIndex
CREATE INDEX "Voucher_companyId_isCancelled_idx" ON "Voucher"("companyId", "isCancelled");

-- CreateIndex
CREATE INDEX "VoucherEntry_companyId_ledgerId_idx" ON "VoucherEntry"("companyId", "ledgerId");
