import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { User } from '../users/entities/user.entity';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { Budget } from './entities/budget.entity';

/** YYYY-MM → the first-of-month date the unique index is built on. */
export function monthToPeriod(month: string): string {
  return `${month}-01`;
}

@Injectable()
export class BudgetsService {
  constructor(
    @InjectRepository(Budget)
    private readonly budgets: Repository<Budget>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async create(user: User, dto: CreateBudgetDto): Promise<Budget> {
    const category = await this.categoriesService.findUsable(user, dto.categoryId);
    const periodMonth = monthToPeriod(dto.month);
    const exists = await this.budgets.exists({
      where: {
        user: { id: user.id },
        category: { id: category.id },
        periodMonth,
      },
    });
    if (exists) {
      throw new ConflictException(
        `A budget for this category already exists for ${dto.month}`,
      );
    }
    return this.budgets.save(
      this.budgets.create({
        user: { id: user.id } as User,
        category,
        amountCents: dto.amountCents,
        periodMonth,
      }),
    );
  }

  findAll(user: User, month?: string): Promise<Budget[]> {
    return this.budgets.find({
      where: {
        user: { id: user.id },
        ...(month ? { periodMonth: monthToPeriod(month) } : {}),
      },
      relations: { category: true },
      order: { periodMonth: 'DESC' },
    });
  }

  async update(user: User, id: string, dto: UpdateBudgetDto): Promise<Budget> {
    const budget = await this.findOwned(user, id);
    budget.amountCents = dto.amountCents;
    return this.budgets.save(budget);
  }

  async remove(user: User, id: string): Promise<void> {
    const budget = await this.findOwned(user, id);
    await this.budgets.remove(budget);
  }

  private async findOwned(user: User, id: string): Promise<Budget> {
    const budget = await this.budgets.findOne({
      where: { id, user: { id: user.id } },
      relations: { category: true },
    });
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }
}
