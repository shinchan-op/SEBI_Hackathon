import { Controller, Get, Param, Query } from '@nestjs/common';
import { BondsService } from './bonds.service';
import { PricingService } from '../pricing/pricing.service';

@Controller('api/bonds')
export class BondsController {
  constructor(
    private bondsService: BondsService,
    private pricingService: PricingService,
  ) {}

  @Get()
  async getBonds(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('rating') rating?: string,
    @Query('search') search?: string,
  ) {
    return this.bondsService.getBonds({
      page,
      limit,
      rating,
      search,
    });
  }

  @Get(':id')
  async getBond(@Param('id') id: number) {
    return this.bondsService.getBondById(id);
  }

  @Get(':id/book')
  async getOrderBook(@Param('id') id: number) {
    return this.bondsService.getOrderBook(id);
  }

  @Get(':id/quote')
  async getQuote(@Param('id') id: number) {
    return this.pricingService.getBondQuote(id);
  }
}
