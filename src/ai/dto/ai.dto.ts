import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  IsBoolean,
  IsUUID,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export enum AITaskType {
  GENERATE_MENU = 'GENERATE_MENU',
  IMPROVE_DESCRIPTIONS = 'IMPROVE_DESCRIPTIONS',
  TRANSLATE_MENU = 'TRANSLATE_MENU',
  GENERATE_CATEGORIES = 'GENERATE_CATEGORIES',
  SUGGEST_PRICING = 'SUGGEST_PRICING',
  ANALYZE_REVIEWS = 'ANALYZE_REVIEWS',
  GENERATE_MARKETING_CONTENT = 'GENERATE_MARKETING_CONTENT',
}

export enum AITaskStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export class GenerateMenuDto {
  @ApiProperty({ description: 'Restaurant ID to generate menu for' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Restaurant type/cuisine (e.g., Italian, Fast Food, Asian)' })
  @IsString()
  @IsNotEmpty()
  cuisineType: string;

  @ApiProperty({ description: 'Target price range (low, medium, high)', required: false })
  @IsEnum(['low', 'medium', 'high'])
  @IsOptional()
  priceRange?: 'low' | 'medium' | 'high';

  @ApiProperty({ description: 'Number of categories to generate', minimum: 1, maximum: 10, default: 5 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  categoryCount?: number;

  @ApiProperty({ description: 'Items per category', minimum: 3, maximum: 15, default: 8 })
  @IsNumber()
  @Min(3)
  @Max(15)
  @IsOptional()
  itemsPerCategory?: number;

  @ApiProperty({ description: 'Additional requirements or preferences', required: false })
  @IsString()
  @IsOptional()
  additionalRequirements?: string;

  @ApiProperty({ description: 'Include allergen information', default: true })
  @IsBoolean()
  @IsOptional()
  includeAllergens?: boolean;

  @ApiProperty({ description: 'Include nutritional information', default: false })
  @IsBoolean()
  @IsOptional()
  includeNutrition?: boolean;

  @ApiProperty({ description: 'Generate vegetarian/vegan options', default: true })
  @IsBoolean()
  @IsOptional()
  includeVegetarian?: boolean;
}

export class ImproveDescriptionsDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Product IDs to improve (empty for all)', required: false })
  @IsArray()
  @IsUUID(4, { each: true })
  @IsOptional()
  productIds?: string[];

  @ApiProperty({ description: 'Target tone (casual, professional, appetizing)', default: 'appetizing' })
  @IsEnum(['casual', 'professional', 'appetizing', 'elegant', 'fun'])
  @IsOptional()
  tone?: 'casual' | 'professional' | 'appetizing' | 'elegant' | 'fun';

  @ApiProperty({ description: 'Maximum description length', minimum: 50, maximum: 500, default: 150 })
  @IsNumber()
  @Min(50)
  @Max(500)
  @IsOptional()
  maxLength?: number;

  @ApiProperty({ description: 'Include ingredients in description', default: true })
  @IsBoolean()
  @IsOptional()
  includeIngredients?: boolean;
}

export class TranslateMenuDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Target language code (e.g., ru, es, fr, de)' })
  @IsString()
  @IsNotEmpty()
  targetLanguage: string;

  @ApiProperty({ description: 'Translate product names', default: true })
  @IsBoolean()
  @IsOptional()
  translateNames?: boolean;

  @ApiProperty({ description: 'Translate descriptions', default: true })
  @IsBoolean()
  @IsOptional()
  translateDescriptions?: boolean;

  @ApiProperty({ description: 'Translate category names', default: true })
  @IsBoolean()
  @IsOptional()
  translateCategories?: boolean;

  @ApiProperty({ description: 'Keep original text as fallback', default: true })
  @IsBoolean()
  @IsOptional()
  keepOriginal?: boolean;
}

export class SuggestPricingDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Market location (city/region)' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ description: 'Target profit margin percentage', minimum: 10, maximum: 80, default: 30 })
  @IsNumber()
  @Min(10)
  @Max(80)
  @IsOptional()
  targetMargin?: number;

  @ApiProperty({ description: 'Competitor pricing data', required: false })
  @IsObject()
  @IsOptional()
  competitorData?: {
    restaurantName: string;
    similarItems: {
      itemName: string;
      price: number;
    }[];
  }[];
}

export class AnalyzeReviewsDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ description: 'Review text to analyze' })
  @IsArray()
  @IsString({ each: true })
  reviews: string[];

  @ApiProperty({ description: 'Include sentiment analysis', default: true })
  @IsBoolean()
  @IsOptional()
  includeSentiment?: boolean;

  @ApiProperty({ description: 'Extract key themes', default: true })
  @IsBoolean()
  @IsOptional()
  extractThemes?: boolean;

  @ApiProperty({ description: 'Suggest improvements', default: true })
  @IsBoolean()
  @IsOptional()
  suggestImprovements?: boolean;
}

export class GenerateMarketingContentDto {
  @ApiProperty({ description: 'Restaurant ID' })
  @IsUUID()
  @IsNotEmpty()
  restaurantId: string;

