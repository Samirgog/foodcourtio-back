import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramLoginDto, TelegramUserData, LoginResponseDto } from './dto/telegram-login.dto';
import { Role, User } from '@prisma/client';
import { createHash, createHmac } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate Telegram initData and authenticate user
   * This is the primary authentication method for the platform
   */
  async loginWithTelegram(telegramLoginDto: TelegramLoginDto): Promise<LoginResponseDto> {
    try {
      // Validate Telegram initData
      const userData = this.validateTelegramInitData(telegramLoginDto.initData);
      
      if (!userData) {
        throw new UnauthorizedException('Invalid Telegram data');
      }

      // Find or create user
      const { user, isNewUser } = await this.findOrCreateUser(userData);

      // Generate JWT token
      const payload = {
        sub: user.id,
        telegramId: user.telegramId,
        role: user.role,
      };

      const access_token = await this.jwtService.signAsync(payload);

      return {
        access_token,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          role: user.role,
        },
        isNewUser,
      };
    } catch (error) {
      this.logger.error('Telegram login failed', error.stack);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Validate Telegram initData according to Telegram documentation
   * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
   */
  private validateTelegramInitData(initData: string): TelegramUserData | null {
    try {
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      
      if (!botToken) {
        this.logger.error('TELEGRAM_BOT_TOKEN is not configured');
        return null;
      }

      // Parse the init data
      const urlParams = new URLSearchParams(initData);
      const hash = urlParams.get('hash');
      
      if (!hash) {
        this.logger.error('No hash found in initData');
        return null;
      }

      // Remove hash from params for validation
      urlParams.delete('hash');
      
      // Sort parameters and create data-check-string
      const dataCheckString = Array.from(urlParams.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');

      // Create secret key
      const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
      
      // Calculate expected hash
      const expectedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      // Verify hash
      if (hash !== expectedHash) {
        this.logger.error('Hash verification failed');
        return null;
      }

      // Check auth_date (data should not be older than 24 hours)
      const authDate = urlParams.get('auth_date');
      if (authDate) {
        const authTimestamp = parseInt(authDate, 10) * 1000;
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (now - authTimestamp > maxAge) {
          this.logger.error('Auth data is too old');
          return null;
        }
      }

      // Parse user data
      const userParam = urlParams.get('user');
      if (!userParam) {
        this.logger.error('No user data found in initData');
        return null;
      }

      const userData: TelegramUserData = JSON.parse(decodeURIComponent(userParam));
      
      // Validate required fields
      if (!userData.id || !userData.first_name) {
        this.logger.error('Missing required user data fields');
        return null;
      }

      return userData;
    } catch (error) {
      this.logger.error('Error validating Telegram initData', error.stack);
      return null;
    }
  }

  /**
   * Find existing user or create new one based on Telegram data
   */
  private async findOrCreateUser(userData: TelegramUserData): Promise<{ user: User; isNewUser: boolean }> {
    const telegramId = userData.id.toString();
    
    // Try to find existing user
    let user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    if (user) {
      // Update user data if changed
      const name = this.buildUserName(userData);
      const needsUpdate = 
        user.name !== name || 
        user.username !== userData.username ||
        user.avatar !== userData.photo_url;

      if (needsUpdate) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            name,
            username: userData.username,
            avatar: userData.photo_url,
            updatedAt: new Date(),
          },
        });
      }

      return { user, isNewUser: false };
    }

    // Create new user with CUSTOMER role by default
    user = await this.prisma.user.create({
      data: {
        telegramId,
        role: Role.CUSTOMER,
        name: this.buildUserName(userData),
        username: userData.username,
        avatar: userData.photo_url,
      },
    });

    // Create customer profile
    await this.prisma.customer.create({
      data: {
        userId: user.id,
      },
    });

    this.logger.log(`New user created: ${user.name} (${user.telegramId})`);
    return { user, isNewUser: true };
  }

  /**
   * Build display name from Telegram user data
   */
  private buildUserName(userData: TelegramUserData): string {
    let name = userData.first_name;
    if (userData.last_name) {
      name += ` ${userData.last_name}`;
    }
    return name;
  }

  /**
   * Validate JWT token and return user
   */
  async validateUser(userId: string): Promise<User | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      return user;
    } catch (error) {
      this.logger.error('Error validating user', error.stack);
      return null;
    }
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      role: user.role,
    };

    return this.jwtService.signAsync(payload);
  }
}