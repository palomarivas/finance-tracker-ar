import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Currency } from '../common/enums/currency.enum';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  user: { id: string; email: string; baseCurrency: Currency };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    email: string;
    password: string;
    baseCurrency?: Currency;
  }): Promise<AuthResult> {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: input.email,
      passwordHash,
      baseCurrency: input.baseCurrency,
    });
    return this.toAuthResult(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(input.email);
    // Same error for unknown email and wrong password — don't leak which it was.
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.toAuthResult(user);
  }

  private async toAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        baseCurrency: user.baseCurrency,
      },
    };
  }
}
