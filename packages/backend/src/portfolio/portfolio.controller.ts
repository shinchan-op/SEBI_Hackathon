import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';
import { SipService } from '../sip/sip.service';
import { CreateSipDto } from './dto/create-sip.dto';

@Controller('api/portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(
    private portfolioService: PortfolioService,
    private sipService: SipService,
  ) {}

  @Get()
  async getPortfolio(@Request() req) {
    const userId = req.user.id;
    return this.portfolioService.getPortfolio(userId);
  }

  @Get('export')
  async exportPortfolio(@Request() req) {
    const userId = req.user.id;
    return this.portfolioService.exportPortfolio(userId);
  }

  @Get('sip')
  async getSipPlans(@Request() req) {
    const userId = req.user.id;
    return this.sipService.getUserSipPlans(userId);
  }

  @Post('sip')
  async createSipPlan(@Body() createSipDto: CreateSipDto, @Request() req) {
    const userId = req.user.id;
    return this.sipService.createSipPlan(
      userId,
      createSipDto.amountPerPeriod,
      createSipDto.frequency,
      createSipDto.targetBondId,
      createSipDto.targetBucketId,
    );
  }

  @Post('sip/:id/cancel')
  async cancelSipPlan(@Param('id') id: number, @Request() req) {
    const userId = req.user.id;
    return this.sipService.cancelSipPlan(id, userId);
  }

  @Post('early-exit')
  async processEarlyExit(
    @Body() body: { bondId: number; qtyUnits: number; allowRecycling: boolean },
    @Request() req
  ) {
    const userId = req.user.id;
    return this.sipService.processEarlyExitRequest(
      userId,
      body.bondId,
      body.qtyUnits,
      body.allowRecycling,
    );
  }
}
