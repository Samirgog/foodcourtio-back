import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Layout DTOs for map management
export class PositionDto {
  @ApiProperty({ description: 'X coordinate' })
  @IsNumber()
  @Min(0)
  x: number;

  @ApiProperty({ description: 'Y coordinate' })
  @IsNumber()
  @Min(0)
  y: number;
}

export class SizeDto {
  @ApiProperty({ description: 'Width' })
  @IsNumber()
  @Min(1)
  width: number;

  @ApiProperty({ description: 'Height' })
  @IsNumber()
  @Min(1)
  height: number;
}

export class MapRestaurantDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Restaurant name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Position on map', type: PositionDto })
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;

  @ApiProperty({ description: 'Size on map', type: SizeDto })
  @ValidateNested()
  @Type(() => SizeDto)
  size: SizeDto;

  @ApiProperty({ description: 'Rotation angle in degrees', required: false })
  @IsNumber()
  @Min(0)
  @Max(360)
  @IsOptional()
  rotation?: number;
}

export class MapTableDto {
  @ApiProperty({ description: 'Table ID' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'Table number' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ description: 'Position on map', type: PositionDto })
  @ValidateNested()
  @Type(() => PositionDto)
  position: PositionDto;

  @ApiProperty({ description: 'Table size (diameter for round tables)', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  size?: number;

  @ApiProperty({ description: 'Table shape', enum: ['round', 'square', 'rectangle'], required: false })
  @IsString()
  @IsOptional()
  shape?: 'round' | 'square' | 'rectangle';

  @ApiProperty({ description: 'Number of seats', required: false })
  @IsNumber()
  @Min(1)
  @IsOptional()
  seats?: number;
}

export class FoodcourtLayoutDto {
  @ApiProperty({ description: 'Map width in pixels' })
  @IsNumber()
  @Min(100)
  @Max(5000)
  width: number;

  @ApiProperty({ description: 'Map height in pixels' })
  @IsNumber()
  @Min(100)
  @Max(5000)
  height: number;

  @ApiProperty({ description: 'Background image URL', required: false })
  @IsString()
  @IsOptional()
  backgroundImage?: string;

  @ApiProperty({ description: 'Restaurants on the map', type: [MapRestaurantDto] })
  @ValidateNested({ each: true })
  @Type(() => MapRestaurantDto)
  restaurants: MapRestaurantDto[];

  @ApiProperty({ description: 'Tables on the map', type: [MapTableDto] })
  @ValidateNested({ each: true })
  @Type(() => MapTableDto)
  tables: MapTableDto[];

  @ApiProperty({ description: 'Additional map metadata', required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateFoodcourtDto {
  @ApiProperty({ description: 'Foodcourt name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Foodcourt address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Foodcourt description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Commission rate (0-1)', example: 0.10 })
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate: number;

  @ApiProperty({ description: 'Initial layout configuration', type: FoodcourtLayoutDto, required: false })
  @ValidateNested()
  @Type(() => FoodcourtLayoutDto)
  @IsOptional()
  layout?: FoodcourtLayoutDto;

  @ApiProperty({ description: 'Whether foodcourt is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFoodcourtDto extends PartialType(CreateFoodcourtDto) {}

export class UpdateFoodcourtLayoutDto {
  @ApiProperty({ description: 'Layout configuration', type: FoodcourtLayoutDto })
  @ValidateNested()
  @Type(() => FoodcourtLayoutDto)
  layout: FoodcourtLayoutDto;
}

export class FoodcourtResponseDto {
  @ApiProperty({ description: 'Foodcourt ID' })
  id: string;

  @ApiProperty({ description: 'Foodcourt name' })
  name: string;

  @ApiProperty({ description: 'Foodcourt address' })
  address: string;

  @ApiProperty({ description: 'Foodcourt description', required: false })
  description?: string;

  @ApiProperty({ description: 'Layout configuration', required: false })
  layout?: any;

  @ApiProperty({ description: 'Whether foodcourt is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Commission rate' })
  commissionRate: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Number of restaurants' })
  restaurantCount?: number;

  @ApiProperty({ description: 'Number of tables' })
  tableCount?: number;
}

export class FoodcourtListResponseDto {
  @ApiProperty({ description: 'List of foodcourts', type: [FoodcourtResponseDto] })
  foodcourts: FoodcourtResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;
}

export class FoodcourtStatsDto {
  @ApiProperty({ description: 'Total revenue' })
  totalRevenue: number;

  @ApiProperty({ description: 'Total commission earned' })
  totalCommission: number;

  @ApiProperty({ description: 'Total orders' })
  totalOrders: number;

  @ApiProperty({ description: 'Active restaurants count' })
  activeRestaurants: number;

  @ApiProperty({ description: 'Total customers' })
  totalCustomers: number;

  @ApiProperty({ description: 'Average order value' })
  averageOrderValue: number;

  @ApiProperty({ description: 'Monthly revenue trend' })
  monthlyRevenue: { month: string; revenue: number; commission: number }[];
}