  @ApiProperty({ 
    description: 'Content type to generate',
    enum: ['social_media', 'email_campaign', 'promotional_banner', 'menu_description']
  })
  @IsEnum(['social_media', 'email_campaign', 'promotional_banner', 'menu_description'])
  contentType: 'social_media' | 'email_campaign' | 'promotional_banner' | 'menu_description';

  @ApiProperty({ description: 'Target audience (families, young_adults, business_people)', required: false })
  @IsEnum(['families', 'young_adults', 'business_people', 'tourists', 'locals'])
  @IsOptional()
  targetAudience?: 'families' | 'young_adults' | 'business_people' | 'tourists' | 'locals';

  @ApiProperty({ description: 'Promotion or special offer details', required: false })
  @IsString()
  @IsOptional()
  promotionDetails?: string;

  @ApiProperty({ description: 'Tone and style preferences', required: false })
  @IsString()
  @IsOptional()
  stylePreferences?: string;
}

export class AITaskResponseDto {
  @ApiProperty({ description: 'Task ID' })
  id: string;

  @ApiProperty({ description: 'Task type', enum: AITaskType })
  taskType: AITaskType;

  @ApiProperty({ description: 'Task status', enum: AITaskStatus })
  status: AITaskStatus;

  @ApiProperty({ description: 'Restaurant ID' })
  restaurantId: string;

  @ApiProperty({ description: 'Task parameters' })
  parameters: any;

  @ApiProperty({ description: 'Task results', required: false })
  results?: any;

  @ApiProperty({ description: 'Error message if failed', required: false })
  errorMessage?: string;

  @ApiProperty({ description: 'Progress percentage (0-100)' })
  progress: number;

  @ApiProperty({ description: 'Estimated completion time', required: false })
  estimatedCompletion?: Date;

  @ApiProperty({ description: 'Task creation time' })
  createdAt: Date;

  @ApiProperty({ description: 'Task completion time', required: false })
  completedAt?: Date;

  @ApiProperty({ description: 'User who initiated the task' })
  createdBy: string;
}

export class MenuGenerationResultDto {
  @ApiProperty({ description: 'Generated categories with products' })
  categories: {
    name: string;
    description: string;
    priority: number;
    products: {
      name: string;
      description: string;
      price: number;
      variants?: {
        name: string;
        priceModifier: number;
      }[];
      allergens?: string[];
      nutritionalInfo?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };
      tags?: string[];
    }[];
  }[];

  @ApiProperty({ description: 'Generation metadata' })
  metadata: {
    cuisineType: string;
    priceRange: string;
    totalItems: number;
    averagePrice: number;
    generationTime: number;
    confidence: number;
  };
}

export class ReviewAnalysisResultDto {
  @ApiProperty({ description: 'Overall sentiment score (-1 to 1)' })
  overallSentiment: number;

  @ApiProperty({ description: 'Sentiment breakdown' })
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };

  @ApiProperty({ description: 'Key themes extracted' })
  keyThemes: {
    theme: string;
    frequency: number;
    sentiment: number;
  }[];

  @ApiProperty({ description: 'Common complaints' })
  complaints: {
    category: string;
    frequency: number;
    examples: string[];
  }[];

  @ApiProperty({ description: 'Positive highlights' })
  highlights: {
    category: string;
    frequency: number;
    examples: string[];
  }[];

  @ApiProperty({ description: 'Improvement suggestions' })
  suggestions: {
    priority: 'high' | 'medium' | 'low';
    category: string;
    suggestion: string;
    impact: string;
  }[];
}

export class AIUsageStatsDto {
  @ApiProperty({ description: 'Total API calls made' })
  totalCalls: number;

  @ApiProperty({ description: 'Successful completions' })
  successfulCalls: number;

  @ApiProperty({ description: 'Failed calls' })
  failedCalls: number;

  @ApiProperty({ description: 'Average response time (ms)' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Usage by task type' })
  usageByType: {
    taskType: AITaskType;
    count: number;
    successRate: number;
  }[];

  @ApiProperty({ description: 'Monthly usage trends' })
  monthlyUsage: {
    month: string;
    calls: number;
    cost: number;
  }[];

  @ApiProperty({ description: 'Current month cost estimate' })
  currentMonthCost: number;
}

export class GenerateContentDto {
  @ApiProperty({ description: 'Content prompt for AI generation' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiProperty({ description: 'Maximum response length', minimum: 50, maximum: 2000, default: 500 })
  @IsNumber()
  @Min(50)
  @Max(2000)
  @IsOptional()
  maxLength?: number;

  @ApiProperty({ description: 'Content temperature (creativity)', minimum: 0.1, maximum: 1.0, default: 0.7 })
  @IsNumber()
  @Min(0.1)
  @Max(1.0)
  @IsOptional()
  temperature?: number;

  @ApiProperty({ description: 'Restaurant context', required: false })
  @IsUUID()
  @IsOptional()
  restaurantId?: string;
}