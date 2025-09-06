'use client';

import { Bond } from '@/types/bond';
import { format } from 'date-fns';

interface BondCardProps {
  bond: Bond;
  isSelected: boolean;
  onClick: () => void;
}

export function BondCard({ bond, isSelected, onClick }: BondCardProps) {
  const getRatingColor = (rating: string) => {
    if (rating.startsWith('AAA')) return 'text-green-600 bg-green-100';
    if (rating.startsWith('AA')) return 'text-blue-600 bg-blue-100';
    if (rating.startsWith('A')) return 'text-yellow-600 bg-yellow-100';
    if (rating.startsWith('BBB')) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return `₹${price.toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM yyyy');
  };

  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-primary-500 bg-primary-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">
          {bond.name}
        </h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRatingColor(bond.rating)}`}>
          {bond.rating}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Issuer:</span>
          <span className="font-medium text-gray-900">{bond.issuer}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Coupon:</span>
          <span className="font-medium text-gray-900">{bond.coupon}%</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Maturity:</span>
          <span className="font-medium text-gray-900">{formatDate(bond.maturityDate)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Fraction Size:</span>
          <span className="font-medium text-gray-900">₹{bond.fractionSize.toLocaleString()}</span>
        </div>

        {bond.lastTradedPrice && (
          <div className="flex justify-between">
            <span className="text-gray-600">Last Price:</span>
            <span className="font-medium text-primary-600">
              {formatPrice(bond.lastTradedPrice)}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-gray-600">Days Since Trade:</span>
          <span className={`font-medium ${
            bond.daysSinceLastTrade > 30 
              ? 'text-warning-600' 
              : bond.daysSinceLastTrade > 7 
                ? 'text-yellow-600' 
                : 'text-success-600'
          }`}>
            {bond.daysSinceLastTrade}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-500">
          <span>ISIN: {bond.isin}</span>
          <span>{bond.listingSource || 'NSE'}</span>
        </div>
      </div>
    </div>
  );
}
