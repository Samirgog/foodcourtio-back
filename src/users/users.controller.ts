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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UserResponseDto,
  UsersListResponseDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Create a new user (Superadmin only)',
    description: 'Create a new user account. Only superadmins can create users manually.',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only superadmins can create users',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - User with this Telegram ID already exists',
  })
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto, currentUser);
  }

  @Get()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({
    summary: 'Get all users with pagination and filtering',
    description: 'Get a paginated list of users. Superadmins can see all users, restaurant owners can see their employees.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'role', required: false, enum: Role, description: 'Filter by role' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, username, or Telegram ID' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: UsersListResponseDto,
  })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('role', new ParseEnumPipe(Role, { optional: true })) role?: Role,
    @Query('search') search?: string,
  ): Promise<UsersListResponseDto> {
    return this.usersService.findAll(page, limit, role, search);
  }

  @Get('statistics')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Get user statistics (Superadmin only)',
    description: 'Get comprehensive user statistics including role distribution.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics() {
    return this.usersService.getStatistics();
  }

  @Get('by-role/:role')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Get users by role (Superadmin only)',
    description: 'Get all users with a specific role.',
  })
  @ApiParam({ name: 'role', enum: Role })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    type: [UserResponseDto],
  })
  async findByRole(
    @Param('role', new ParseEnumPipe(Role)) role: Role,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findByRole(role);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a user by ID',
    description: 'Get detailed information about a specific user.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a user',
    description: 'Update user information. Users can update their own profile, superadmins can update any user.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - You can only update your own profile or need superadmin rights',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto, currentUser);
  }

  @Patch(':id/role')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Update user role (Superadmin only)',
    description: "Change a user's role. Only superadmins can perform this action.",
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
    type: UserResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only superadmins can change user roles',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Role change not allowed due to existing data',
  })
  async updateRole(
    @Param('id') id: string,
    @Body('role', new ParseEnumPipe(Role)) role: Role,
    @CurrentUser() currentUser: User,
  ): Promise<UserResponseDto> {
    return this.usersService.updateRole(id, role, currentUser);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN)
  @ApiOperation({
    summary: 'Delete a user (Superadmin only)',
    description: 'Delete a user account. Only superadmins can delete users.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only superadmins can delete users',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ): Promise<{ message: string }> {
    await this.usersService.remove(id, currentUser);
    return { message: 'User deleted successfully' };
  }
}