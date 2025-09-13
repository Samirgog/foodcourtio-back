import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsEnum,
  IsUUID,
  IsBoolean,
  IsEmail,
  IsPhoneNumber,
  IsArray,
  IsDateString,
} from 'class-validator';

export enum EmployeeRole {
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
  COOK = 'COOK',
  WAITER = 'WAITER',
  CLEANER = 'CLEANER',
}

export enum ShiftStatus {
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum InviteLinkStatus {
  ACTIVE = 'ACTIVE',
  USED = 'USED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export class CreateEmployeeDto {
  @ApiProperty({ description: 'Restaurant ID where employee will work' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Employee name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Employee phone number' })
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Employee email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ 
    description: 'Employee role', 
    enum: EmployeeRole,
    example: EmployeeRole.CASHIER 
  })
  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @ApiProperty({ description: 'Hourly wage in cents', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyWage?: number;

  @ApiProperty({ description: 'Work schedule notes', required: false })
  @IsString()
  @IsOptional()
  schedule?: string;

  @ApiProperty({ description: 'Whether employee is active', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiProperty({ description: 'Employee name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'Employee phone number', required: false })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Employee email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ 
    description: 'Employee role', 
    enum: EmployeeRole,
    required: false 
  })
  @IsEnum(EmployeeRole)
  @IsOptional()
  role?: EmployeeRole;

  @ApiProperty({ description: 'Hourly wage in cents', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyWage?: number;

  @ApiProperty({ description: 'Work schedule notes', required: false })
  @IsString()
  @IsOptional()
  schedule?: string;

  @ApiProperty({ description: 'Whether employee is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class CreateInviteLinkDto {
  @ApiProperty({ description: 'Restaurant ID for the invite' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ 
    description: 'Employee role for this invite', 
    enum: EmployeeRole 
  })
  @IsEnum(EmployeeRole)
  role: EmployeeRole;

  @ApiProperty({ description: 'Expiration date for the invite link' })
  @IsDateString()
  @IsNotEmpty()
  expiresAt: string;

  @ApiProperty({ description: 'Hourly wage for this position in cents', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyWage?: number;

  @ApiProperty({ description: 'Additional notes for the invite', required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Maximum number of uses for this link', default: 1 })
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUses?: number;
}

export class UseInviteLinkDto {
  @ApiProperty({ description: 'Invite token from the URL' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'Employee name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Employee phone number' })
  @IsPhoneNumber()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ description: 'Employee email', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}

export class CreateShiftDto {
  @ApiProperty({ description: 'Employee ID for this shift' })
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Shift start time' })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: 'Shift end time' })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiProperty({ description: 'Break duration in minutes', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  breakDuration?: number;

  @ApiProperty({ description: 'Shift notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateShiftDto extends PartialType(CreateShiftDto) {
  @ApiProperty({ 
    description: 'Shift status', 
    enum: ShiftStatus,
    required: false 
  })
  @IsEnum(ShiftStatus)
  @IsOptional()
  status?: ShiftStatus;

  @ApiProperty({ description: 'Actual clock in time', required: false })
  @IsDateString()
  @IsOptional()
  actualStartTime?: string;

  @ApiProperty({ description: 'Actual clock out time', required: false })
  @IsDateString()
  @IsOptional()
  actualEndTime?: string;
}

export class ClockInDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'Clock in notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ClockOutDto {
  @ApiProperty({ description: 'Shift ID to clock out from' })
  @IsUUID()
  @IsNotEmpty()
  shiftId: string;

  @ApiProperty({ description: 'Clock out notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class EmployeeResponseDto {
  @ApiProperty({ description: 'Employee ID' })
  id: string;

  @ApiProperty({ description: 'Employee name' })
  name: string;

  @ApiProperty({ description: 'Employee phone number' })
  phone: string;

  @ApiProperty({ description: 'Employee email', required: false })
  email?: string;

  @ApiProperty({ description: 'Employee role', enum: EmployeeRole })
  role: EmployeeRole;

  @ApiProperty({ description: 'Hourly wage in cents', required: false })
  hourlyWage?: number;

  @ApiProperty({ description: 'Work schedule notes', required: false })
  schedule?: string;

  @ApiProperty({ description: 'Whether employee is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Employee creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Employee update date' })
  updatedAt: Date;

  @ApiProperty({ description: 'Restaurant ID' })
  restaurantId: string;

  @ApiProperty({ description: 'User ID (if linked to Telegram user)', required: false })
  userId?: string;

  @ApiProperty({ description: 'Restaurant information' })
  restaurant?: {
    id: string;
    name: string;
  };

  @ApiProperty({ description: 'User information (if linked)', required: false })
  user?: {
    id: string;
    name: string;
    telegramId: string;
  };

  @ApiProperty({ description: 'Current active shift', required: false })
  activeShift?: {
    id: string;
    startTime: Date;
    status: ShiftStatus;
  };
}

export class InviteLinkResponseDto {
  @ApiProperty({ description: 'Invite link ID' })
  id: string;

  @ApiProperty({ description: 'Invite token' })
  token: string;

  @ApiProperty({ description: 'Full invite URL' })
  inviteUrl: string;

  @ApiProperty({ description: 'Employee role for this invite', enum: EmployeeRole })
  role: EmployeeRole;

  @ApiProperty({ description: 'Invite status', enum: InviteLinkStatus })
  status: InviteLinkStatus;

  @ApiProperty({ description: 'Expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Hourly wage for this position', required: false })
  hourlyWage?: number;

  @ApiProperty({ description: 'Additional notes', required: false })
  notes?: string;

  @ApiProperty({ description: 'Maximum uses' })
  maxUses: number;

  @ApiProperty({ description: 'Current usage count' })
  usedCount: number;

  @ApiProperty({ description: 'Creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Restaurant ID' })
  restaurantId: string;

  @ApiProperty({ description: 'Created by user ID' })
  createdBy: string;

  @ApiProperty({ description: 'Restaurant information' })
  restaurant?: {
    id: string;
    name: string;
  };
}

export class ShiftResponseDto {
  @ApiProperty({ description: 'Shift ID' })
  id: string;

  @ApiProperty({ description: 'Scheduled start time' })
  startTime: Date;

  @ApiProperty({ description: 'Scheduled end time' })
  endTime: Date;

  @ApiProperty({ description: 'Actual start time', required: false })
  actualStartTime?: Date;

  @ApiProperty({ description: 'Actual end time', required: false })
  actualEndTime?: Date;

  @ApiProperty({ description: 'Break duration in minutes', required: false })
  breakDuration?: number;

  @ApiProperty({ description: 'Shift status', enum: ShiftStatus })
  status: ShiftStatus;

  @ApiProperty({ description: 'Shift notes', required: false })
  notes?: string;

  @ApiProperty({ description: 'Shift creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Employee ID' })
  employeeId: string;

  @ApiProperty({ description: 'Employee information' })
  employee?: {
    id: string;
    name: string;
    role: EmployeeRole;
  };

  @ApiProperty({ description: 'Calculated hours worked', required: false })
  hoursWorked?: number;

  @ApiProperty({ description: 'Calculated pay for this shift', required: false })
  calculatedPay?: number;
}

export class EmployeeStatisticsDto {
  @ApiProperty({ description: 'Total employees' })
  totalEmployees: number;

  @ApiProperty({ description: 'Active employees' })
  activeEmployees: number;

  @ApiProperty({ description: 'Employees currently clocked in' })
  clockedInEmployees: number;

  @ApiProperty({ description: 'Employees by role' })
  employeesByRole: {
    role: EmployeeRole;
    count: number;
  }[];

  @ApiProperty({ description: 'Total shifts this week' })
  shiftsThisWeek: number;

  @ApiProperty({ description: 'Total hours worked this week' })
  hoursThisWeek: number;

  @ApiProperty({ description: 'Total payroll this week' })
  payrollThisWeek: number;

  @ApiProperty({ description: 'Average hours per employee this week' })
  avgHoursPerEmployee: number;

  @ApiProperty({ description: 'Top performing employees this week' })
  topPerformers: {
    employeeId: string;
    name: string;
    hoursWorked: number;
    shiftsCompleted: number;
  }[];
}