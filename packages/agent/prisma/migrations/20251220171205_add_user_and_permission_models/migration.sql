-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "web3AuthId" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "eoaAddress" TEXT,
    "smartAccountAddress" TEXT,
    "smartAccountImplementation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionContext" TEXT NOT NULL,
    "delegationManager" TEXT NOT NULL,
    "permissionType" TEXT NOT NULL,
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_web3AuthId_key" ON "User"("web3AuthId");

-- CreateIndex
CREATE UNIQUE INDEX "User_eoaAddress_key" ON "User"("eoaAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_smartAccountAddress_key" ON "User"("smartAccountAddress");

-- CreateIndex
CREATE INDEX "User_web3AuthId_idx" ON "User"("web3AuthId");

-- CreateIndex
CREATE INDEX "User_eoaAddress_idx" ON "User"("eoaAddress");

-- CreateIndex
CREATE INDEX "User_smartAccountAddress_idx" ON "User"("smartAccountAddress");

-- CreateIndex
CREATE INDEX "Permission_userId_idx" ON "Permission"("userId");

-- CreateIndex
CREATE INDEX "Permission_expiresAt_idx" ON "Permission"("expiresAt");

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DCAStrategy" ADD CONSTRAINT "DCAStrategy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
