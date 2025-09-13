import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');

  // Global prefix for all routes
  app.setGlobalPrefix(apiPrefix);

  // Enable CORS
  app.enableCors({
    origin: [
      configService.get<string>('FRONTEND_URL', 'http://localhost:5173'),
      configService.get<string>('ADMIN_URL', 'http://localhost:5173'),
    ],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Increase payload limit for file uploads
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Swagger API documentation
  if (configService.get<string>('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('FoodcourtIO Backend API')
      .setDescription(`
        🍔 **FoodcourtIO Backend API Documentation**
        
        A comprehensive backend API for managing food courts, restaurants, orders, and Telegram-based integrations.
        
        ## 🚀 Features
        - **🔐 Telegram Authentication**: Secure login using Telegram initData validation
        - **👥 Multi-Role System**: Support for Superadmin, Restaurant Owner, Employee, and Customer roles
        - **🏪 Foodcourt Management**: Complete CRUD operations with interactive map layouts
        - **🍽️ Restaurant Management**: Restaurant creation, catalog management, and employee systems
        - **📱 Telegram Integration**: Bot support for employees and customer notifications
        - **💳 Payment Processing**: Stripe and YooKassa integration with commission handling
        - **🤖 AI-Powered**: DeepSeek integration for automated catalog generation
        - **📊 Analytics**: Comprehensive statistics and reporting
        
        ## 🔑 Authentication
        This API uses JWT tokens obtained through Telegram authentication.
        
        1. Use the \`/auth/telegram\` endpoint with Telegram initData
        2. Include the JWT token in the Authorization header: \`Bearer <token>\`
        3. Different endpoints require different roles (see individual endpoint documentation)
        
        ## 📚 API Structure
        - **Authentication**: Login with Telegram, JWT management
        - **Users**: User management and role assignment
        - **Foodcourts**: Food court creation and map layout management
        - **Restaurants**: Restaurant CRUD, publishing, and statistics
        - **Categories & Products**: Menu catalog management with drafts and variants
        - **Orders**: Complete order lifecycle management
        - **Payments**: Multi-provider payment processing with commission
        - **Employees**: Staff management, shifts, and invite links
        - **Telegram Bot**: Bot commands and notifications
        - **Notifications**: Multi-channel notification system
        - **AI Integration**: DeepSeek-powered content generation
        
        ## 🔒 Roles & Permissions
        - **SUPERADMIN**: Full system access, manage all foodcourts and users
        - **RESTAURANT_OWNER**: Manage own restaurants, employees, and orders
        - **EMPLOYEE**: Access assigned restaurant data, clock in/out, view orders
        - **CUSTOMER**: Place orders, view order history, receive notifications
      `)
      .setVersion('1.0.0')
      .setContact(
        'FoodcourtIO Support', 
        'https://foodcourtio.com', 
        'support@foodcourtio.com'
      )
      .setLicense('Private', 'https://foodcourtio.com/license')
      .addServer('http://localhost:3000', 'Development Server')
      .addServer('https://api.foodcourtio.com', 'Production Server')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token obtained from /auth/telegram endpoint',
          in: 'header',
        },
        'JWT-auth'
      )
      .addTag('Authentication', 'User authentication and JWT management')
      .addTag('Users', 'User management and role assignment (Superadmin only)')
      .addTag('Foodcourts', 'Food court management with interactive maps (Superadmin only)')
      .addTag('Restaurants', 'Restaurant CRUD operations and publishing workflow')
      .addTag('Categories', 'Menu category management with draft functionality')
      .addTag('Products', 'Product management with variants and file uploads')
      .addTag('Orders', 'Complete order lifecycle and status management')
      .addTag('Payments', 'Multi-provider payment processing (Stripe/YooKassa)')
      .addTag('Employees', 'Staff management, shifts, and invite links')
      .addTag('Telegram Bot', 'Bot commands, notifications, and webhook handling')
      .addTag('Notifications', 'Multi-channel notification system with scheduling')
      .addTag('AI Integration', 'DeepSeek AI-powered content generation and analysis')
      .addTag('Health', 'System health checks and status monitoring')
      .build();
    
    const document = SwaggerModule.createDocument(app, config, {
      operationIdFactory: (controllerKey: string, methodKey: string) => methodKey,
    });
    
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'none',
        filter: true,
        showRequestHeaders: true,
        tryItOutEnabled: true,
      },
      customSiteTitle: 'FoodcourtIO API Documentation',
      customfavIcon: '/favicon.ico',
      customJs: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
      ],
      customCssUrl: [
        'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      ],
    });
  }

  await app.listen(port);
  
  console.log('\n🍔 =================================== FOODCOURTIO API ===================================');
  console.log(`🚀 Server is running on: http://localhost:${port}/${apiPrefix}`);
  console.log(`📚 API Documentation: http://localhost:${port}/${apiPrefix}/docs`);
  console.log(`❤️  Health Check: http://localhost:${port}/${apiPrefix}/health`);
  console.log('');
  console.log('🏗️  COMPLETED MODULES:');
  console.log('   ✅ Authentication (Telegram initData validation)');
  console.log('   ✅ User Management (Multi-role system)');
  console.log('   ✅ Foodcourt Management (Interactive maps)');
  console.log('   ✅ Restaurant Management (Complete CRUD + Publishing)');
  console.log('   ✅ Catalog System (Categories + Products with variants)');
  console.log('   ✅ Order Management (Full lifecycle + Status tracking)');
  console.log('   ✅ Payment Processing (Stripe + YooKassa + Commission)');
  console.log('   ✅ Employee Management (Shifts + Invites + Payroll)');
  console.log('   ✅ Telegram Bot (Commands + Notifications + Interactive)');
  console.log('   ✅ Notification System (Multi-channel + Scheduling)');
  console.log('   ✅ AI Integration (DeepSeek + Menu Generation)');
  console.log('   ✅ Comprehensive API Documentation');
  console.log('');
  console.log('📦 KEY FEATURES:');
  console.log('   • Telegram Authentication & Bot Integration');
  console.log('   • Multi-provider Payment Processing (Stripe/YooKassa)');
  console.log('   • AI-powered Menu Generation & Content Creation');
  console.log('   • Real-time Notifications (Orders, Shifts, Payments)');
  console.log('   • Employee Management with Time Tracking');
  console.log('   • Commission Tracking & Revenue Analytics');
  console.log('   • Role-based Access Control (4 user types)');
  console.log('   • Interactive Food Court Map Management');
  console.log('');
  console.log('🔒 ROLES: SUPERADMIN | RESTAURANT_OWNER | EMPLOYEE | CUSTOMER');
  console.log('===============================================================================\n');
}

bootstrap();
