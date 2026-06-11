import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Currency } from '../common/enums/currency.enum';
import { User } from '../users/entities/user.entity';
import { AuthResult, AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  /** The authenticated user's own profile (never exposes passwordHash). */
  @Get('me')
  me(@CurrentUser() user: User): {
    id: string;
    email: string;
    baseCurrency: Currency;
    createdAt: Date;
  } {
    return {
      id: user.id,
      email: user.email,
      baseCurrency: user.baseCurrency,
      createdAt: user.createdAt,
    };
  }
}
