import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RestaurantStatus } from '@prisma/client';

export class RestaurantLocationDto {
  @ApiProperty({ description: 'Floor number' })
  @IsOptional()
  floor?: number;

  @ApiProperty({ description: 'Section identifier' })
  @IsString()
  @IsOptional()
  section?: string;

  @ApiProperty({ description: 'Spot number', required: false })
  @IsString()
  @IsOptional()
  spotNumber?: string;
}

export class CreateRestaurantDto {
  @ApiProperty({ description: 'Restaurant name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Restaurant description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Foodcourt ID where restaurant will be located' })
  @IsUUID()
  @IsNotEmpty()
  foodcourtId: string;

  @ApiProperty({ description: 'Restaurant location within foodcourt', type: RestaurantLocationDto, required: false })
  @ValidateNested()
  @Type(() => RestaurantLocationDto)
  @IsOptional()
  location?: RestaurantLocationDto;

  @ApiProperty({ description: 'Restaurant status', enum: RestaurantStatus, required: false })
  @IsEnum(RestaurantStatus)
  @IsOptional()
  status?: RestaurantStatus;

  @ApiProperty({ description: 'Whether restaurant is published', required: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  @ApiProperty({ description: 'Restaurant name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Restaurant description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Restaurant location within foodcourt', required: false })
  @ValidateNested()
  @Type(() => RestaurantLocationDto)
  @IsOptional()
  location?: RestaurantLocationDto;

  @ApiProperty({ description: 'Restaurant status', enum: RestaurantStatus, required: false })
  @IsEnum(RestaurantStatus)
  @IsOptional()
  status?: RestaurantStatus;

  @ApiProperty({ description: 'Whether restaurant is published', required: false })
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class RestaurantResponseDto {
  @ApiProperty({ description: 'Restaurant ID' })
  id: string;

  @ApiProperty({ description: 'Restaurant name' })
  name: string;

  @ApiProperty({ description: 'Restaurant description', required: false })
  description?: string;

  @ApiProperty({ description: 'Logo URL', required: false })
  logo?: string;

  @ApiProperty({ description: 'Banner image URL', required: false })
  banner?: string;

  @ApiProperty({ description: 'Restaurant status', enum: RestaurantStatus })
  status: RestaurantStatus;

  @ApiProperty({ description: 'Whether restaurant is published' })
  isPublished: boolean;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Foodcourt information' })
  foodcourt: {
    id: string;
    name: string;
    address: string;
  };

  @ApiProperty({ description: 'Owner information' })
  owner: {
    id: string;
    name: string;
    username?: string;
  };

  @ApiProperty({ description: 'Restaurant location', required: false })
  location?: any;

  @ApiProperty({ description: 'Statistics' })
  stats?: {
    totalOrders: number;
    totalRevenue: number;
    categoriesCount: number;
    productsCount: number;
    employeesCount: number;
  };
}

export class RestaurantListResponseDto {
  @ApiProperty({ description: 'List of restaurants', type: [RestaurantResponseDto] })
  restaurants: RestaurantResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class RestaurantStatsDto {
  @ApiProperty({ description: 'Total orders count' })
  totalOrders: number;

  @ApiProperty({ description: 'Total revenue amount' })
  totalRevenue: number;

  @ApiProperty({ description: 'Monthly revenue trend' })
  monthlyRevenue: { month: string; revenue: number; orders: number }[];

  @ApiProperty({ description: 'Top selling products' })
  topProducts: {
    id: string;
    name: string;
    totalSold: number;
    revenue: number;
  }[];

  @ApiProperty({ description: 'Order status distribution' })
  orderStatusStats: {
    status: string;
    count: number;
  }[];

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Customer count' })
  customerCount: number;

  @ApiProperty({ description: 'Rating statistics' })
  ratingStats?: {
    averageRating: number;
    totalRatings: number;
  };
}

export class UploadImageDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Image file (logo or banner)' })
  image: Express.Multer.File;
}

export class RestaurantPublishDto {
  @ApiProperty({ description: 'Whether to publish or unpublish the restaurant' })
  @IsBoolean()
  isPublished: boolean;
}