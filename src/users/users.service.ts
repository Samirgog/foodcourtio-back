import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all users with pagination and filtering
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    role?: Role,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (role) {
      where.role = role;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          telegramId: true,
          role: true,
          name: true,
          username: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single user by ID
   */
  async findOne(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        restaurants: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        employees: {
          select: {
            id: true,
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
            isActive: true,
            activeShift: true,
          },
        },
        customers: {
          select: {
            id: true,
            lastVisitFoodcourt: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  /**
   * Create a new user (Superadmin only)
   */
  async create(createUserDto: CreateUserDto, currentUser: User): Promise<User> {
    // Only superadmin can create users manually
    if (currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can create users');
    }

    // Check if user with this Telegram ID already exists
    const existingUser = await this.findByTelegramId(createUserDto.telegramId);
    if (existingUser) {
      throw new ConflictException(`User with Telegram ID ${createUserDto.telegramId} already exists`);
    }

    try {
      const user = await this.prisma.user.create({
        data: createUserDto,
      });

      // Create role-specific profiles
      if (user.role === Role.CUSTOMER) {
        await this.prisma.customer.create({
          data: {
            userId: user.id,
          },
        });
      }

      this.logger.log(`User created: ${user.name} (${user.telegramId}) by ${currentUser.name}`);
      return user;
    } catch (error) {
      this.logger.error('Error creating user', error.stack);
      throw error;
    }
  }

  /**
   * Update user information
   */
  async update(id: string, updateUserDto: UpdateUserDto, currentUser: User): Promise<User> {
    const user = await this.findOne(id);

    // Users can update their own profile (except role)
    // Superadmins can update any user
    if (currentUser.id !== user.id && currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Only superadmins can change roles
    if (updateUserDto.role && currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can change user roles');
    }

    // Prevent role changes that would create conflicts
    if (updateUserDto.role && updateUserDto.role !== user.role) {
      await this.validateRoleChange(user, updateUserDto.role);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: updateUserDto,
      });

      this.logger.log(`User updated: ${updatedUser.name} (${updatedUser.telegramId})`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Error updating user', error.stack);
      throw error;
    }
  }

  /**
   * Delete a user (Superadmin only)
   */
  async remove(id: string, currentUser: User): Promise<void> {
    if (currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can delete users');
    }

    const user = await this.findOne(id);

    // Prevent deleting the last superadmin
    if (user.role === Role.SUPERADMIN) {
      const superadminCount = await this.prisma.user.count({
        where: { role: Role.SUPERADMIN },
      });

      if (superadminCount <= 1) {
        throw new ForbiddenException('Cannot delete the last superadmin');
      }
    }

    try {
      await this.prisma.user.delete({
        where: { id },
      });

      this.logger.log(`User deleted: ${user.name} (${user.telegramId}) by ${currentUser.name}`);
    } catch (error) {
      this.logger.error('Error deleting user', error.stack);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  async findByRole(role: Role): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { role },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user role (Superadmin only)
   */
  async updateRole(id: string, role: Role, currentUser: User): Promise<User> {
    if (currentUser.role !== Role.SUPERADMIN) {
      throw new ForbiddenException('Only superadmins can change user roles');
    }

    const user = await this.findOne(id);
    
    if (user.role === role) {
      return user; // No change needed
    }

    await this.validateRoleChange(user, role);

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { role },
      });

      this.logger.log(`User role changed: ${user.name} from ${user.role} to ${role} by ${currentUser.name}`);
      return updatedUser;
    } catch (error) {
      this.logger.error('Error updating user role', error.stack);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getStatistics() {
    const [totalUsers, roleStats] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: {
          id: true,
        },
      }),
    ]);

    const roleDistribution = roleStats.reduce((acc, stat) => {
      acc[stat.role] = stat._count.id;
      return acc;
    }, {} as Record<Role, number>);

    return {
      totalUsers,
      roleDistribution,
      recentUsers: await this.prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          role: true,
          createdAt: true,
        },
      }),
    };
  }

  /**
   * Validate if role change is allowed
   */
  private async validateRoleChange(user: User, newRole: Role): Promise<void> {
    // Prevent changing the last superadmin
    if (user.role === Role.SUPERADMIN && newRole !== Role.SUPERADMIN) {
      const superadminCount = await this.prisma.user.count({
        where: { role: Role.SUPERADMIN },
      });

      if (superadminCount <= 1) {
        throw new ForbiddenException('Cannot change the role of the last superadmin');
      }
    }

    // Check for existing data that might conflict with role change
    if (user.role === Role.RESTAURANT_OWNER && newRole !== Role.RESTAURANT_OWNER) {
      const restaurantCount = await this.prisma.restaurant.count({
        where: { ownerId: user.id },
      });

      if (restaurantCount > 0) {
        throw new ConflictException(
          'Cannot change role: User owns restaurants. Transfer ownership first.',
        );
      }
    }

    if (user.role === Role.EMPLOYEE && newRole !== Role.EMPLOYEE) {
      const employeeCount = await this.prisma.employee.count({
        where: { userId: user.id, isActive: true },
      });

      if (employeeCount > 0) {
        throw new ConflictException(
          'Cannot change role: User is an active employee. Deactivate employment first.',
        );
      }
    }
  }
}