import { IsEnum, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateSipDto {
  @IsNumber()
  @IsPositive()
  amountPerPeriod: number;

  @IsEnum(['WEEKLY', 'MONTHLY'])
  frequency: 'WEEKLY' | 'MONTHLY';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  targetBondId?: number;

  @IsOptional()
  targetBucketId?: string;
}
