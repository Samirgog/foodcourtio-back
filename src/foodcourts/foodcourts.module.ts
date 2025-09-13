import { Module } from '@nestjs/common';
import { FoodcourtsService } from './foodcourts.service';
import { FoodcourtsController } from './foodcourts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FoodcourtsController],
  providers: [FoodcourtsService],
  exports: [FoodcourtsService],
})
export class FoodcourtsModule {}