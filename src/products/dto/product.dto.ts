import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  IsUUID,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @ApiProperty({ description: 'Variant name (e.g., "Small", "Medium", "Large")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Price modifier (can be positive or negative)', example: -2.50 })
  @IsNumber()
  priceModifier: number;

  @ApiProperty({ description: 'Whether this is the default variant', required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class CreateProductDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Product description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Base price of the product' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiProperty({ description: 'Product weight', required: false })
  @IsString()
  @IsOptional()
  weight?: string;

  @ApiProperty({ description: 'Product volume', required: false })
  @IsString()
  @IsOptional()
  volume?: string;

  @ApiProperty({ 
    description: 'Product variants (max 3)', 
    type: [ProductVariantDto], 
    required: false,
    maxItems: 3
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @ArrayMaxSize(3)
  @IsOptional()
  variants?: ProductVariantDto[];

  @ApiProperty({ description: 'Whether product is available', default: true })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiProperty({ description: 'Product priority (lower number = higher priority)', default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiProperty({ description: 'Whether this is a draft (autosave)', default: true })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;

  @ApiProperty({ description: 'Category ID' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({ description: 'Product image URL', required: false })
  @IsString()
  @IsOptional()
  image?: string;
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiProperty({ description: 'Product name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Product description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Base price of the product', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiProperty({ description: 'Product weight', required: false })
  @IsString()
  @IsOptional()
  weight?: string;

  @ApiProperty({ description: 'Product volume', required: false })
  @IsString()
  @IsOptional()
  volume?: string;

  @ApiProperty({ 
    description: 'Product variants (max 3)', 
    type: [ProductVariantDto], 
    required: false 
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @ArrayMaxSize(3)
  @IsOptional()
  variants?: ProductVariantDto[];

  @ApiProperty({ description: 'Whether product is available', required: false })
  @IsBoolean()
  @IsOptional()
  isAvailable?: boolean;

  @ApiProperty({ description: 'Product priority', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiProperty({ description: 'Whether this is a draft', required: false })
  @IsBoolean()
  @IsOptional()
  isDraft?: boolean;
}

export class ProductResponseDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'Product description', required: false })
  description?: string;

  @ApiProperty({ description: 'Product image URL', required: false })
  image?: string;

  @ApiProperty({ description: 'Base price of the product' })
  price: number;

  @ApiProperty({ description: 'Product weight', required: false })
  weight?: string;

  @ApiProperty({ description: 'Product volume', required: false })
  volume?: string;

  @ApiProperty({ description: 'Product variants', required: false })
  variants?: any;

  @ApiProperty({ description: 'Whether product is available' })
  isAvailable: boolean;

  @ApiProperty({ description: 'Product priority' })
  priority: number;

  @ApiProperty({ description: 'Whether this is a draft' })
  isDraft: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Category ID' })
  categoryId: string;

  @ApiProperty({ description: 'Category information' })
  category?: {
    id: string;
    name: string;
  };
}

export class ReorderProductsDto {
  @ApiProperty({ 
    description: 'Array of product IDs in the desired order',
    type: [String],
    example: ['prod1', 'prod2', 'prod3']
  })
  @IsUUID(4, { each: true })
  productIds: string[];
}

export class MoveProductDto {
  @ApiProperty({ description: 'Target category ID' })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;
}

export class DuplicateProductDto {
  @ApiProperty({ description: 'New product name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Target category ID (if moving to different category)', required: false })
  @IsUUID()
  @IsOptional()
  categoryId?: string;
}

export class PublishProductDto {
  @ApiProperty({ description: 'Whether to publish the product (false = save as draft)' })
  @IsBoolean()
  isPublished: boolean;
}

export class UploadProductImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Product image file' })
  image: Express.Multer.File;
}

export class ProductStatisticsDto {
  @ApiProperty({ description: 'Total products count' })
  totalProducts: number;

  @ApiProperty({ description: 'Published products count' })
  publishedProducts: number;

  @ApiProperty({ description: 'Draft products count' })
  draftProducts: number;

  @ApiProperty({ description: 'Out of stock products count' })
  outOfStockProducts: number;

  @ApiProperty({ description: 'Publish rate percentage' })
  publishRate: number;

  @ApiProperty({ description: 'Popular products list' })
  popularProducts: {
    id: string;
    name: string;
    category: string;
    price: number;
    orderCount: number;
  }[];
}