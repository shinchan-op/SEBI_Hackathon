export interface Bond {
  id: number;
  isin: string;
  issuer: string;
  name: string;
  coupon: number;
  maturityDate: string;
  faceValue: number;
  fractionSize: number;
  rating: string;
  issueSize?: number;
  listingSource?: string;
  lastTradedPrice?: number;
  lastTradedYield?: number;
  daysSinceLastTrade: number;
  createdAt: string;
  updatedAt: string;
}

export interface BondQuote {
  bondId: number;
  priceCleanFair: number;
  priceCleanAdj: number;
  priceDirtyAdj: number;
  fractionQuote: number;
  yieldFair: number;
  inputs: {
    rfYield: number;
    ratingSpreadBps: number;
    liquidityPremBps: number;
    mpi: number;
    orderImbalance: number;
  };
  caps: {
    softLow: number;
    softHigh: number;
    hardLow: number;
    hardHigh: number;
  };
  predictive: {
    t7PriceMean: number;
    t7Low: number;
    t7High: number;
  };
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orders: Order[];
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastPrice?: number;
  lastTradeTime?: string;
}

export interface Order {
  id: number;
  userId: number;
  bondId: number;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT';
  priceLimit?: number;
  qtyUnits: number;
  qtyFilledUnits: number;
  status: 'OPEN' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED' | 'PARTIAL';
  createdAt: string;
  updatedAt: string;
}

export interface Trade {
  id: number;
  buyOrderId: number;
  sellOrderId: number;
  bondId: number;
  pricePerUnit: number;
  qtyUnits: number;
  executedAt: string;
  tradeReceiptJson: any;
}
