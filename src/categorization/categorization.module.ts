import { Module } from '@nestjs/common';
import { CategorizationService } from './categorization.service';

/** Pure logic module — no entities, no I/O. */
@Module({
  providers: [CategorizationService],
  exports: [CategorizationService],
})
export class CategorizationModule {}
