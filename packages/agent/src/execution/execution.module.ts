import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionService } from '../common/encryption.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { SessionAccountModule } from '../session-account/session-account.module';
import { UniswapV3Service } from '../common/services/uniswap-v3.service';
import { PythOracleService } from '../common/services/pyth-oracle.service';

@Module({
  imports: [
    PrismaModule,
    PermissionsModule,
    SessionAccountModule,
  ],
  providers: [ExecutionService, EncryptionService, UniswapV3Service, PythOracleService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
