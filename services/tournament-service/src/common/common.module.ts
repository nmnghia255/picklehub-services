import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchViewService } from './match-view.service';

/**
 * Shared building blocks reused across feature modules. `@Global` so any module can
 * inject `MatchViewService` (match → FE shape) without re-importing. The sport-center
 * client it depends on comes from the global ClientsModule.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [MatchViewService],
  exports: [MatchViewService],
})
export class CommonModule {}
