import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bond } from '../entities/bond.entity';
import { User } from '../entities/user.entity';
import { Portfolio } from '../entities/portfolio.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(Bond)
    private bondRepository: Repository<Bond>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
  ) {}

  async seedBonds() {
    const bonds = [
      {
        isin: 'INE002A01018',
        issuer: 'Government of India',
        name: '7.26% GOI 2029',
        coupon: 7.26,
        maturityDate: new Date('2029-04-08'),
        faceValue: 100000,
        fractionSize: 1000,
        rating: 'AAA',
        issueSize: 10000,
        listingSource: 'NSE',
        lastTradedPrice: 98.50,
        lastTradedYield: 7.45,
        daysSinceLastTrade: 1,
      },
      {
        isin: 'INE002A01026',
        issuer: 'Government of India',
        name: '7.18% GOI 2033',
        coupon: 7.18,
        maturityDate: new Date('2033-01-15'),
        faceValue: 100000,
        fractionSize: 1000,
        rating: 'AAA',
        issueSize: 15000,
        listingSource: 'NSE',
        lastTradedPrice: 97.25,
        lastTradedYield: 7.52,
        daysSinceLastTrade: 2,
      },
      {
        isin: 'INE002A01034',
        issuer: 'Government of India',
        name: '6.95% GOI 2031',
        coupon: 6.95,
        maturityDate: new Date('2031-01-15'),
        faceValue: 100000,
        fractionSize: 1000,
        rating: 'AAA',
        issueSize: 12000,
        listingSource: 'NSE',
        lastTradedPrice: 96.80,
        lastTradedYield: 7.28,
        daysSinceLastTrade: 0,
      },
      {
        isin: 'INE002A01042',
        issuer: 'State Bank of India',
        name: '7.50% SBI 2028',
        coupon: 7.50,
        maturityDate: new Date('2028-06-15'),
        faceValue: 100000,
        fractionSize: 1000,
        rating: 'AA+',
        issueSize: 5000,
        listingSource: 'NSE',
        lastTradedPrice: 99.20,
        lastTradedYield: 7.65,
        daysSinceLastTrade: 3,
      },
      {
        isin: 'INE002A01050',
        issuer: 'HDFC Bank',
        name: '7.25% HDFC 2030',
        coupon: 7.25,
        maturityDate: new Date('2030-03-15'),
        faceValue: 100000,
        fractionSize: 1000,
        rating: 'AA+',
        issueSize: 3000,
        listingSource: 'NSE',
        lastTradedPrice: 98.75,
        lastTradedYield: 7.48,
        daysSinceLastTrade: 1,
      },
    ];

    for (const bondData of bonds) {
      const existingBond = await this.bondRepository.findOne({
        where: { isin: bondData.isin },
      });

      if (!existingBond) {
        const bond = this.bondRepository.create(bondData);
        await this.bondRepository.save(bond);
        console.log(`Created bond: ${bond.name}`);
      }
    }
  }

  async seedUsers() {
    const users = [
      {
        email: 'demo@sebibonds.com',
        hashedPassword: '$2b$10$example.hash.for.demo',
        kycStatus: 'VERIFIED',
        firstName: 'Demo',
        lastName: 'User',
        phone: '+91-9876543210',
        panNumber: 'ABCDE1234F',
      },
    ];

    for (const userData of users) {
      const existingUser = await this.userRepository.findOne({
        where: { email: userData.email },
      });

      if (!existingUser) {
        const user = this.userRepository.create(userData);
        await this.userRepository.save(user);

        // Create portfolio for user
        const portfolio = this.portfolioRepository.create({
          userId: user.id,
          cashBalance: 100000, // ₹1,00,000 starting balance
        });
        await this.portfolioRepository.save(portfolio);

        console.log(`Created user: ${user.email}`);
      }
    }
  }

  async run() {
    console.log('🌱 Starting database seeding...');
    
    await this.seedBonds();
    await this.seedUsers();
    
    console.log('✅ Database seeding completed!');
  }
}
