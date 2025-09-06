'use client';

import { useState, useEffect } from 'react';
import { OrderBook, OrderBookLevel } from '@/types/bond';

interface OrderBookProps {
  bondId: number;
}

export function OrderBook({ bondId }: OrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [bondId]);

  const fetchOrderBook = async () => {
    try {
      const response = await fetch(`/api/orders/book/${bondId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch order book');
      }
      const data = await response.json();
      setOrderBook(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  const formatQuantity = (qty: number) => {
    return qty.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-danger-600 mb-4">{error}</p>
        <button 
          onClick={fetchOrderBook}
          className="btn btn-primary btn-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!orderBook) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">No order book data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Last Trade Info */}
      {orderBook.lastPrice && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Last Trade:</span>
            <div className="text-right">
              <div className="text-lg font-semibold text-primary-600">
                {formatPrice(orderBook.lastPrice)}
              </div>
              {orderBook.lastTradeTime && (
                <div className="text-xs text-gray-500">
                  {new Date(orderBook.lastTradeTime).toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bids (Buy Orders) */}
        <div>
          <h4 className="text-sm font-semibold text-success-600 mb-3 flex items-center">
            <div className="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
            Bids (Buy Orders)
          </h4>
          <div className="space-y-1">
            {orderBook.bids.length > 0 ? (
              orderBook.bids.map((level, index) => (
                <OrderBookRow
                  key={index}
                  level={level}
                  type="bid"
                  isBest={index === 0}
                />
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No buy orders
              </div>
            )}
          </div>
        </div>

        {/* Asks (Sell Orders) */}
        <div>
          <h4 className="text-sm font-semibold text-danger-600 mb-3 flex items-center">
            <div className="w-2 h-2 bg-danger-500 rounded-full mr-2"></div>
            Asks (Sell Orders)
          </h4>
          <div className="space-y-1">
            {orderBook.asks.length > 0 ? (
              orderBook.asks.map((level, index) => (
                <OrderBookRow
                  key={index}
                  level={level}
                  type="ask"
                  isBest={index === 0}
                />
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No sell orders
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface OrderBookRowProps {
  level: OrderBookLevel;
  type: 'bid' | 'ask';
  isBest: boolean;
}

function OrderBookRow({ level, type, isBest }: OrderBookRowProps) {
  const formatPrice = (price: number) => {
    return `₹${price.toFixed(2)}`;
  };

  const formatQuantity = (qty: number) => {
    return qty.toLocaleString();
  };

  const getRowClasses = () => {
    const baseClasses = "flex justify-between items-center p-2 rounded text-sm font-mono";
    if (type === 'bid') {
      return `${baseClasses} ${isBest ? 'bg-success-100 border border-success-200' : 'bg-success-50 hover:bg-success-100'}`;
    } else {
      return `${baseClasses} ${isBest ? 'bg-danger-100 border border-danger-200' : 'bg-danger-50 hover:bg-danger-100'}`;
    }
  };

  const getPriceClasses = () => {
    const baseClasses = "font-semibold";
    if (type === 'bid') {
      return `${baseClasses} ${isBest ? 'text-success-700' : 'text-success-600'}`;
    } else {
      return `${baseClasses} ${isBest ? 'text-danger-700' : 'text-danger-600'}`;
    }
  };

  return (
    <div className={getRowClasses()}>
      <span className={getPriceClasses()}>
        {formatPrice(level.price)}
      </span>
      <span className="text-gray-600">
        {formatQuantity(level.quantity)}
      </span>
    </div>
  );
}
