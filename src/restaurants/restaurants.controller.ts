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
  ParseEnumPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { RestaurantsService } from './restaurants.service';
import {
  CreateRestaurantDto,
  UpdateRestaurantDto,
  RestaurantResponseDto,
  RestaurantListResponseDto,
  RestaurantStatsDto,
  RestaurantPublishDto,
  UploadImageDto,
} from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RestaurantStatus, Role, User, Restaurant } from '@prisma/client';

@ApiTags('Restaurants')
@Controller('restaurants')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class RestaurantsController {
  constructor(private readonly restaurantsService: RestaurantsService) {}

  @Post()
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new restaurant',
    description: 'Create a new restaurant. Restaurant owners can create their own restaurants.',
  })
  @ApiResponse({
    status: 201,
    description: 'Restaurant created successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only restaurant owners can create restaurants',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Restaurant with this name already exists in the foodcourt',
  })
  async create(
    @Body() createRestaurantDto: CreateRestaurantDto,
    @CurrentUser() currentUser: User,
  ): Promise<Restaurant> {
    return this.restaurantsService.create(createRestaurantDto, currentUser);
  }

  @Get()
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Get all restaurants with pagination and filtering',
    description: 'Get restaurants. Restaurant owners see only their restaurants, superadmins see all.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'foodcourtId', required: false, description: 'Filter by foodcourt ID' })
  @ApiQuery({ name: 'status', required: false, enum: RestaurantStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name or description' })
  @ApiResponse({
    status: 200,
    description: 'Restaurants retrieved successfully',
    type: RestaurantListResponseDto,
  })
  async findAll(
    @CurrentUser() currentUser: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('foodcourtId') foodcourtId?: string,
    @Query('status', new ParseEnumPipe(RestaurantStatus, { optional: true })) status?: RestaurantStatus,
    @Query('search') search?: string,
  ): Promise<RestaurantListResponseDto> {
    return this.restaurantsService.findAll(page, limit, currentUser, foodcourtId, status, search);
  }

  @Public()
  @Get('by-foodcourt/:foodcourtId')
  @ApiOperation({
    summary: 'Get published restaurants by foodcourt (Public)',
    description: 'Get all published restaurants in a specific foodcourt. Used by mini-app.',
  })
  @ApiParam({ name: 'foodcourtId', description: 'Foodcourt ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurants retrieved successfully',
  })
  async getRestaurantsByFoodcourt(@Param('foodcourtId') foodcourtId: string) {
    return this.restaurantsService.getRestaurantsByFoodcourt(foodcourtId);
  }

  @Get(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN, Role.EMPLOYEE)
  @ApiOperation({
    summary: 'Get a restaurant by ID',
    description: 'Get detailed restaurant information including categories and employees.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant retrieved successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only access your own restaurants',
  })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<Restaurant> {
    return this.restaurantsService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Update a restaurant',
    description: 'Update restaurant information. Owners can update their own restaurants.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant updated successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own restaurants',
  })
  async update(
    @Param('id') id: string,
    @Body() updateRestaurantDto: UpdateRestaurantDto,
    @CurrentUser() currentUser: User,
  ): Promise<Restaurant> {
    return this.restaurantsService.update(id, updateRestaurantDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete a restaurant',
    description: 'Delete a restaurant. Cannot delete if there are pending orders.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete restaurant with pending orders',
  })
  async remove(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<{ message: string }> {
    await this.restaurantsService.remove(id, currentUser);
    return { message: 'Restaurant deleted successfully' };
  }

  @Patch(':id/publish')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Toggle restaurant published status',
    description: 'Publish or unpublish a restaurant. Restaurant must meet requirements to be published.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Restaurant publish status updated successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Restaurant does not meet publishing requirements',
  })
  async togglePublished(
    @Param('id') id: string,
    @Body() publishDto: RestaurantPublishDto,
    @CurrentUser() currentUser: User,
  ): Promise<Restaurant> {
    return this.restaurantsService.togglePublished(id, publishDto.isPublished, currentUser);
  }

  @Get(':id/statistics')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Get restaurant statistics',
    description: 'Get comprehensive restaurant statistics including revenue, orders, and trends.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: RestaurantStatsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Restaurant not found',
  })
  async getStatistics(@Param('id') id: string, @CurrentUser() currentUser: User): Promise<RestaurantStatsDto> {
    return this.restaurantsService.getStatistics(id, currentUser);
  }

  @Post(':id/upload-logo')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload restaurant logo',
    description: 'Upload a logo image for the restaurant.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiBody({
    description: 'Logo image file',
    type: UploadImageDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Logo uploaded successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() currentUser: User,
  ): Promise<Restaurant> {
    return this.restaurantsService.uploadImage(id, 'logo', file, currentUser);
  }

  @Post(':id/upload-banner')
  @Roles(Role.RESTAURANT_OWNER, Role.SUPERADMIN)
  @UseInterceptors(FileInterceptor('image'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload restaurant banner',
    description: 'Upload a banner image for the restaurant.',
  })
  @ApiParam({ name: 'id', description: 'Restaurant ID' })
  @ApiBody({
    description: 'Banner image file',
    type: UploadImageDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Banner uploaded successfully',
    type: RestaurantResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  async uploadBanner(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @CurrentUser() currentUser: User,
  ): Promise<Restaurant> {
    return this.restaurantsService.uploadImage(id, 'banner', file, currentUser);
  }
}