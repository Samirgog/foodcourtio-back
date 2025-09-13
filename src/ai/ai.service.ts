import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  GenerateMenuDto,
  ImproveDescriptionsDto,
  TranslateMenuDto,
  SuggestPricingDto,
  AnalyzeReviewsDto,
  GenerateMarketingContentDto,
  GenerateContentDto,
  AITaskType,
  AITaskStatus,
  MenuGenerationResultDto,
  ReviewAnalysisResultDto,
} from './dto/ai.dto';
import { User, Role } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly deepSeekApiKey: string;
  private readonly deepSeekApiUrl: string = 'https://api.deepseek.com/v1';
  
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.deepSeekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY') || '';
    
    if (!this.deepSeekApiKey) {
      this.logger.warn('DEEPSEEK_API_KEY not configured - AI features disabled');
    } else {
      this.logger.log('DeepSeek AI integration initialized');
    }
  }

  /**
   * Generate complete menu for a restaurant
   */
  async generateMenu(generateMenuDto: GenerateMenuDto, currentUser: User): Promise<any> {
    // Verify user has access to restaurant
    await this.verifyRestaurantAccess(generateMenuDto.restaurantId, currentUser);

    // Create AI task record
    const task = await this.createAITask(
      AITaskType.GENERATE_MENU,
      generateMenuDto.restaurantId,
      currentUser.id,
      generateMenuDto,
    );

    try {
      // Get restaurant context
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: generateMenuDto.restaurantId },
        select: { name: true, description: true },
      });

      // Generate menu using DeepSeek
      const menuPrompt = this.buildMenuGenerationPrompt(generateMenuDto, restaurant);
      const generatedContent = await this.callDeepSeekAPI(menuPrompt, 0.8, 3000);
      
      // Parse and validate generated content
      const menuResult = this.parseMenuGenerationResult(generatedContent);
      
      // Update task with results
      await this.updateAITask(task.id, AITaskStatus.COMPLETED, menuResult);
      
      this.logger.log(`Menu generated successfully for restaurant ${generateMenuDto.restaurantId}`);
      return menuResult;

    } catch (error) {
      this.logger.error('Menu generation failed', error.stack);
      await this.updateAITask(task.id, AITaskStatus.FAILED, null, error.message);
      throw error;
    }
  }

  /**
   * Apply generated menu to restaurant (create actual categories and products)
   */
  async applyGeneratedMenu(taskId: string, currentUser: User): Promise<{ categoriesCreated: number; productsCreated: number }> {
    const task = await this.prisma.aITask.findUnique({
      where: { id: taskId },
    });

    if (!task || task.taskType !== AITaskType.GENERATE_MENU || task.status !== AITaskStatus.COMPLETED) {
      throw new BadRequestException('Invalid or incomplete menu generation task');
    }

    await this.verifyRestaurantAccess(task.restaurantId, currentUser);

    const menuResult = (task.results as unknown) as MenuGenerationResultDto;
    let categoriesCreated = 0;
    let productsCreated = 0;

    try {
      // Create categories and products in transaction
      await this.prisma.$transaction(async (prisma) => {
        for (const categoryData of menuResult.categories) {
          // Create category
          const category = await prisma.category.create({
            data: {
              name: categoryData.name,
              description: categoryData.description,
              priority: categoryData.priority,
              isActive: true,
              isDraft: false, // Publish immediately
              restaurantId: task.restaurantId,
            },
          });
          
          categoriesCreated++;

          // Create products for this category
          for (const productData of categoryData.products) {
            await prisma.product.create({
              data: {
                name: productData.name,
                description: productData.description,
                price: Math.round(productData.price * 100), // Convert to cents
                variants: productData.variants || [],
                isAvailable: true,
                isDraft: false, // Publish immediately
                categoryId: category.id,
              },
            });
            
            productsCreated++;
          }
        }
      });

      this.logger.log(`Applied generated menu: ${categoriesCreated} categories, ${productsCreated} products`);
      return { categoriesCreated, productsCreated };

    } catch (error) {
      this.logger.error('Failed to apply generated menu', error.stack);
      throw error;
    }
  }

  /**
   * Improve product descriptions
   */
  async improveDescriptions(improveDto: ImproveDescriptionsDto, currentUser: User): Promise<any> {
    await this.verifyRestaurantAccess(improveDto.restaurantId, currentUser);

    const task = await this.createAITask(
      AITaskType.IMPROVE_DESCRIPTIONS,
      improveDto.restaurantId,
      currentUser.id,
      improveDto,
    );

    try {
      // Get products to improve
      const where: any = { 
        category: { restaurantId: improveDto.restaurantId },
        isDraft: false 
      };
      
      if (improveDto.productIds && improveDto.productIds.length > 0) {
        where.id = { in: improveDto.productIds };
      }

      const products = await this.prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
        },
        take: 20, // Limit to prevent API overuse
      });

      const improvedDescriptions = [];

      for (const product of products) {
        const improvementPrompt = this.buildDescriptionImprovementPrompt(product, improveDto);
        const improvedDescription = await this.callDeepSeekAPI(improvementPrompt, 0.7, 300);
        
        improvedDescriptions.push({
          productId: product.id,
          originalDescription: product.description,
          improvedDescription: improvedDescription.trim(),
        });
      }

      const result = { improvedDescriptions, totalProcessed: products.length };
      await this.updateAITask(task.id, AITaskStatus.COMPLETED, result);
      
      return result;

    } catch (error) {
      this.logger.error('Description improvement failed', error.stack);
      await this.updateAITask(task.id, AITaskStatus.FAILED, null, error.message);
      throw error;
    }
  }

  /**
   * Apply improved descriptions to products
   */
  async applyImprovedDescriptions(taskId: string, selectedImprovements: string[], currentUser: User): Promise<{ updated: number }> {
    const task = await this.prisma.aITask.findUnique({
      where: { id: taskId },
    });

    if (!task || task.taskType !== AITaskType.IMPROVE_DESCRIPTIONS || task.status !== AITaskStatus.COMPLETED) {
      throw new BadRequestException('Invalid or incomplete description improvement task');
    }

    await this.verifyRestaurantAccess(task.restaurantId, currentUser);

    const result = task.results;
    const improvementsToApply = (result as any).improvedDescriptions?.filter((imp: any) => 
      selectedImprovements.includes(imp.productId)
    );

    let updated = 0;

    try {
      for (const improvement of improvementsToApply) {
        await this.prisma.product.update({
          where: { id: improvement.productId },
          data: { description: improvement.improvedDescription },
        });
        updated++;
      }

      this.logger.log(`Applied ${updated} improved descriptions`);
      return { updated };

    } catch (error) {
      this.logger.error('Failed to apply improved descriptions', error.stack);
      throw error;
    }
  }

  /**
   * Analyze customer reviews
   */
  async analyzeReviews(analyzeDto: AnalyzeReviewsDto, currentUser: User): Promise<ReviewAnalysisResultDto> {
    await this.verifyRestaurantAccess(analyzeDto.restaurantId, currentUser);

    const task = await this.createAITask(
      AITaskType.ANALYZE_REVIEWS,
      analyzeDto.restaurantId,
      currentUser.id,
      analyzeDto,
    );

    try {
      const analysisPrompt = this.buildReviewAnalysisPrompt(analyzeDto);
      const analysisResult = await this.callDeepSeekAPI(analysisPrompt, 0.3, 2000);
      
      const parsedAnalysis = this.parseReviewAnalysis(analysisResult);
      
      await this.updateAITask(task.id, AITaskStatus.COMPLETED, parsedAnalysis);
      
      return parsedAnalysis;

    } catch (error) {
      this.logger.error('Review analysis failed', error.stack);
      await this.updateAITask(task.id, AITaskStatus.FAILED, null, error.message);
      throw error;
    }
  }

  /**
   * Generate marketing content
   */
  async generateMarketingContent(marketingDto: GenerateMarketingContentDto, currentUser: User): Promise<any> {
    await this.verifyRestaurantAccess(marketingDto.restaurantId, currentUser);

    const task = await this.createAITask(
      AITaskType.GENERATE_MARKETING_CONTENT,
      marketingDto.restaurantId,
      currentUser.id,
      marketingDto,
    );

    try {
      // Get restaurant context
      const restaurant = await this.prisma.restaurant.findUnique({
        where: { id: marketingDto.restaurantId },
        include: {
          categories: {
            include: {
              products: {
                where: { isDraft: false, isAvailable: true },
                take: 5,
              },
            },
            take: 3,
          },
        },
      });

      const marketingPrompt = this.buildMarketingPrompt(marketingDto, restaurant);
      const generatedContent = await this.callDeepSeekAPI(marketingPrompt, 0.8, 1000);
      
      const result = {
        contentType: marketingDto.contentType,
        generatedContent: generatedContent.trim(),
        targetAudience: marketingDto.targetAudience,
        restaurant: restaurant?.name,
      };

      await this.updateAITask(task.id, AITaskStatus.COMPLETED, result);
      
      return result;

    } catch (error) {
      this.logger.error('Marketing content generation failed', error.stack);
      await this.updateAITask(task.id, AITaskStatus.FAILED, null, error.message);
      throw error;
    }
  }

  /**
   * Generate custom content with prompt
   */
  async generateCustomContent(contentDto: GenerateContentDto, currentUser: User): Promise<string> {
    try {
      let contextualPrompt = contentDto.prompt;

      // Add restaurant context if provided
      if (contentDto.restaurantId) {
        await this.verifyRestaurantAccess(contentDto.restaurantId, currentUser);
        
        const restaurant = await this.prisma.restaurant.findUnique({
          where: { id: contentDto.restaurantId },
          select: { name: true, description: true },
        });

        if (restaurant) {
          contextualPrompt = `Restaurant context: "${restaurant.name}" - ${restaurant.description}\n\n${contentDto.prompt}`;
        }
      }

      const generatedContent = await this.callDeepSeekAPI(
        contextualPrompt,
        contentDto.temperature || 0.7,
        contentDto.maxLength || 500,
      );

      return generatedContent.trim();

    } catch (error) {
      this.logger.error('Custom content generation failed', error.stack);
      throw error;
    }
  }

  /**
   * Get AI task status
   */
  async getTaskStatus(taskId: string, currentUser: User): Promise<any> {
    const task = await this.prisma.aITask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new BadRequestException('Task not found');
    }

    // Verify access
    if (currentUser.role !== Role.SUPERADMIN && task.createdBy !== currentUser.id) {
      throw new BadRequestException('Access denied to this task');
    }

    return task;
  }

  /**
   * Get AI usage statistics
   */
  async getUsageStats(restaurantId?: string, currentUser?: User): Promise<any> {
    const where: any = {};
    
    if (restaurantId) {
      if (currentUser) {
        await this.verifyRestaurantAccess(restaurantId, currentUser);
      }
      where.restaurantId = restaurantId;
    }

    const [totalTasks, successfulTasks, failedTasks, tasksByType] = await Promise.all([
      this.prisma.aITask.count({ where }),
      this.prisma.aITask.count({ 
        where: { ...where, status: AITaskStatus.COMPLETED }
      }),
      this.prisma.aITask.count({ 
        where: { ...where, status: AITaskStatus.FAILED }
      }),
      this.prisma.aITask.groupBy({
        by: ['taskType'],
        where,
        _count: true,
      }),
    ]);

    return {
      totalTasks,
      successfulTasks,
      failedTasks,
      successRate: totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0,
      tasksByType: tasksByType.map(item => ({
        taskType: item.taskType,
        count: item._count,
      })),
      estimatedCost: totalTasks * 0.02, // Rough estimate
    };
  }

  /**
   * Call DeepSeek API
   */
  private async callDeepSeekAPI(prompt: string, temperature: number = 0.7, maxTokens: number = 1000): Promise<string> {
    if (!this.deepSeekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    try {
      const response = await axios.post(
        `${this.deepSeekApiUrl}/chat/completions`,
        {
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature,
          max_tokens: maxTokens,
          stream: false,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.deepSeekApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 seconds
        }
      );

      const generatedText = response.data.choices[0]?.message?.content;
      
      if (!generatedText) {
        throw new Error('No content generated by AI');
      }

      return generatedText;

    } catch (error) {
      this.logger.error('DeepSeek API call failed', error.response?.data || error.message);
      throw new Error(`AI generation failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Build menu generation prompt
   */
  private buildMenuGenerationPrompt(dto: GenerateMenuDto, restaurant: any): string {
    const priceRangeText = {
      low: 'budget-friendly with most items under $10',
      medium: 'moderate pricing with items between $8-20',
      high: 'premium pricing with items $15-40+',
    };

    return `Generate a complete restaurant menu for "${restaurant?.name || 'a restaurant'}" with the following specifications:

RESTAURANT TYPE: ${dto.cuisineType}
PRICE RANGE: ${priceRangeText[dto.priceRange || 'medium']}
CATEGORIES: ${dto.categoryCount || 5}
ITEMS PER CATEGORY: ${dto.itemsPerCategory || 8}

${dto.additionalRequirements ? `SPECIAL REQUIREMENTS: ${dto.additionalRequirements}` : ''}

Please generate a JSON response with the following structure:
{
  "categories": [
    {
      "name": "Category Name",
      "description": "Brief category description",
      "priority": 1,
      "products": [
        {
          "name": "Product Name",
          "description": "Appetizing description with key ingredients",
          "price": 12.99,
          ${dto.includeAllergens ? '"allergens": ["gluten", "dairy"],' : ''}
          ${dto.includeVegetarian ? '"tags": ["vegetarian", "spicy"],' : ''}
          "variants": [
            {
              "name": "Size/Option",
              "priceModifier": 2.50
            }
          ]
        }
      ]
    }
  ],
  "metadata": {
    "cuisineType": "${dto.cuisineType}",
    "priceRange": "${dto.priceRange || 'medium'}",
    "totalItems": 40,
    "averagePrice": 15.50,
    "confidence": 0.95
  }
}

Make sure all descriptions are appetizing and highlight key ingredients. Prices should be realistic for the specified price range and location. Include popular and authentic dishes for the cuisine type.`;
  }

  /**
   * Build description improvement prompt
   */
  private buildDescriptionImprovementPrompt(product: any, dto: ImproveDescriptionsDto): string {
    return `Improve this restaurant menu item description to be more appetizing and engaging:

CURRENT DESCRIPTION: "${product.description || 'No description'}"
PRODUCT NAME: "${product.name}"
CATEGORY: "${product.category.name}"

REQUIREMENTS:
- Tone: ${dto.tone || 'appetizing'}
- Max length: ${dto.maxLength || 150} characters
- ${dto.includeIngredients ? 'Include key ingredients' : 'Focus on taste and experience'}

Make it mouth-watering and compelling while staying accurate. Focus on sensory details, preparation methods, and what makes this dish special.

Return only the improved description, no additional text.`;
  }

  /**
   * Build review analysis prompt
   */
  private buildReviewAnalysisPrompt(dto: AnalyzeReviewsDto): string {
    const reviewsText = dto.reviews.join('\n---\n');

    return `Analyze these customer reviews for a restaurant and provide insights:

REVIEWS:
${reviewsText}

Please provide a JSON response with:
{
  "overallSentiment": 0.7,
  "sentimentBreakdown": {
    "positive": 65,
    "neutral": 25,
    "negative": 10
  },
  "keyThemes": [
    {
      "theme": "food quality",
      "frequency": 85,
      "sentiment": 0.8
    }
  ],
  "complaints": [
    {
      "category": "service",
      "frequency": 15,
      "examples": ["slow service", "unfriendly staff"]
    }
  ],
  "highlights": [
    {
      "category": "food",
      "frequency": 80,
      "examples": ["delicious pizza", "fresh ingredients"]
    }
  ],
  "suggestions": [
    {
      "priority": "high",
      "category": "service",
      "suggestion": "Improve staff training",
      "impact": "Better customer satisfaction"
    }
  ]
}`;
  }

  /**
   * Build marketing content prompt
   */
  private buildMarketingPrompt(dto: GenerateMarketingContentDto, restaurant: any): string {
    const contentTypePrompts = {
      social_media: 'Create engaging social media posts (Instagram/Facebook) with hashtags',
      email_campaign: 'Write an email marketing campaign with subject line and body',
      promotional_banner: 'Design text for a promotional banner or flyer',
      menu_description: 'Write compelling menu descriptions for website/app',
    };

    let restaurantContext = '';
    if (restaurant) {
      restaurantContext = `
RESTAURANT: ${restaurant.name}
DESCRIPTION: ${restaurant.description || 'Not provided'}
POPULAR ITEMS: ${restaurant.categories?.flatMap((c: any) => c.products.map((p: any) => p.name)).slice(0, 5).join(', ') || 'Various dishes'}`;
    }

    return `Generate ${contentTypePrompts[dto.contentType]} for this restaurant:
${restaurantContext}

TARGET AUDIENCE: ${dto.targetAudience || 'General public'}
${dto.promotionDetails ? `PROMOTION: ${dto.promotionDetails}` : ''}
${dto.stylePreferences ? `STYLE: ${dto.stylePreferences}` : ''}

Make it engaging, authentic, and action-oriented. Include relevant emojis and call-to-action where appropriate.`;
  }

  /**
   * Parse menu generation result
   */
  private parseMenuGenerationResult(generatedText: string): MenuGenerationResultDto {
    try {
      // Clean the generated text (remove markdown formatting if present)
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      // Validate structure
      if (!parsed.categories || !Array.isArray(parsed.categories)) {
        throw new Error('Invalid menu structure: missing categories array');
      }

      return parsed as MenuGenerationResultDto;
    } catch (error) {
      this.logger.error('Failed to parse menu generation result', error.message);
      throw new Error('Failed to parse AI-generated menu. Please try again.');
    }
  }

  /**
   * Parse review analysis result
   */
  private parseReviewAnalysis(generatedText: string): ReviewAnalysisResultDto {
    try {
      const cleanedText = generatedText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedText);
      
      return parsed as ReviewAnalysisResultDto;
    } catch (error) {
      this.logger.error('Failed to parse review analysis result', error.message);
      throw new Error('Failed to parse AI analysis. Please try again.');
    }
  }

  /**
   * Create AI task record
   */
  private async createAITask(
    taskType: AITaskType,
    restaurantId: string,
    createdBy: string,
    parameters: any,
  ): Promise<any> {
    return this.prisma.aITask.create({
      data: {
        type: taskType as string,
        taskType: taskType as any,
        prompt: `AI task for ${taskType}`, // Add required prompt field
        status: AITaskStatus.PROCESSING as any,
        parameters,
        progress: 0,
        restaurant: restaurantId ? {
          connect: { id: restaurantId }
        } : undefined,
        user: {
          connect: { id: createdBy }
        },
        createdBy,
      },
    });
  }

  /**
   * Update AI task status
   */
  private async updateAITask(
    taskId: string,
    status: AITaskStatus,
    results?: any,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.aITask.update({
      where: { id: taskId },
      data: {
        status: status as any,
        results,
        errorMessage,
        progress: status === AITaskStatus.COMPLETED ? 100 : status === AITaskStatus.FAILED ? 0 : 50,
        completedAt: status === AITaskStatus.COMPLETED || status === AITaskStatus.FAILED ? new Date() : null,
      },
    });
  }

  /**
   * Verify restaurant access
   */
  private async verifyRestaurantAccess(restaurantId: string, currentUser: User): Promise<void> {
    if (currentUser.role === Role.SUPERADMIN) return;

    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });

    if (!restaurant) {
      throw new BadRequestException(`Restaurant with ID ${restaurantId} not found`);
    }

    if (currentUser.role === Role.RESTAURANT_OWNER && restaurant.ownerId !== currentUser.id) {
      throw new BadRequestException('You can only use AI features for your own restaurants');
    }
  }
}