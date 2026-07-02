-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public._prisma_migrations (
  id character varying NOT NULL,
  checksum character varying NOT NULL,
  finished_at timestamp with time zone,
  migration_name character varying NOT NULL,
  logs text,
  rolled_back_at timestamp with time zone,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0,
  CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.TallyConfiguration (
  id text NOT NULL,
  host text NOT NULL,
  port integer NOT NULL DEFAULT 9000,
  companyName text NOT NULL,
  authToken text,
  syncInterval integer NOT NULL DEFAULT 300000,
  isActive boolean NOT NULL DEFAULT true,
  lastSyncAt timestamp without time zone,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  deviceInfo jsonb,
  deviceSecretHash text,
  gatewayId text,
  isRemote boolean NOT NULL DEFAULT false,
  lastHeartbeatAt timestamp without time zone,
  status text NOT NULL DEFAULT 'OFFLINE'::text,
  CONSTRAINT TallyConfiguration_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Ledger (
  id text NOT NULL,
  tallyId text NOT NULL,
  companyId text NOT NULL,
  name text NOT NULL,
  alias text,
  groupName text NOT NULL,
  parentGroup text,
  openingBalance numeric NOT NULL DEFAULT 0,
  currentBalance numeric NOT NULL DEFAULT 0,
  address text,
  gstin text,
  isActive boolean NOT NULL DEFAULT true,
  lastSyncAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  CONSTRAINT Ledger_pkey PRIMARY KEY (id),
  CONSTRAINT Ledger_companyId_fkey FOREIGN KEY (companyId) REFERENCES public.TallyConfiguration(id)
);
CREATE TABLE public.StockGroup (
  id text NOT NULL,
  tallyId text NOT NULL,
  companyId text NOT NULL,
  name text NOT NULL,
  parentGroup text,
  isActive boolean NOT NULL DEFAULT true,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  CONSTRAINT StockGroup_pkey PRIMARY KEY (id),
  CONSTRAINT StockGroup_companyId_fkey FOREIGN KEY (companyId) REFERENCES public.TallyConfiguration(id)
);
CREATE TABLE public.StockItem (
  id text NOT NULL,
  tallyId text NOT NULL,
  companyId text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL,
  openingQty numeric NOT NULL DEFAULT 0,
  openingValue numeric NOT NULL DEFAULT 0,
  closingQty numeric NOT NULL DEFAULT 0,
  closingValue numeric NOT NULL DEFAULT 0,
  rate numeric,
  gstRate numeric,
  hsnCode text,
  stockGroupId text NOT NULL,
  isActive boolean NOT NULL DEFAULT true,
  lastSyncAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  CONSTRAINT StockItem_pkey PRIMARY KEY (id),
  CONSTRAINT StockItem_stockGroupId_fkey FOREIGN KEY (stockGroupId) REFERENCES public.StockGroup(id),
  CONSTRAINT StockItem_companyId_fkey FOREIGN KEY (companyId) REFERENCES public.TallyConfiguration(id)
);
CREATE TABLE public.VoucherType (
  id text NOT NULL,
  name text NOT NULL,
  isActive boolean NOT NULL DEFAULT true,
  CONSTRAINT VoucherType_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Voucher (
  id text NOT NULL,
  tallyId text NOT NULL,
  companyId text NOT NULL,
  voucherNumber text NOT NULL,
  voucherDate timestamp without time zone NOT NULL,
  voucherTypeId text NOT NULL,
  narration text,
  isCancelled boolean NOT NULL DEFAULT false,
  totalAmount numeric NOT NULL DEFAULT 0,
  lastSyncAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  CONSTRAINT Voucher_pkey PRIMARY KEY (id),
  CONSTRAINT Voucher_voucherTypeId_fkey FOREIGN KEY (voucherTypeId) REFERENCES public.VoucherType(id),
  CONSTRAINT Voucher_companyId_fkey FOREIGN KEY (companyId) REFERENCES public.TallyConfiguration(id)
);
CREATE TABLE public.VoucherEntry (
  id text NOT NULL,
  tallyId text NOT NULL,
  companyId text NOT NULL,
  voucherId text NOT NULL,
  ledgerId text NOT NULL,
  stockItemId text,
  amount numeric NOT NULL,
  entryType USER-DEFINED NOT NULL,
  quantity numeric,
  rate numeric,
  isActive boolean NOT NULL DEFAULT true,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT VoucherEntry_pkey PRIMARY KEY (id),
  CONSTRAINT VoucherEntry_voucherId_fkey FOREIGN KEY (voucherId) REFERENCES public.Voucher(id),
  CONSTRAINT VoucherEntry_ledgerId_fkey FOREIGN KEY (ledgerId) REFERENCES public.Ledger(id),
  CONSTRAINT VoucherEntry_stockItemId_fkey FOREIGN KEY (stockItemId) REFERENCES public.StockItem(id),
  CONSTRAINT VoucherEntry_companyId_fkey FOREIGN KEY (companyId) REFERENCES public.TallyConfiguration(id)
);
CREATE TABLE public.SyncLog (
  id text NOT NULL,
  syncType USER-DEFINED NOT NULL,
  status USER-DEFINED NOT NULL,
  recordsProcessed integer NOT NULL,
  errors jsonb,
  startedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt timestamp without time zone,
  errorMessage text,
  CONSTRAINT SyncLog_pkey PRIMARY KEY (id)
);
CREATE TABLE public.SyncMetadata (
  id text NOT NULL,
  entityType text NOT NULL,
  lastSyncTime timestamp without time zone NOT NULL,
  lastTallyTimestamp text,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT SyncMetadata_pkey PRIMARY KEY (id)
);
CREATE TABLE public.UserProfile (
  id text NOT NULL,
  username text NOT NULL,
  password text NOT NULL,
  name text,
  email text,
  phoneNumber text,
  profilePicture text,
  isActive boolean NOT NULL DEFAULT true,
  pageAccess jsonb,
  role USER-DEFINED NOT NULL DEFAULT 'VIEWER'::"Role",
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL,
  CONSTRAINT UserProfile_pkey PRIMARY KEY (id)
);