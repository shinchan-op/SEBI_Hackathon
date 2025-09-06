import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { SimpleOrderbookService } from '../orderbook/simple-orderbook.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private orderbookService: SimpleOrderbookService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto, userId: number) {
    const order = this.orderRepository.create({
      ...createOrderDto,
      userId,
      status: 'OPEN',
    });

    const result = await this.orderbookService.addOrder(order);
    return result.order;
  }

  async getOrderById(id: number, userId: number): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, userId },
    });

    if (!order) {
      throw new Error(`Order with ID ${id} not found`);
    }

    return order;
  }

  async getUserOrders(userId: number): Promise<Order[]> {
    return this.orderRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}
