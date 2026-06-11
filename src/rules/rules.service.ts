import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { User } from '../users/entities/user.entity';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { Rule } from './entities/rule.entity';
import { RuleMatchType } from './enums/rule-match-type.enum';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule)
    private readonly rules: Repository<Rule>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(user: User, dto: CreateRuleDto): Promise<Rule> {
    this.assertValidPattern(dto.matchType, dto.pattern);
    const category = await this.categoriesService.findUsable(user, dto.categoryId);
    return this.rules.save(
      this.rules.create({
        category,
        matchType: dto.matchType,
        pattern: dto.pattern,
        priority: dto.priority ?? 0,
        user: { id: user.id } as User,
      }),
    );
  }

  findAll(user: User): Promise<Rule[]> {
    return this.rules.find({
      where: { user: { id: user.id } },
      relations: { category: true },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async update(user: User, id: string, dto: UpdateRuleDto): Promise<Rule> {
    const rule = await this.findOwned(user, id);
    const matchType = dto.matchType ?? rule.matchType;
    const pattern = dto.pattern ?? rule.pattern;
    this.assertValidPattern(matchType, pattern);

    if (dto.categoryId) {
      rule.category = await this.categoriesService.findUsable(user, dto.categoryId);
    }
    rule.matchType = matchType;
    rule.pattern = pattern;
    if (dto.priority !== undefined) {
      rule.priority = dto.priority;
    }
    return this.rules.save(rule);
  }

  async remove(user: User, id: string): Promise<void> {
    const rule = await this.findOwned(user, id);
    await this.rules.remove(rule);
  }

  /** Reject unusable regex at write time, not silently at import time. */
  private assertValidPattern(matchType: RuleMatchType, pattern: string): void {
    if (matchType === RuleMatchType.REGEX) {
      try {
        new RegExp(pattern, 'i');
      } catch {
        throw new BadRequestException(`Invalid regular expression: ${pattern}`);
      }
    }
  }

  private async findOwned(user: User, id: string): Promise<Rule> {
    const rule = await this.rules.findOne({
      where: { id, user: { id: user.id } },
      relations: { category: true },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule;
  }
}
