import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
  ) {}

  /**
   * The user's categories plus the shared system defaults (user IS NULL).
   * `loadRelationIds` exposes only the owner's id (never the full User, so no
   * passwordHash leaks) — enough for the client to mark system categories as
   * read-only via `user === null`.
   */
  findAll(user: User): Promise<Category[]> {
    return this.categories.find({
      where: [{ user: { id: user.id } }, { user: IsNull() }],
      relations: { parent: true },
      loadRelationIds: { relations: ['user'] },
      order: { kind: 'ASC', name: 'ASC' },
    });
  }

  async create(user: User, dto: CreateCategoryDto): Promise<Category> {
    const parent = dto.parentId
      ? await this.findUsable(user, dto.parentId)
      : null;
    if (parent && parent.kind !== dto.kind) {
      throw new BadRequestException(
        `Parent category is ${parent.kind}, the child must match`,
      );
    }
    return this.categories.save(
      this.categories.create({
        name: dto.name,
        kind: dto.kind,
        parent,
        user: { id: user.id } as User,
      }),
    );
  }

  async update(user: User, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOwned(user, id);
    if (dto.name !== undefined) {
      category.name = dto.name;
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        category.parent = null;
      } else {
        if (dto.parentId === id) {
          throw new BadRequestException('A category cannot be its own parent');
        }
        const parent = await this.findUsable(user, dto.parentId);
        if (parent.kind !== category.kind) {
          throw new BadRequestException(
            `Parent category is ${parent.kind}, the child must match`,
          );
        }
        category.parent = parent;
      }
    }
    return this.categories.save(category);
  }

  /** Only the user's own categories can be deleted, never system defaults. */
  async remove(user: User, id: string): Promise<void> {
    const category = await this.findOwned(user, id);
    await this.categories.remove(category);
  }

  /** A category the user may reference: their own or a system default. */
  async findUsable(user: User, id: string): Promise<Category> {
    const category = await this.categories.findOne({
      where: [
        { id, user: { id: user.id } },
        { id, user: IsNull() },
      ],
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async findOwned(user: User, id: string): Promise<Category> {
    const category = await this.categories.findOne({
      where: { id, user: { id: user.id } },
      relations: { parent: true },
    });
    if (!category) {
      throw new NotFoundException('Category not found (system categories are read-only)');
    }
    return category;
  }
}
