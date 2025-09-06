import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { SimpleOrderbookService } from '../orderbook/simple-orderbook.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('api/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private orderbookService: SimpleOrderbookService,
  ) {}

  @Post()
  async createOrder(@Body() createOrderDto: CreateOrderDto, @Request() req) {
    const userId = req.user.id;
    return this.ordersService.createOrder(createOrderDto, userId);
  }

  @Get(':id')
  async getOrder(@Param('id') id: number, @Request() req) {
    const userId = req.user.id;
    return this.ordersService.getOrderById(id, userId);
  }

  @Get('user/:userId')
  async getUserOrders(@Param('userId') userId: number, @Request() req) {
    // Verify user can access these orders
    if (req.user.id !== userId) {
      throw new Error('Unauthorized');
    }
    return this.ordersService.getUserOrders(userId);
  }

  @Post(':id/cancel')
  async cancelOrder(@Param('id') id: number, @Request() req) {
    const userId = req.user.id;
    return this.orderbookService.cancelOrder(id, userId);
  }

  @Get('book/:bondId')
  async getOrderBook(@Param('bondId') bondId: number) {
    return this.orderbookService.getOrderBook(bondId);
  }
}
