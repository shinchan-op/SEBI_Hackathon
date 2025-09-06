import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bond } from '../entities/bond.entity';
import { SimpleOrderbookService } from '../orderbook/simple-orderbook.service';

@Injectable()
export class BondsService {
  constructor(
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
    private orderbookService: SimpleOrderbookService,
  ) {}

  async getBonds(options: {
    page: number;
    limit: number;
    rating?: string;
    search?: string;
  }) {
    const { page, limit, rating, search } = options;
    const skip = (page - 1) * limit;

    const queryBuilder = this.bondRepository.createQueryBuilder('bond');

    if (rating) {
      queryBuilder.andWhere('bond.rating = :rating', { rating });
    }

    if (search) {
      queryBuilder.andWhere(
        '(bond.name ILIKE :search OR bond.issuer ILIKE :search OR bond.isin ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [bonds, total] = await queryBuilder
      .orderBy('bond.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      bonds,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getBondById(id: number): Promise<Bond> {
    const bond = await this.bondRepository.findOne({ where: { id } });
    if (!bond) {
      throw new Error(`Bond with ID ${id} not found`);
    }
    return bond;
  }

  async getOrderBook(bondId: number) {
    return this.orderbookService.getOrderBook(bondId);
  }
}
