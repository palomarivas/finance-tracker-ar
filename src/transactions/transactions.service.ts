import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { User } from '../users/entities/user.entity';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction } from './entities/transaction.entity';

export interface PaginatedTransactions {
  items: Transaction[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactions: Repository<Transaction>,
    private readonly categoriesService: CategoriesService,
  ) {}

  async list(user: User, query: ListTransactionsDto): Promise<PaginatedTransactions> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.transactions
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.account', 'account')
      .where('t.user_id = :userId', { userId: user.id })
      // Property paths (not raw column names): skip/take pagination builds a
      // subquery that must map ORDER BY columns back to entity properties.
      .orderBy('t.postedAt', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.month) {
      const [year, mm] = query.month.split('-').map(Number);
      qb.andWhere('t.posted_at >= :start AND t.posted_at < :end', {
        start: new Date(Date.UTC(year, mm - 1, 1)),
        end: new Date(Date.UTC(year, mm, 1)),
      });
    }
    if (query.accountId) {
      qb.andWhere('t.account_id = :accountId', { accountId: query.accountId });
    }
    if (query.categoryId) {
      qb.andWhere('t.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query.uncategorized) {
      qb.andWhere('t.category_id IS NULL').andWhere("t.type != 'TRANSFER'");
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /** Manual (re)categorization — the review loop for imported rows. */
  async update(user: User, id: string, dto: UpdateTransactionDto): Promise<Transaction> {
    const tx = await this.transactions.findOne({
      where: { id, user: { id: user.id } },
      relations: { category: true, account: true },
    });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    if (dto.categoryId !== undefined) {
      tx.category =
        dto.categoryId === null
          ? null
          : await this.categoriesService.findUsable(user, dto.categoryId);
    }
    return this.transactions.save(tx);
  }
}
