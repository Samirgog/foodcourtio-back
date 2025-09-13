import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreateInviteLinkDto,
  UseInviteLinkDto,
  CreateShiftDto,
  UpdateShiftDto,
  ClockInDto,
  ClockOutDto,
  EmployeeRole,
  ShiftStatus,
  InviteLinkStatus,
} from './dto/employee.dto';
import { Employee, User, Role, InviteLink } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new employee
   */
  async create(createEmployeeDto: CreateEmployeeDto, currentUser: User): Promise<Employee> {
    // Verify user has access to this restaurant
    await this.verifyRestaurantAccess(createEmployeeDto.restaurantId, currentUser);

    try {
      // Check if employee with this phone already exists in this restaurant
      const existingEmployee = await this.prisma.employee.findFirst({
        where: {
          phone: createEmployeeDto.phone,
          restaurantId: createEmployeeDto.restaurantId,
        },
      });

      if (existingEmployee) {
        throw new BadRequestException('Employee with this phone number already exists in this restaurant');
      }

      const employee = await this.prisma.employee.create({
        data: {
          name: createEmployeeDto.name,
          phone: createEmployeeDto.phone,
          email: createEmployeeDto.email,
          role: createEmployeeDto.role as any,
          hourlyWage: createEmployeeDto.hourlyWage,
          schedule: createEmployeeDto.schedule,
          isActive: createEmployeeDto.isActive ?? true,
          restaurantId: createEmployeeDto.restaurantId,
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Employee created: ${employee.name} in restaurant ${createEmployeeDto.restaurantId}`);
      return employee;
    } catch (error) {
      this.logger.error('Error creating employee', error.stack);
      throw error;
    }
  }

  /**
   * Get all employees for a restaurant
   */
  async findAllByRestaurant(
    restaurantId: string,
    currentUser: User,
    includeInactive: boolean = false,
  ): Promise<Employee[]> {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const where: any = { restaurantId };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            telegramId: true,
          },
        },
        shifts: {
          where: {
            status: 'ACTIVE' as any,
          },
          select: {
            id: true,
            startTime: true,
            status: true,
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single employee by ID
   */
  async findOne(id: string, currentUser: User): Promise<Employee> {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            telegramId: true,
          },
        },
        shifts: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    // Verify access
    if (currentUser.role === Role.RESTAURANT_OWNER && employee.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access employees from your own restaurants');
    }

    if (currentUser.role === Role.EMPLOYEE && employee.userId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own employee profile');
    }

    return employee;
  }

  /**
   * Update an employee
   */
  async update(id: string, updateEmployeeDto: UpdateEmployeeDto, currentUser: User): Promise<Employee> {
    const employee = await this.findOne(id, currentUser);

    try {
      const { restaurantId, ...rawData } = updateEmployeeDto;
      
      // Cast role properly if it exists
      const dataToUpdate: any = { ...rawData };
      
      const updatedEmployee = await this.prisma.employee.update({
        where: { id },
        data: dataToUpdate,
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              telegramId: true,
            },
          },
        },
      });

      this.logger.log(`Employee updated: ${updatedEmployee.name}`);
      return updatedEmployee;
    } catch (error) {
      this.logger.error('Error updating employee', error.stack);
      throw error;
    }
  }

  /**
   * Delete an employee (soft delete - set as inactive)
   */
  async remove(id: string, currentUser: User): Promise<void> {
    const employee = await this.findOne(id, currentUser);

    try {
      await this.prisma.employee.update({
        where: { id },
        data: { isActive: false },
      });

      this.logger.log(`Employee deactivated: ${employee.name}`);
    } catch (error) {
      this.logger.error('Error deactivating employee', error.stack);
      throw error;
    }
  }

  /**
   * Create an invite link for employee recruitment
   */
  async createInviteLink(createInviteLinkDto: CreateInviteLinkDto, currentUser: User): Promise<InviteLink> {
    await this.verifyRestaurantAccess(createInviteLinkDto.restaurantId, currentUser);

    try {
      // Generate unique token
      const token = randomBytes(32).toString('hex');
      
      const inviteLink = await this.prisma.inviteLink.create({
        data: {
          token,
          role: createInviteLinkDto.role as any,
          status: InviteLinkStatus.ACTIVE as any,
          expiresAt: new Date(createInviteLinkDto.expiresAt),
          hourlyWage: createInviteLinkDto.hourlyWage,
          notes: createInviteLinkDto.notes,
          maxUses: createInviteLinkDto.maxUses ?? 1,
          usedCount: 0,
          restaurantId: createInviteLinkDto.restaurantId,
          createdBy: currentUser.id,
        },
        include: {
          restaurant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      this.logger.log(`Invite link created for restaurant ${createInviteLinkDto.restaurantId}, role: ${createInviteLinkDto.role}`);
      return inviteLink;
    } catch (error) {
      this.logger.error('Error creating invite link', error.stack);
      throw error;
    }
  }

  /**
   * Use an invite link to become an employee
   */
  async useInviteLink(useInviteLinkDto: UseInviteLinkDto, currentUser: User): Promise<Employee> {
    const inviteLink = await this.prisma.inviteLink.findUnique({
      where: { token: useInviteLinkDto.token },
      include: {
        restaurant: true,
      },
    });

    if (!inviteLink) {
      throw new NotFoundException('Invalid invite link');
    }

    // Validate invite link
    if (inviteLink.status !== InviteLinkStatus.ACTIVE as any) {
      throw new BadRequestException('Invite link is no longer active');
    }

    if (new Date() > inviteLink.expiresAt) {
      throw new BadRequestException('Invite link has expired');
    }

    if (inviteLink.usedCount >= inviteLink.maxUses) {
      throw new BadRequestException('Invite link has reached maximum uses');
    }

    // Check if user is already an employee
    const existingEmployee = await this.prisma.employee.findFirst({
      where: {
        userId: currentUser.id,
        restaurantId: inviteLink.restaurantId,
      },
    });

    if (existingEmployee) {
      throw new BadRequestException('You are already an employee at this restaurant');
    }

    try {
      // Create employee and update invite link in transaction
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create employee
        const employee = await prisma.employee.create({
          data: {
            name: useInviteLinkDto.name,
            phone: useInviteLinkDto.phone,
            email: useInviteLinkDto.email,
            role: inviteLink.role as any,
            hourlyWage: inviteLink.hourlyWage,
            isActive: true,
            restaurantId: inviteLink.restaurantId,
            userId: currentUser.id,
          },
          include: {
            restaurant: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                telegramId: true,
              },
            },
          },
        });

        // Update invite link usage
        await prisma.inviteLink.update({
          where: { id: inviteLink.id },
          data: {
            usedCount: { increment: 1 },
            status: inviteLink.usedCount + 1 >= inviteLink.maxUses 
              ? InviteLinkStatus.USED as any 
              : inviteLink.status,
          },
        });

        return employee;
      });

      this.logger.log(`Employee created via invite link: ${result.name} at ${inviteLink.restaurant.name}`);
      return result;
    } catch (error) {
      this.logger.error('Error using invite link', error.stack);
      throw error;
    }
  }

  /**
   * Get all invite links for a restaurant
   */
  async getInviteLinks(restaurantId: string, currentUser: User): Promise<InviteLink[]> {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    return this.prisma.inviteLink.findMany({
      where: { restaurantId },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Revoke an invite link
   */
  async revokeInviteLink(id: string, currentUser: User): Promise<InviteLink> {
    const inviteLink = await this.prisma.inviteLink.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
    });

    if (!inviteLink) {
      throw new NotFoundException('Invite link not found');
    }

    // Verify access
    if (currentUser.role === Role.RESTAURANT_OWNER && inviteLink.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only revoke invite links from your own restaurants');
    }

    return this.prisma.inviteLink.update({
      where: { id },
      data: {
        status: InviteLinkStatus.REVOKED as any,
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Create a shift for an employee
   */
  async createShift(createShiftDto: CreateShiftDto, currentUser: User) {
    const employee = await this.findOne(createShiftDto.employeeId, currentUser);

    // Validate shift times
    const startTime = new Date(createShiftDto.startTime);
    const endTime = new Date(createShiftDto.endTime);

    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for overlapping shifts
    const overlappingShift = await this.prisma.$queryRaw`
      SELECT id FROM "Shift" 
      WHERE "employeeId" = ${createShiftDto.employeeId}
        AND status IN ('SCHEDULED', 'ACTIVE')
        AND (
          ("startTime" <= ${startTime} AND "endTime" > ${startTime}) OR
          ("startTime" < ${endTime} AND "endTime" >= ${endTime}) OR
          ("startTime" >= ${startTime} AND "endTime" <= ${endTime})
        )
      LIMIT 1
    `;

    if (Array.isArray(overlappingShift) && overlappingShift.length > 0) {
      throw new BadRequestException('Employee has overlapping shift scheduled');
    }

    try {
      const shift = await this.prisma.shift.create({
        data: {
          startTime,
          endTime,
          breakDuration: createShiftDto.breakDuration || 0,
          notes: createShiftDto.notes,
          status: 'SCHEDULED' as any,
          employeeId: createShiftDto.employeeId,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      this.logger.log(`Shift scheduled for employee ${employee.name}: ${startTime} - ${endTime}`);
      return shift;
    } catch (error) {
      this.logger.error('Error creating shift', error.stack);
      throw error;
    }
  }

  /**
   * Clock in an employee
   */
  async clockIn(clockInDto: ClockInDto, currentUser: User) {
    const employee = await this.findOne(clockInDto.employeeId, currentUser);

    // Check if employee already has an active shift
    const activeShift = await this.prisma.shift.findFirst({
      where: {
        employeeId: clockInDto.employeeId,
        status: 'ACTIVE' as any,
      },
    });

    if (activeShift) {
      throw new BadRequestException('Employee is already clocked in');
    }

    // Find scheduled shift for today or create new one
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    let shift = await this.prisma.shift.findFirst({
      where: {
        employeeId: clockInDto.employeeId,
        status: 'SCHEDULED' as any,
        startTime: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    try {
      if (shift) {
        // Update existing scheduled shift
        shift = await this.prisma.shift.update({
          where: { id: shift.id },
          data: {
            status: 'ACTIVE' as any,
            actualStartTime: now,
            notes: shift.notes 
              ? `${shift.notes}\nClocked in: ${clockInDto.notes || 'No notes'}`
              : `Clocked in: ${clockInDto.notes || 'No notes'}`,
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });
      } else {
        // Create new shift if no scheduled shift found
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        shift = await this.prisma.shift.create({
          data: {
            startTime: now,
            endTime: endOfDay,
            actualStartTime: now,
            status: 'ACTIVE' as any,
            notes: `Unscheduled shift. Clocked in: ${clockInDto.notes || 'No notes'}`,
            employeeId: clockInDto.employeeId,
          },
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        });
      }

      this.logger.log(`Employee clocked in: ${employee.name} at ${now}`);
      return shift;
    } catch (error) {
      this.logger.error('Error clocking in employee', error.stack);
      throw error;
    }
  }

  /**
   * Clock out an employee
   */
  async clockOut(clockOutDto: ClockOutDto, currentUser: User) {
    const shift = await this.prisma.shift.findUnique({
      where: { id: clockOutDto.shiftId },
      include: {
        employee: {
          include: {
            restaurant: {
              select: {
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    // Verify access
    if (currentUser.role === Role.EMPLOYEE && shift.employee.userId !== currentUser.id) {
      throw new ForbiddenException('You can only clock out from your own shifts');
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && shift.employee.restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only manage shifts in your own restaurants');
    }

    if (shift.status !== 'ACTIVE' as any) {
      throw new BadRequestException('Can only clock out from active shifts');
    }

    const now = new Date();
    const startTime = shift.actualStartTime || shift.startTime;
    const hoursWorked = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    const adjustedHours = Math.max(0, hoursWorked - (shift.breakDuration || 0) / 60);

    try {
      const completedShift = await this.prisma.shift.update({
        where: { id: clockOutDto.shiftId },
        data: {
          status: 'COMPLETED' as any,
          actualEndTime: now,
          notes: shift.notes 
            ? `${shift.notes}\nClocked out: ${clockOutDto.notes || 'No notes'}`
            : `Clocked out: ${clockOutDto.notes || 'No notes'}`,
        },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              role: true,
              hourlyWage: true,
            },
          },
        },
      });

      this.logger.log(`Employee clocked out: ${shift.employee.name}, hours worked: ${adjustedHours.toFixed(2)}`);
      
      // Add calculated fields
      return {
        ...completedShift,
        hoursWorked: adjustedHours,
        calculatedPay: shift.employee.hourlyWage ? adjustedHours * (shift.employee.hourlyWage / 100) : null,
      };
    } catch (error) {
      this.logger.error('Error clocking out employee', error.stack);
      throw error;
    }
  }

  /**
   * Get shifts for a restaurant
   */
  async getShifts(
    restaurantId: string,
    currentUser: User,
    startDate?: string,
    endDate?: string,
    employeeId?: string,
    status?: ShiftStatus,
  ) {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const where: any = {
      employee: {
        restaurantId,
      },
    };

    if (startDate && endDate) {
      where.startTime = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.shift.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            role: true,
            hourlyWage: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });
  }

  /**
   * Get employee statistics
   */
  async getStatistics(restaurantId: string, currentUser: User) {
    await this.verifyRestaurantAccess(restaurantId, currentUser);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      totalEmployees,
      activeEmployees,
      clockedInEmployees,
      employeesByRole,
      shiftsThisWeek,
      weeklyStats,
      topPerformers,
    ] = await Promise.all([
      // Total employees
      this.prisma.employee.count({
        where: { restaurantId },
      }),

      // Active employees
      this.prisma.employee.count({
        where: {
          restaurantId,
          isActive: true,
        },
      }),

      // Currently clocked in employees
      this.prisma.employee.count({
        where: {
          restaurantId,
          isActive: true,
          shifts: {
            some: {
              status: 'ACTIVE' as any,
            },
          },
        },
      }),

      // Employees by role
      this.prisma.employee.groupBy({
        by: ['role'],
        where: {
          restaurantId,
          isActive: true,
        },
        _count: true,
      }),

      // Shifts this week
      this.prisma.shift.count({
        where: {
          employee: {
            restaurantId,
          },
          startTime: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      }),

      // Weekly hours and payroll
      this.prisma.$queryRaw`
        SELECT 
          SUM(
            EXTRACT(EPOCH FROM (
              COALESCE("actualEndTime", "endTime") - 
              COALESCE("actualStartTime", "startTime")
            )) / 3600 - 
            COALESCE("breakDuration", 0) / 60.0
          ) as total_hours,
          SUM(
            (EXTRACT(EPOCH FROM (
              COALESCE("actualEndTime", "endTime") - 
              COALESCE("actualStartTime", "startTime")
            )) / 3600 - 
            COALESCE("breakDuration", 0) / 60.0) * 
            COALESCE(e."hourlyWage", 0) / 100.0
          ) as total_payroll
        FROM "Shift" s
        JOIN "Employee" e ON s."employeeId" = e.id
        WHERE e."restaurantId" = ${restaurantId}
          AND s."startTime" >= ${weekStart}
          AND s."startTime" < ${weekEnd}
          AND s.status IN ('COMPLETED', 'ACTIVE')
      `,

      // Top performers this week
      this.prisma.$queryRaw`
        SELECT 
          e.id as "employeeId",
          e.name,
          COUNT(s.id) as "shiftsCompleted",
          SUM(
            EXTRACT(EPOCH FROM (
              COALESCE(s."actualEndTime", s."endTime") - 
              COALESCE(s."actualStartTime", s."startTime")
            )) / 3600 - 
            COALESCE(s."breakDuration", 0) / 60.0
          ) as "hoursWorked"
        FROM "Employee" e
        LEFT JOIN "Shift" s ON e.id = s."employeeId" 
          AND s."startTime" >= ${weekStart} 
          AND s."startTime" < ${weekEnd}
          AND s.status IN ('COMPLETED', 'ACTIVE')
        WHERE e."restaurantId" = ${restaurantId} AND e."isActive" = true
        GROUP BY e.id, e.name
        ORDER BY "hoursWorked" DESC
        LIMIT 5
      `,
    ]);

    const weeklyData = Array.isArray(weeklyStats) && weeklyStats[0] ? weeklyStats[0] : { total_hours: 0, total_payroll: 0 };

    return {
      totalEmployees,
      activeEmployees,
      clockedInEmployees,
      employeesByRole: employeesByRole.map(item => ({
        role: item.role,
        count: item._count,
      })),
      shiftsThisWeek,
      hoursThisWeek: parseFloat(weeklyData.total_hours || '0'),
      payrollThisWeek: parseFloat(weeklyData.total_payroll || '0'),
      avgHoursPerEmployee: activeEmployees > 0 
        ? parseFloat(weeklyData.total_hours || '0') / activeEmployees 
        : 0,
      topPerformers: Array.isArray(topPerformers) ? topPerformers.map(performer => ({
        employeeId: performer.employeeId,
        name: performer.name,
        hoursWorked: parseFloat(performer.hoursWorked || '0'),
        shiftsCompleted: parseInt(performer.shiftsCompleted || '0'),
      })) : [],
    };
  }

  /**
   * Verify user has access to the restaurant
   */
  private async verifyRestaurantAccess(restaurantId: string, currentUser: User): Promise<void> {
    if (currentUser.role === Role.SUPERADMIN) return;

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });

    if (!restaurant) {
      throw new NotFoundException(`Restaurant with ID ${restaurantId} not found`);
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new ForbiddenException('You can only access your own restaurants');
    }
  }
}