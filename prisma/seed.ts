import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create superadmin user
  const superAdmin = await prisma.user.upsert({
    where: { telegramId: '12345678' },
    update: {},
    create: {
      telegramId: '12345678',
      role: Role.SUPERADMIN,
      name: 'Super Admin',
      username: 'superadmin',
      avatar: null,
    },
  });

  console.log('✅ Created superadmin user:', superAdmin.name);

  // Create sample foodcourt
  const foodcourt = await prisma.foodcourt.upsert({
    where: { id: 'foodcourt-1' },
    update: {},
    create: {
      id: 'foodcourt-1',
      name: 'Central Food Hall',
      address: 'Downtown Plaza, Level 2',
      description: 'Premium food court in the heart of the city',
      layout: {
        width: 1000,
        height: 800,
        restaurants: [],
        tables: [],
      },
      commissionRate: 0.10,
    },
  });

  console.log('✅ Created foodcourt:', foodcourt.name);

  // Create sample tables
  const tables = [];
  for (let i = 1; i <= 20; i++) {
    const table = await prisma.table.create({
      data: {
        number: `T${i.toString().padStart(2, '0')}`,
        foodcourtId: foodcourt.id,
        qrCode: `foodcourt-${foodcourt.id}-table-${i}`,
        position: {
          x: (i % 4) * 200 + 100,
          y: Math.floor(i / 4) * 150 + 100,
        },
      },
    });
    tables.push(table);
  }

  console.log('✅ Created 20 tables');

  // Create sample restaurant owner
  const restaurantOwner = await prisma.user.upsert({
    where: { telegramId: '87654321' },
    update: {},
    create: {
      telegramId: '87654321',
      role: Role.RESTAURANT_OWNER,
      name: 'John Doe',
      username: 'johndoe',
      avatar: null,
    },
  });

  console.log('✅ Created restaurant owner:', restaurantOwner.name);

  // Create sample restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: 'Bella Vista Pizza',
      description: 'Authentic Italian pizza made with fresh ingredients',
      logo: null,
      banner: null,
      status: 'ACTIVE',
      isPublished: true,
      foodcourtId: foodcourt.id,
      ownerId: restaurantOwner.id,
    },
  });

  console.log('✅ Created restaurant:', restaurant.name);

  // Create sample categories
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: 'Classic Pizzas',
        description: 'Our signature traditional pizzas',
        priority: 1,
        isActive: true,
        isDraft: false,
        restaurantId: restaurant.id,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Gourmet Specials',
        description: 'Premium pizzas with unique toppings',
        priority: 2,
        isActive: true,
        isDraft: false,
        restaurantId: restaurant.id,
      },
    }),
    prisma.category.create({
      data: {
        name: 'Beverages',
        description: 'Refreshing drinks and beverages',
        priority: 3,
        isActive: true,
        isDraft: false,
        restaurantId: restaurant.id,
      },
    }),
  ]);

  console.log('✅ Created categories:', categories.length);

  // Create sample products
  const products = await Promise.all([
    // Classic Pizzas
    prisma.product.create({
      data: {
        name: 'Margherita',
        description: 'Fresh tomato sauce, mozzarella, and basil',
        price: 12.99,
        weight: '350g',
        variants: [
          { id: '1', name: 'Small (10")', priceModifier: -3.00 },
          { id: '2', name: 'Medium (12")', priceModifier: 0, isDefault: true },
          { id: '3', name: 'Large (14")', priceModifier: 4.00 },
        ],
        isAvailable: true,
        priority: 1,
        isDraft: false,
        categoryId: categories[0].id,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Pepperoni',
        description: 'Classic pepperoni with mozzarella cheese',
        price: 14.99,
        weight: '380g',
        variants: [
          { id: '4', name: 'Small (10")', priceModifier: -3.00 },
          { id: '5', name: 'Medium (12")', priceModifier: 0, isDefault: true },
          { id: '6', name: 'Large (14")', priceModifier: 4.00 },
        ],
        isAvailable: true,
        priority: 2,
        isDraft: false,
        categoryId: categories[0].id,
      },
    }),
    // Gourmet Specials
    prisma.product.create({
      data: {
        name: 'Truffle Mushroom',
        description: 'Wild mushrooms with truffle oil and parmesan',
        price: 18.99,
        weight: '400g',
        isAvailable: true,
        priority: 1,
        isDraft: false,
        categoryId: categories[1].id,
      },
    }),
    // Beverages
    prisma.product.create({
      data: {
        name: 'Italian Soda',
        description: 'Sparkling water with fruit syrups',
        price: 3.99,
        volume: '350ml',
        variants: [
          { id: '7', name: 'Lemon', priceModifier: 0, isDefault: true },
          { id: '8', name: 'Orange', priceModifier: 0 },
          { id: '9', name: 'Berry', priceModifier: 0.50 },
        ],
        isAvailable: true,
        priority: 1,
        isDraft: false,
        categoryId: categories[2].id,
      },
    }),
  ]);

  console.log('✅ Created products:', products.length);

  // Create sample employee
  const employeeUser = await prisma.user.create({
    data: {
      telegramId: '11223344',
      role: Role.EMPLOYEE,
      name: 'Alice Smith',
      username: 'alicesmith',
    },
  });

  const employee = await prisma.employee.create({
    data: {
      name: employeeUser.name,
      phone: '1234567890',
      role: 'COOK',
      user: {
        connect: { id: employeeUser.id }
      },
      restaurant: {
        connect: { id: restaurant.id }
      },
      isActive: true,
      activeShift: false,
      joinedAt: new Date(),
    },
  });

  console.log('✅ Created employee:', employeeUser.name);

  // Create sample customer
  const customerUser = await prisma.user.create({
    data: {
      telegramId: '99887766',
      role: Role.CUSTOMER,
      name: 'Bob Johnson',
      username: 'bobjohnson',
    },
  });

  const customer = await prisma.customer.create({
    data: {
      userId: customerUser.id,
      lastVisitFoodcourtId: foodcourt.id,
    },
  });

  console.log('✅ Created customer:', customerUser.name);

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });