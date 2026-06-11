import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../common/enums/currency.enum';
import { RateType } from '../fx/enums/rate-type.enum';
import { User } from '../users/entities/user.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account } from './entities/account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accounts: Repository<Account>,
  ) {}

  async create(user: User, dto: CreateAccountDto): Promise<Account> {
    const account = this.accounts.create({
      ...dto,
      valuationRateType: this.resolveValuationRateType(dto.currency, dto.valuationRateType),
      user: { id: user.id } as User,
    });
    return this.accounts.save(account);
  }

  findAll(user: User): Promise<Account[]> {
    return this.accounts.find({
      where: { user: { id: user.id } },
      order: { createdAt: 'ASC' },
    });
  }

  async findOne(user: User, id: string): Promise<Account> {
    const account = await this.accounts.findOne({
      where: { id, user: { id: user.id } },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(user: User, id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.findOne(user, id);
    const currency = dto.currency ?? account.currency;
    const valuationRateType =
      dto.valuationRateType !== undefined || dto.currency !== undefined
        ? this.resolveValuationRateType(
            currency,
            dto.valuationRateType ?? account.valuationRateType ?? undefined,
          )
        : account.valuationRateType;
    Object.assign(account, dto, { valuationRateType });
    return this.accounts.save(account);
  }

  /** Removes the account AND (by FK cascade) all its transactions. */
  async remove(user: User, id: string): Promise<void> {
    const account = await this.findOne(user, id);
    await this.accounts.remove(account);
  }

  /**
   * ARS accounts must not carry a valuation rate; USD holdings default to MEP
   * (mark-to-market valuation — see the FX module).
   */
  private resolveValuationRateType(
    currency: Currency,
    requested: RateType | undefined,
  ): RateType | null {
    if (currency === Currency.ARS) {
      if (requested) {
        throw new BadRequestException(
          'valuationRateType only applies to USD accounts',
        );
      }
      return null;
    }
    return requested ?? RateType.MEP;
  }
}
