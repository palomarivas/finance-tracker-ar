import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsUUID } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ImportBatch } from './entities/import-batch.entity';
import { ImportService, ImportSummary } from './import.service';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

class UploadStatementDto {
  @IsUUID()
  accountId: string;
}

@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  upload(
    @CurrentUser() user: User,
    @Body() dto: UploadStatementDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<ImportSummary> {
    if (!file) {
      throw new BadRequestException('Missing "file" upload field');
    }
    return this.importService.importStatement(
      user,
      dto.accountId,
      file.originalname,
      file.buffer,
    );
  }

  @Get('batches')
  batches(@CurrentUser() user: User): Promise<ImportBatch[]> {
    return this.importService.listBatches(user);
  }

  /** Undo an import: removes the batch and (by cascade) all its transactions. */
  @Delete('batches/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBatch(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.importService.deleteBatch(user, id);
  }
}
