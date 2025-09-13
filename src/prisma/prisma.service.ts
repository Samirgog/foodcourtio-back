import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');
    
    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'stdout',
          level: 'error',
        },
        {
          emit: 'stdout',
          level: 'info',
        },
        {
          emit: 'stdout',
          level: 'warn',
        },
      ],
    });
  }

  async onModuleInit() {
    // Log slow queries in development
    // if (this.configService.get<string>('NODE_ENV') === 'development') {
    //   this.$on('query', (e) => {
    //     if (e.duration > 1000) { // Log queries taking more than 1 second
    //       this.logger.warn(`Slow query detected: ${e.duration}ms - ${e.query}`);
    //     }
    //   });
    // }

    try {
      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error('Failed to connect to database', error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from database');
  }

  /**
   * Execute database operations in a transaction
   */
  async executeTransaction<T>(fn: (prisma: PrismaService) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      // Create a new instance with the transaction context
      const transactionalPrisma = tx as unknown as PrismaService;
      return fn(transactionalPrisma);
    });
  }

  /**
   * Clean up database for testing
   */
  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      const tablenames = await this.$queryRaw<Array<{ tablename: string }>>(
        Prisma.sql`SELECT tablename FROM pg_tables WHERE schemaname='public'`
      );

      const tables = tablenames
        .map(({ tablename }) => tablename)
        .filter((name) => name !== '_prisma_migrations')
        .map((name) => `\"public\".\"${name}\"`)
        .join(', ');

      try {
        await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
      } catch (error) {
        this.logger.error('Error cleaning database', error.stack);
      }
    }
  }
}