import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeRate } from './entities/exchange-rate.entity';
import { FxController } from './fx.controller';
import { FxService } from './fx.service';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRate]), HttpModule],
  controllers: [FxController],
  providers: [FxService],
  exports: [FxService],
})
export class FxModule {}
