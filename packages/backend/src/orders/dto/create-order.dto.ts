import { IsEnum, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateOrderDto {
  @IsNumber()
  @IsPositive()
  bondId: number;

  @IsEnum(['BUY', 'SELL'])
  side: 'BUY' | 'SELL';

  @IsEnum(['MARKET', 'LIMIT'])
  orderType: 'MARKET' | 'LIMIT';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  priceLimit?: number;

  @IsNumber()
  @IsPositive()
  @Min(1)
  qtyUnits: number;
}
