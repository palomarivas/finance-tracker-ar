import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Public health check (used by deploy platforms). */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
