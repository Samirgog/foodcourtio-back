import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category priority (lower number = higher priority)', default: 0 })
  @IsNumber()
  @Min(0)
  priority: number;

  @ApiProperty({ description: 'Whether category is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Whether this is a draft (autosave)', default: true })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {
  @ApiProperty({ description: 'Category name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Category description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Category priority', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiProperty({ description: 'Whether category is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Whether this is a draft', required: false })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}

export class CategoryResponseDto {
  @ApiProperty({ description: 'Category ID' })
  id: string;

  @ApiProperty({ description: 'Category name' })
  name: string;

  @ApiProperty({ description: 'Category description', required: false })
  description?: string;

  @ApiProperty({ description: 'Category priority' })
  priority: number;

  @ApiProperty({ description: 'Whether category is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Whether this is a draft' })
  isDraft: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Restaurant ID' })
  restaurantId: string;

  @ApiProperty({ description: 'Number of products in this category' })
  productsCount?: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ 
    description: 'Array of category IDs in the desired order',
    type: [String],
    example: ['cat1', 'cat2', 'cat3']
  })
  @IsUUID(4, { each: true })
  categoryIds: string[];
}

export class PublishCategoryDto {
  @ApiProperty({ description: 'Whether to publish the category (false = save as draft)' })
  @IsBoolean()
  isPublished: boolean;
}