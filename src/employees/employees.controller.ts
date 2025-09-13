import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  CreateInviteLinkDto,
  UseInviteLinkDto,
  CreateShiftDto,
  UpdateShiftDto,
  ClockInDto,
  ClockOutDto,
  EmployeeResponseDto,
  InviteLinkResponseDto,
  ShiftResponseDto,
  EmployeeStatisticsDto,
  EmployeeRole,
  ShiftStatus,
} from './dto/employee.dto';
import { Role, User } from '@prisma/client';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Employee created successfully',
    type: EmployeeResponseDto,
  })
  async create(
    @Body() createEmployeeDto: CreateEmployeeDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.create(createEmployeeDto, currentUser);
  }

  @Get('restaurant/:restaurantId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get all employees for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: 'boolean',
    description: 'Include inactive employees',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employees retrieved successfully',
    type: [EmployeeResponseDto],
  })
  async findAllByRestaurant(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const shouldIncludeInactive = includeInactive === 'true';
    return this.employeesService.findAllByRestaurant(restaurantId, currentUser, shouldIncludeInactive);
  }

  @Get('restaurant/:restaurantId/statistics')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get employee statistics for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee statistics retrieved successfully',
    type: EmployeeStatisticsDto,
  })
  async getStatistics(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.getStatistics(restaurantId, currentUser);
  }

  @Get(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee retrieved successfully',
    type: EmployeeResponseDto,
  })
  async findOne(@Param('id') id: string, @CurrentUser() currentUser: User) {
    return this.employeesService.findOne(id, currentUser);
  }

  @Patch(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Update an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee updated successfully',
    type: EmployeeResponseDto,
  })
  async update(
    @Param('id') id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.update(id, updateEmployeeDto, currentUser);
  }

  @Delete(':id')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Deactivate an employee' })
  @ApiParam({ name: 'id', description: 'Employee ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Employee deactivated successfully',
  })
  async remove(@Param('id') id: string, @CurrentUser() currentUser: User) {
    await this.employeesService.remove(id, currentUser);
  }

  // Invite Link Management

  @Post('invite-links')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Create an invite link for employee recruitment' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Invite link created successfully',
    type: InviteLinkResponseDto,
  })
  async createInviteLink(
    @Body() createInviteLinkDto: CreateInviteLinkDto,
    @CurrentUser() currentUser: User,
  ) {
    const inviteLink = await this.employeesService.createInviteLink(createInviteLinkDto, currentUser);
    
    // Add the full invite URL
    const baseUrl = process.env.FRONTEND_URL || 'https://foodcourtio.com';
    return {
      ...inviteLink,
      inviteUrl: `${baseUrl}/join/${inviteLink.token}`,
    };
  }

  @Post('invite-links/use')
  @Roles(Role.CUSTOMER) // Only customers can use invite links to become employees
  @ApiOperation({ summary: 'Use an invite link to become an employee' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Employee account created successfully',
    type: EmployeeResponseDto,
  })
  async useInviteLink(
    @Body() useInviteLinkDto: UseInviteLinkDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.useInviteLink(useInviteLinkDto, currentUser);
  }

  @Get('invite-links/restaurant/:restaurantId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get all invite links for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invite links retrieved successfully',
    type: [InviteLinkResponseDto],
  })
  async getInviteLinks(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    const inviteLinks = await this.employeesService.getInviteLinks(restaurantId, currentUser);
    
    // Add full invite URLs
    const baseUrl = process.env.FRONTEND_URL || 'https://foodcourtio.com';
    return inviteLinks.map(link => ({
      ...link,
      inviteUrl: `${baseUrl}/join/${link.token}`,
    }));
  }

  @Patch('invite-links/:id/revoke')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Revoke an invite link' })
  @ApiParam({ name: 'id', description: 'Invite link ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Invite link revoked successfully',
    type: InviteLinkResponseDto,
  })
  async revokeInviteLink(
    @Param('id') id: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.revokeInviteLink(id, currentUser);
  }

  // Shift Management

  @Post('shifts')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Create a shift for an employee' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Shift created successfully',
    type: ShiftResponseDto,
  })
  async createShift(
    @Body() createShiftDto: CreateShiftDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.createShift(createShiftDto, currentUser);
  }

  @Get('shifts/restaurant/:restaurantId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get shifts for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: 'string',
    description: 'Filter by employee ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ShiftStatus,
    description: 'Filter by shift status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Shifts retrieved successfully',
    type: [ShiftResponseDto],
  })
  async getShifts(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: ShiftStatus,
  ) {
    return this.employeesService.getShifts(
      restaurantId,
      currentUser,
      startDate,
      endDate,
      employeeId,
      status,
    );
  }

  @Post('clock-in')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Clock in an employee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee clocked in successfully',
    type: ShiftResponseDto,
  })
  async clockIn(
    @Body() clockInDto: ClockInDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.clockIn(clockInDto, currentUser);
  }

  @Post('clock-out')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Clock out an employee' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee clocked out successfully',
    schema: {
      allOf: [
        { $ref: '#/components/schemas/ShiftResponseDto' },
        {
          type: 'object',
          properties: {
            hoursWorked: { type: 'number' },
            calculatedPay: { type: 'number' },
          },
        },
      ],
    },
  })
  async clockOut(
    @Body() clockOutDto: ClockOutDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.clockOut(clockOutDto, currentUser);
  }

  // Employee-specific endpoints

  @Get('my-profile')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get current employee profile' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee profile retrieved successfully',
    type: EmployeeResponseDto,
  })
  async getMyProfile(@CurrentUser() currentUser: User) {
    // Find employee record for current user
    const employee = await this.employeesService.findOne(currentUser.id, currentUser);
    return employee;
  }

  @Get('my-shifts')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get current employee shifts' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: 'string',
    description: 'Start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    type: 'string',
    description: 'End date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ShiftStatus,
    description: 'Filter by shift status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employee shifts retrieved successfully',
    type: [ShiftResponseDto],
  })
  async getMyShifts(
    @CurrentUser() currentUser: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: ShiftStatus,
  ) {
    // Find employee record for current user
    const employee = await this.employeesService.findOne(currentUser.id, currentUser);
    
    return this.employeesService.getShifts(
      employee.restaurantId,
      currentUser,
      startDate,
      endDate,
      employee.id,
      status,
    );
  }

  @Post('my-clock-in')
  @Roles(Role.EMPLOYEE)
  @ApiOperation({ summary: 'Clock in (self-service)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Clocked in successfully',
    type: ShiftResponseDto,
  })
  async myClockIn(
    @Body() notes: { notes?: string },
    @CurrentUser() currentUser: User,
  ) {
    // Find employee record for current user
    const employee = await this.employeesService.findOne(currentUser.id, currentUser);
    
    return this.employeesService.clockIn(
      {
        employeeId: employee.id,
        notes: notes.notes,
      },
      currentUser,
    );
  }

  @Get('active-shifts/restaurant/:restaurantId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get currently active shifts for a restaurant' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active shifts retrieved successfully',
    type: [ShiftResponseDto],
  })
  async getActiveShifts(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.employeesService.getShifts(
      restaurantId,
      currentUser,
      undefined,
      undefined,
      undefined,
      ShiftStatus.ACTIVE,
    );
  }

  // Bulk operations

  @Post('bulk/clock-out')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Bulk clock out employees (end of day)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Employees clocked out successfully',
  })
  async bulkClockOut(
    @Body() bulkClockOutDto: {
      shiftIds: string[];
      notes?: string;
    },
    @CurrentUser() currentUser: User,
  ) {
    const results = [];
    
    for (const shiftId of bulkClockOutDto.shiftIds) {
      try {
        const shift = await this.employeesService.clockOut(
          {
            shiftId,
            notes: bulkClockOutDto.notes || 'Bulk clock out',
          },
          currentUser,
        );
        results.push({ shiftId, success: true, shift });
      } catch (error) {
        results.push({ shiftId, success: false, error: error.message });
      }
    }

    return {
      results,
      successCount: results.filter(r => r.success).length,
      errorCount: results.filter(r => !r.success).length,
    };
  }

  // Utility endpoints

  @Get('roles/available')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get available employee roles' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Available employee roles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        roles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: Object.values(EmployeeRole) },
              description: { type: 'string' },
              permissions: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
  })
  async getAvailableRoles() {
    return {
      roles: [
        {
          role: EmployeeRole.MANAGER,
          description: 'Restaurant manager with full access',
          permissions: ['manage_employees', 'view_reports', 'manage_orders', 'handle_payments'],
        },
        {
          role: EmployeeRole.CASHIER,
          description: 'Handles orders and payments',
          permissions: ['take_orders', 'handle_payments', 'view_menu'],
        },
        {
          role: EmployeeRole.COOK,
          description: 'Prepares food and manages kitchen',
          permissions: ['view_orders', 'update_order_status', 'manage_inventory'],
        },
        {
          role: EmployeeRole.WAITER,
          description: 'Serves customers and delivers orders',
          permissions: ['view_orders', 'update_order_status', 'take_orders'],
        },
        {
          role: EmployeeRole.CLEANER,
          description: 'Maintains cleanliness and sanitation',
          permissions: ['view_schedule', 'clock_in_out'],
        },
      ],
    };
  }
}