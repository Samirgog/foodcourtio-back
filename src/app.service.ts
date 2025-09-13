import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Welcome to FoodcourtIO API! 🍔🍕🥗';
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'foodcourtio-api',
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }

  getVersion() {
    return {
      version: '1.0.0',
      apiVersion: 'v1',
      name: 'FoodcourtIO API',
      description: 'Backend API for FoodcourtIO platform',
      author: 'FoodcourtIO Team',
      timestamp: new Date().toISOString(),
    };
  }
}
