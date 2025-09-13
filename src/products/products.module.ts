import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PrismaModule } from '../prisma/prisma.module';
import { mkdirSync } from 'fs';
import { join } from 'path';

// Ensure uploads directory exists
const uploadsDir = join(process.cwd(), 'uploads', 'products');
try {
  mkdirSync(uploadsDir, { recursive: true });
} catch (error) {
  // Directory already exists
}

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: './uploads/products',
    }),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}