import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { FoodcourtsService } from './foodcourts.service';
import {
  CreateFoodcourtDto,
  UpdateFoodcourtDto,
  UpdateFoodcourtLayoutDto,
  FoodcourtResponseDto,
  FoodcourtListResponseDto,
  FoodcourtStatsDto,
} from './dto/foodcourt.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Foodcourts')
@Controller('foodcourts')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class FoodcourtsController {
  constructor(private readonly foodcourtsService: FoodcourtsService) {}

  @Post()
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new foodcourt (Superadmin only)',
    description: 'Create a new foodcourt with optional layout configuration.',
  })
  @ApiResponse({
    status: 201,
    description: 'Foodcourt created successfully',
    type: FoodcourtResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only superadmins can create foodcourts',
  })
  async create(@Body() createFoodcourtDto: CreateFoodcourtDto): Promise<FoodcourtResponseDto> {
    return this.foodcourtsService.create(createFoodcourtDto);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({
    summary: 'Get all foodcourts with pagination and filtering',
    description: 'Get a paginated list of foodcourts. Supports search and filtering.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, address, or description' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourts retrieved successfully',
    type: FoodcourtListResponseDto,
  })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('search') search?: string,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
  ): Promise<FoodcourtListResponseDto> {
    return this.foodcourtsService.findAll(page, limit, search, isActive);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({
    summary: 'Get a foodcourt by ID',
    description: 'Get detailed information about a specific foodcourt including restaurants and tables.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourt retrieved successfully',
    type: FoodcourtResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async findOne(@Param('id') id: string): Promise<FoodcourtResponseDto> {
    return this.foodcourtsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Update a foodcourt (Superadmin only)',
    description: 'Update foodcourt information including layout configuration.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourt updated successfully',
    type: FoodcourtResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateFoodcourtDto: UpdateFoodcourtDto,
  ): Promise<FoodcourtResponseDto> {
    return this.foodcourtsService.update(id, updateFoodcourtDto);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete a foodcourt (Superadmin only)',
    description: 'Delete a foodcourt. Cannot delete if there are active restaurants or pending orders.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourt deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete foodcourt with active restaurants or pending orders',
  })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.foodcourtsService.remove(id);
    return { message: 'Foodcourt deleted successfully' };
  }

  @Patch(':id/layout')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Update foodcourt layout (Superadmin only)',
    description: 'Update the map layout configuration for a foodcourt.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourt layout updated successfully',
    type: FoodcourtResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid layout configuration',
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async updateLayout(
    @Param('id') id: string,
    @Body() updateLayoutDto: UpdateFoodcourtLayoutDto,
  ): Promise<FoodcourtResponseDto> {
    return this.foodcourtsService.updateLayout(id, updateLayoutDto);
  }

  @Patch(':id/toggle-active')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Toggle foodcourt active status (Superadmin only)',
    description: 'Activate or deactivate a foodcourt.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Foodcourt status toggled successfully',
    type: FoodcourtResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async toggleActive(@Param('id') id: string): Promise<FoodcourtResponseDto> {
    return this.foodcourtsService.toggleActive(id);
  }

  @Get(':id/statistics')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Get foodcourt statistics (Superadmin only)',
    description: 'Get comprehensive statistics for a foodcourt including revenue, orders, and trends.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: FoodcourtStatsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async getStatistics(@Param('id') id: string): Promise<FoodcourtStatsDto> {
    return this.foodcourtsService.getStatistics(id);
  }

  @Get(':id/restaurants')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({
    summary: 'Get restaurant assignments for foodcourt',
    description: 'Get all restaurants assigned to a specific foodcourt.',
  })
  @ApiParam({ name: 'id', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant assignments retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Foodcourt not found',
  })
  async getRestaurantAssignments(@Param('id') id: string) {
    return this.foodcourtsService.getRestaurantAssignments(id);
  }
}