# FoodcourtIO Backend

🍕 A comprehensive backend API for managing food courts, restaurants, orders, and Telegram-based integrations.

## 🚀 Features

- **🔐 Telegram Authentication**: Secure login using Telegram initData validation
- **👥 Multi-Role System**: Support for Superadmin, Restaurant Owner, Employee, and Customer roles
- **🏪 Foodcourt Management**: Complete CRUD operations with interactive map layouts
- **🍽️ Restaurant Management**: Restaurant creation, catalog management, and employee systems
- **📱 Telegram Integration**: Bot support for employees and customer notifications
- **💳 Payment Processing**: Stripe and YooKassa integration with commission handling
- **🤖 AI-Powered**: DeepSeek integration for automated catalog generation
- **📊 Analytics**: Comprehensive statistics and reporting
- **🗺️ Interactive Maps**: Visual foodcourt layout management

## 🛠️ Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + Telegram initData validation
- **Documentation**: Swagger/OpenAPI
- **Payments**: Stripe & YooKassa
- **AI**: DeepSeek API
- **Bot**: Telegram Bot API

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Telegram Bot Token
- Payment provider credentials (Stripe/YooKassa)
- DeepSeek API key (optional, for AI features)

## 🔧 Installation

1. **Clone and install dependencies**
   ```bash
   cd foodcourtio-back
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Configure the following variables in `.env`:
   ```env
   # Database
   DATABASE_URL="postgresql://username:password@localhost:5432/foodcourtio?schema=public"
   
   # JWT
   JWT_SECRET="your-super-secure-jwt-secret-key"
   JWT_EXPIRES_IN="7d"
   
   # Telegram
   TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
   
   # Payment Providers
   STRIPE_SECRET_KEY="sk_test_..."
   YOOKASSA_SHOP_ID="your_shop_id"
   YOOKASSA_SECRET_KEY="your_secret_key"
   
   # AI Integration
   DEEPSEEK_API_KEY="your_deepseek_api_key"
   ```

3. **Database Setup**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # Seed initial data
   npm run db:seed
   ```

4. **Start Development Server**
   ```bash
   npm run start:dev
   ```

## 📖 API Documentation

Once the server is running, visit:
- **API Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/health

## 🏗️ Project Structure

```
src/
├── auth/                 # Authentication & authorization
│   ├── decorators/       # Custom decorators (@CurrentUser, @Roles, etc.)
│   ├── guards/           # JWT & role-based guards
│   ├── strategies/       # Passport strategies
│   └── dto/             # Authentication DTOs
├── users/               # User management
├── foodcourts/          # Foodcourt CRUD & map management
├── restaurants/         # Restaurant management (coming next)
├── categories/          # Menu category management (coming next)
├── products/            # Product management (coming next)
├── orders/              # Order processing (coming next)
├── payments/            # Payment integration (coming next)
├── employees/           # Employee management (coming next)
├── telegram/            # Telegram bot services (coming next)
├── notifications/       # Notification system (coming next)
├── ai/                  # AI integration (coming next)
└── prisma/              # Database service
```

## 🔐 Authentication Flow

1. **Telegram Mini App** sends `initData` to `/api/auth/telegram`
2. **Backend validates** the initData using HMAC-SHA256
3. **User is created/found** in database
4. **JWT token** is generated and returned
5. **Subsequent requests** use JWT in Authorization header

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/telegram` - Login with Telegram initData
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/refresh` - Refresh JWT token

### Users (Superadmin)
- `GET /api/users` - List users with pagination
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/statistics` - User statistics

### Foodcourts (Superadmin)
- `GET /api/foodcourts` - List foodcourts
- `POST /api/foodcourts` - Create foodcourt
- `GET /api/foodcourts/:id` - Get foodcourt details
- `PATCH /api/foodcourts/:id` - Update foodcourt
- `DELETE /api/foodcourts/:id` - Delete foodcourt
- `PATCH /api/foodcourts/:id/layout` - Update map layout
- `GET /api/foodcourts/:id/statistics` - Foodcourt analytics

## 🗂️ Database Schema

### Key Models
- **User**: Core user entity with Telegram integration
- **Foodcourt**: Physical food court locations with map layouts
- **Restaurant**: Individual restaurant entities
- **Category/Product**: Menu structure with variants
- **Order/OrderItem**: Order processing with status tracking
- **Payment**: Payment processing with commission handling
- **Employee**: Staff management with shift tracking
- **Table**: Physical tables with QR codes

## 🔒 Security Features

- **Telegram initData Validation**: Cryptographic verification
- **JWT Authentication**: Secure token-based auth
- **Role-Based Access Control**: Fine-grained permissions
- **Rate Limiting**: Request throttling protection
- **Input Validation**: Comprehensive DTO validation
- **SQL Injection Protection**: Prisma ORM safety

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t foodcourtio-backend .

# Run with environment
docker run -p 3000:3000 --env-file .env foodcourtio-backend
```

### Production Environment
1. Set `NODE_ENV=production`
2. Use secure JWT secrets
3. Configure SSL/TLS
4. Set up database backups
5. Configure monitoring

## 📊 Monitoring & Logging

- **Health Checks**: `/api/health` endpoint
- **Database Monitoring**: Query performance tracking
- **Error Logging**: Comprehensive error handling
- **Metrics**: Built-in performance metrics

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## 🔄 Development Workflow

1. **Start development server**: `npm run start:dev`
2. **Watch database**: `npm run db:studio`
3. **View API docs**: http://localhost:3000/api/docs
4. **Make changes**: Hot reload enabled
5. **Run migrations**: `npm run db:migrate`

## 🤝 Contributing

1. Follow the existing code structure
2. Add proper TypeScript types
3. Include Swagger documentation
4. Add appropriate validation
5. Test your changes
6. Update documentation

## 📚 Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Stripe API](https://stripe.com/docs/api)
- [YooKassa API](https://yookassa.ru/developers/api)

## 📄 License

Private project - All rights reserved

---

**FoodcourtIO Backend** - Powering the future of food court management 🚀