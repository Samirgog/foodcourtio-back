import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User, Role, EmployeeRole } from '@prisma/client';

@Injectable()
export class TelegramAuthService {
  private readonly logger = new Logger(TelegramAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if user is authorized to access the admin panel
   * Only store owners, managers, and superadmins are allowed
   */
  async isUserAuthorized(telegramId: string): Promise<{ 
    authorized: boolean; 
    user?: User;
    reason?: string 
  }> {
    try {
      // Find user by Telegram ID
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      // If user doesn't exist, they're not authorized
      if (!user) {
        return {
          authorized: false,
          reason: 'User not found. Please register through the FoodcourtIO app first.'
        };
      }

      // Check if user has the required role
      // Superadmins and restaurant owners have direct access
      // Employees need to be managers to have access
      const isSuperadmin = user.role === Role.SUPERADMIN;
      const isRestaurantOwner = user.role === Role.RESTAURANT_OWNER;
      const isEmployee = user.role === Role.EMPLOYEE;
      
      if (!isSuperadmin && !isRestaurantOwner && !isEmployee) {
        return {
          authorized: false,
          user,
          reason: `Access denied. Your current role (${user.role}) does not have access to the admin panel.`
        };
      }

      // For employees, check if they are managers
      if (isEmployee) {
        const employee = await this.prisma.employee.findFirst({
          where: { 
            userId: user.id,
            role: EmployeeRole.MANAGER
          }
        });
        
        if (!employee) {
          return {
            authorized: false,
            user,
            reason: `Access denied. You are not a manager. Only managers, store owners, and superadmins can access the admin panel.`
          };
        }
      }

      // For restaurant owners and managers, check if they have an associated restaurant
      if (isRestaurantOwner || (isEmployee)) {
        const hasRestaurant = await this.userHasRestaurant(user.id);
        
        if (!hasRestaurant) {
          return {
            authorized: false,
            user,
            reason: `Access denied. You don't have an associated restaurant. Please contact your administrator.`
          };
        }
      }

      // User is authorized
      return {
        authorized: true,
        user
      };
    } catch (error) {
      this.logger.error('Error checking user authorization', error.stack);
      return {
        authorized: false,
        reason: 'An error occurred while checking authorization'
      };
    }
  }

  /**
   * Check if user has an associated restaurant
   */
  private async userHasRestaurant(userId: string): Promise<boolean> {
    try {
      // For restaurant owners, check if they own a restaurant
      const ownerRestaurant = await this.prisma.restaurant.findFirst({
        where: { ownerId: userId }
      });

      if (ownerRestaurant) {
        return true;
      }

      // For managers (employees), check if they are assigned to a restaurant
      const managerEmployee = await this.prisma.employee.findFirst({
        where: { 
          userId,
          role: EmployeeRole.MANAGER
        }
      });

      return !!managerEmployee;
    } catch (error) {
      this.logger.error('Error checking user restaurant association', error.stack);
      return false;
    }
  }

  /**
   * Generate auth redirect URL with initData for the admin panel
   */
  generateAuthRedirectUrl(initData: string, baseUrl: string): string {
    // Encode the initData for URL safety
    const encodedInitData = encodeURIComponent(initData);
    return `${baseUrl}?initData=${encodedInitData}`;
  }

  /**
   * Create a user session for the admin panel
   */
  async createUserSession(user: User): Promise<{ 
    sessionId: string;
    expiresAt: Date;
  }> {
    try {
      // In a real implementation, you might want to create a proper session
      // For now, we'll just return a mock session ID
      const sessionId = `session_${Date.now()}_${user.id}`;
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // In a real implementation, you would store this in a sessions table
      this.logger.log(`Created session for user ${user.name} (${user.id})`);
      
      return { sessionId, expiresAt };
    } catch (error) {
      this.logger.error('Error creating user session', error.stack);
      throw error;
    }
  }
}