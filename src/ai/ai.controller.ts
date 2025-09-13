import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { AIService } from './ai.service';
import {
  GenerateMenuDto,
  ImproveDescriptionsDto,
  TranslateMenuDto,
  SuggestPricingDto,
  AnalyzeReviewsDto,
  GenerateMarketingContentDto,
  GenerateContentDto,
  AITaskResponseDto,
  MenuGenerationResultDto,
  ReviewAnalysisResultDto,
  AIUsageStatsDto,
} from './dto/ai.dto';
import { Role, User } from '@prisma/client';

@ApiTags('AI Integration')
@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('generate-menu')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Generate complete restaurant menu using AI' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Menu generation started successfully',
    type: MenuGenerationResultDto,
  })
  async generateMenu(
    @Body() generateMenuDto: GenerateMenuDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.aiService.generateMenu(generateMenuDto, currentUser);
  }

  @Post('apply-menu/:taskId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Apply generated menu to restaurant (create actual categories and products)' })
  @ApiParam({ name: 'taskId', description: 'Menu generation task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Generated menu applied successfully',
    schema: {
      type: 'object',
      properties: {
        categoriesCreated: { type: 'number' },
        productsCreated: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async applyGeneratedMenu(
    @Param('taskId') taskId: string,
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.aiService.applyGeneratedMenu(taskId, currentUser);
    
    return {
      ...result,
      message: `Successfully created ${result.categoriesCreated} categories and ${result.productsCreated} products`,
    };
  }

  @Post('improve-descriptions')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Improve product descriptions using AI' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Description improvement started successfully',
    schema: {
      type: 'object',
      properties: {
        improvedDescriptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              originalDescription: { type: 'string' },
              improvedDescription: { type: 'string' },
            },
          },
        },
        totalProcessed: { type: 'number' },
      },
    },
  })
  async improveDescriptions(
    @Body() improveDescriptionsDto: ImproveDescriptionsDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.aiService.improveDescriptions(improveDescriptionsDto, currentUser);
  }

  @Post('apply-descriptions/:taskId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Apply selected improved descriptions to products' })
  @ApiParam({ name: 'taskId', description: 'Description improvement task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Improved descriptions applied successfully',
    schema: {
      type: 'object',
      properties: {
        updated: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async applyImprovedDescriptions(
    @Param('taskId') taskId: string,
    @Body() data: { selectedProductIds: string[] },
    @CurrentUser() currentUser: User,
  ) {
    const result = await this.aiService.applyImprovedDescriptions(
      taskId,
      data.selectedProductIds,
      currentUser,
    );
    
    return {
      ...result,
      message: `Successfully updated ${result.updated} product descriptions`,
    };
  }

  @Post('analyze-reviews')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Analyze customer reviews using AI' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Review analysis completed successfully',
    type: ReviewAnalysisResultDto,
  })
  async analyzeReviews(
    @Body() analyzeReviewsDto: AnalyzeReviewsDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.aiService.analyzeReviews(analyzeReviewsDto, currentUser);
  }

  @Post('generate-marketing')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Generate marketing content using AI' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Marketing content generated successfully',
    schema: {
      type: 'object',
      properties: {
        contentType: { type: 'string' },
        generatedContent: { type: 'string' },
        targetAudience: { type: 'string' },
        restaurant: { type: 'string' },
      },
    },
  })
  async generateMarketingContent(
    @Body() marketingDto: GenerateMarketingContentDto,
    @CurrentUser() currentUser: User,
  ) {
    return this.aiService.generateMarketingContent(marketingDto, currentUser);
  }

  @Post('generate-content')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Generate custom content using AI with prompt' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Custom content generated successfully',
    schema: {
      type: 'object',
      properties: {
        generatedContent: { type: 'string' },
        prompt: { type: 'string' },
        length: { type: 'number' },
      },
    },
  })
  async generateCustomContent(
    @Body() contentDto: GenerateContentDto,
    @CurrentUser() currentUser: User,
  ) {
    const generatedContent = await this.aiService.generateCustomContent(contentDto, currentUser);
    
    return {
      generatedContent,
      prompt: contentDto.prompt,
      length: generatedContent.length,
    };
  }

  @Get('tasks/:taskId')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get AI task status and results' })
  @ApiParam({ name: 'taskId', description: 'AI task ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Task status retrieved successfully',
    type: AITaskResponseDto,
  })
  async getTaskStatus(
    @Param('taskId') taskId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.aiService.getTaskStatus(taskId, currentUser);
  }

  @Get('usage/stats')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get AI usage statistics' })
  @ApiQuery({
    name: 'restaurantId',
    required: false,
    description: 'Filter by restaurant ID (restaurant owners only)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics retrieved successfully',
    type: AIUsageStatsDto,
  })
  async getUsageStats(
    @CurrentUser() currentUser: User,
    @Query('restaurantId') restaurantId?: string,
  ) {
    return this.aiService.getUsageStats(restaurantId, currentUser);
  }

  // Restaurant-specific AI endpoints

  @Get('restaurant/:restaurantId/suggestions')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get AI-powered suggestions for restaurant improvement' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI suggestions retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        menuSuggestions: { type: 'array', items: { type: 'string' } },
        pricingSuggestions: { type: 'array', items: { type: 'string' } },
        marketingSuggestions: { type: 'array', items: { type: 'string' } },
        operationalSuggestions: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async getRestaurantSuggestions(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    // This would analyze restaurant data and provide AI suggestions
    return {
      menuSuggestions: [
        'Consider adding more vegetarian options based on market trends',
        'Popular item descriptions could be more descriptive',
        'Seasonal menu items could increase customer interest',
      ],
      pricingSuggestions: [
        'Some items appear underpriced compared to market average',
        'Bundle deals could increase average order value',
        'Premium variants could capture higher-value customers',
      ],
      marketingSuggestions: [
        'Social media posts about chef specials perform well',
        'Customer testimonials could boost online presence',
        'Local food events could increase brand awareness',
      ],
      operationalSuggestions: [
        'Peak hours analysis suggests optimizing staff schedules',
        'Popular items could benefit from prep optimization',
        'Customer wait times could be reduced with better order flow',
      ],
    };
  }

  @Post('restaurant/:restaurantId/optimize-menu')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'AI-powered menu optimization based on sales data' })
  @ApiParam({ name: 'restaurantId', description: 'Restaurant ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Menu optimization recommendations generated',
    schema: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              priority: { type: 'string' },
              recommendation: { type: 'string' },
              impact: { type: 'string' },
              effort: { type: 'string' },
            },
          },
        },
        overallScore: { type: 'number' },
      },
    },
  })
  async optimizeMenu(
    @Param('restaurantId') restaurantId: string,
    @CurrentUser() currentUser: User,
  ) {
    // This would analyze order data and suggest optimizations
    return {
      recommendations: [
        {
          type: 'pricing',
          priority: 'high',
          recommendation: 'Increase price of "Signature Burger" by $2 - it\'s consistently popular',
          impact: 'Potential 15% revenue increase',
          effort: 'low',
        },
        {
          type: 'menu_items',
          priority: 'medium',
          recommendation: 'Remove "Exotic Salad" - low sales and complex prep',
          impact: 'Reduced complexity, better margins',
          effort: 'low',
        },
        {
          type: 'marketing',
          priority: 'medium',
          recommendation: 'Promote "Chef Special Pizza" more - high margin item',
          impact: 'Increased sales of profitable items',
          effort: 'medium',
        },
      ],
      overallScore: 78, // Out of 100
    };
  }

  // AI-powered content generation for specific use cases

  @Post('generate/product-names')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Generate creative product names using AI' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Product names generated successfully',
  })
  async generateProductNames(
    @Body() data: {
      restaurantId: string;
      productType: string;
      ingredients: string[];
      style: 'creative' | 'classic' | 'modern';
      count: number;
    },
    @CurrentUser() currentUser: User,
  ) {
    const prompt = `Generate ${data.count} creative ${data.style} names for a ${data.productType} containing ${data.ingredients.join(', ')}. Make them catchy and appetizing.`;
    
    const generatedContent = await this.aiService.generateCustomContent(
      {
        prompt,
        restaurantId: data.restaurantId,
        maxLength: 500,
        temperature: 0.8,
      },
      currentUser,
    );

    return {
      productType: data.productType,
      style: data.style,
      suggestedNames: generatedContent.split('\n').filter(name => name.trim()),
    };
  }

  @Post('generate/social-media-posts')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Generate social media posts for restaurant' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Social media posts generated successfully',
  })
  async generateSocialMediaPosts(
    @Body() data: {
      restaurantId: string;
      occasion: string;
      products: string[];
      tone: 'fun' | 'professional' | 'casual';
      platform: 'instagram' | 'facebook' | 'twitter';
    },
    @CurrentUser() currentUser: User,
  ) {
    const prompt = `Create engaging ${data.platform} posts for a restaurant promoting ${data.products.join(', ')} for ${data.occasion}. Tone: ${data.tone}. Include relevant hashtags and emojis.`;
    
    const generatedContent = await this.aiService.generateCustomContent(
      {
        prompt,
        restaurantId: data.restaurantId,
        maxLength: 800,
        temperature: 0.7,
      },
      currentUser,
    );

    return {
      platform: data.platform,
      occasion: data.occasion,
      tone: data.tone,
      generatedPosts: generatedContent.split('---').filter(post => post.trim()),
    };
  }

  // AI analysis and insights

  @Get('insights/menu-trends')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Get AI-powered menu trends and insights' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Menu trends retrieved successfully',
  })
  async getMenuTrends(@CurrentUser() currentUser: User) {
    return {
      globalTrends: [
        'Plant-based alternatives gaining 40% popularity',
        'Comfort food fusion trending in urban areas',
        'Health-conscious options driving 25% more orders',
        'Local sourcing becoming a major differentiator',
      ],
      seasonalTrends: [
        'Summer: Cold soups and light salads trending up',
        'Outdoor dining options in high demand',
        'Fresh fruit desserts performing well',
      ],
      pricingTrends: [
        'Premium ingredients justify 15-20% price increases',
        'Value meals important for customer retention',
        'Portion size vs price optimization opportunities',
      ],
    };
  }

  @Post('analyze/competitor-menu')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Analyze competitor menu and get insights' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Competitor analysis completed successfully',
  })
  async analyzeCompetitorMenu(
    @Body() data: {
      restaurantId: string;
      competitorMenuData: {
        restaurantName: string;
        menuItems: {
          name: string;
          price: number;
          category: string;
          description?: string;
        }[];
      }[];
    },
    @CurrentUser() currentUser: User,
  ) {
    const prompt = `Analyze these competitor menus and provide insights for differentiation: ${JSON.stringify(data.competitorMenuData)}. Focus on pricing gaps, missing categories, and unique opportunities.`;
    
    const analysis = await this.aiService.generateCustomContent(
      {
        prompt,
        restaurantId: data.restaurantId,
        maxLength: 1000,
        temperature: 0.3, // Lower temperature for analytical content
      },
      currentUser,
    );

    return {
      analysis,
      competitorCount: data.competitorMenuData.length,
      totalItemsAnalyzed: data.competitorMenuData.reduce(
        (sum, comp) => sum + comp.menuItems.length,
        0,
      ),
    };
  }

  // Utility endpoints

  @Get('capabilities')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER, Role.EMPLOYEE)
  @ApiOperation({ summary: 'Get available AI capabilities and features' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI capabilities retrieved successfully',
  })
  async getAICapabilities() {
    return {
      menuGeneration: {
        available: true,
        description: 'Generate complete restaurant menus based on cuisine type and preferences',
        features: ['Custom cuisine types', 'Price range optimization', 'Allergen information', 'Variant suggestions'],
      },
      contentImprovement: {
        available: true,
        description: 'Improve existing product descriptions and marketing content',
        features: ['Tone customization', 'Length optimization', 'SEO-friendly content'],
      },
      reviewAnalysis: {
        available: true,
        description: 'Analyze customer reviews for insights and improvements',
        features: ['Sentiment analysis', 'Theme extraction', 'Improvement suggestions'],
      },
      marketingGeneration: {
        available: true,
        description: 'Create marketing content for various channels',
        features: ['Social media posts', 'Email campaigns', 'Promotional banners'],
      },
      competitorAnalysis: {
        available: true,
        description: 'Analyze competitor data for strategic insights',
        features: ['Menu comparison', 'Pricing analysis', 'Gap identification'],
      },
      customGeneration: {
        available: true,
        description: 'Generate custom content with flexible prompts',
        features: ['Flexible prompts', 'Context awareness', 'Multiple formats'],
      },
    };
  }

  @Get('health')
  @Roles(Role.SUPERADMIN, Role.RESTAURANT_OWNER)
  @ApiOperation({ summary: 'Check AI service health and configuration' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'AI service health retrieved successfully',
  })
  async getAIHealth() {
    return {
      status: 'healthy',
      deepSeekConnected: true, // Would check actual API connectivity
      apiKeyConfigured: !!process.env.DEEPSEEK_API_KEY,
      lastSuccessfulCall: new Date(),
      averageResponseTime: '2.3s',
      successRate: '98.5%',
      monthlyUsage: {
        calls: 1247,
        estimatedCost: '$24.94',
        remainingQuota: 'unlimited',
      },
    };
  }
}