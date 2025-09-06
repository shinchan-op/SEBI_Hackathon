'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Bond, BondQuote } from '@/types/bond';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceChartProps {
  bond: Bond;
  quote?: BondQuote | null;
}

export function PriceChart({ bond, quote }: PriceChartProps) {
  const chartRef = useRef<ChartJS<'line'>>(null);

  // Mock historical data - in production, fetch from API
  const historicalData = generateMockHistoricalData(bond, quote);

  const data = {
    labels: historicalData.map(d => d.date),
    datasets: [
      {
        label: 'Price',
        data: historicalData.map(d => d.price),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Fair Value',
        data: historicalData.map(d => d.fairValue),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: false,
        borderDash: [5, 5],
        tension: 0.4,
      },
      {
        label: 'T+7 Prediction',
        data: historicalData.map(d => d.prediction),
        borderColor: 'rgb(245, 158, 11)',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: false,
        borderDash: [10, 5],
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${bond.name} - Price History & Predictions`,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ₹${value.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Price (₹)',
        },
        beginAtZero: false,
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  return (
    <div className="space-y-4">
      {/* Current Quote Summary */}
      {quote && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="text-center">
            <p className="text-sm text-gray-600">Current Price</p>
            <p className="text-lg font-semibold text-primary-600">
              ₹{quote.fractionQuote.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Fair Value</p>
            <p className="text-lg font-semibold text-success-600">
              ₹{quote.priceCleanFair.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">T+7 Prediction</p>
            <p className="text-lg font-semibold text-warning-600">
              ₹{quote.predictive.t7PriceMean.toFixed(2)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Confidence Band</p>
            <p className="text-lg font-semibold text-gray-600">
              ±{((quote.predictive.t7High - quote.predictive.t7Low) / quote.predictive.t7PriceMean * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="chart-container">
        <Line ref={chartRef} data={data} options={options} />
      </div>

      {/* Feature Importance */}
      {quote && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Price Factors</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Risk-free Yield:</span>
              <span className="font-medium">{quote.inputs.rfYield.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Rating Spread:</span>
              <span className="font-medium">{quote.inputs.ratingSpreadBps} bps</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Liquidity Premium:</span>
              <span className="font-medium">{quote.inputs.liquidityPremBps} bps</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Market Perception:</span>
              <span className="font-medium">{(quote.inputs.mpi * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Order Imbalance:</span>
              <span className="font-medium">{(quote.inputs.orderImbalance * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between p-2 bg-gray-50 rounded">
              <span>Days Since Trade:</span>
              <span className="font-medium">{bond.daysSinceLastTrade}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function generateMockHistoricalData(bond: Bond, quote?: BondQuote | null) {
  const data = [];
  const today = new Date();
  const basePrice = quote?.fractionQuote || bond.lastTradedPrice || 1000;
  const fairValue = quote?.priceCleanFair || basePrice * 0.98;
  const prediction = quote?.predictive.t7PriceMean || basePrice * 1.02;

  // Generate 30 days of historical data
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Add some realistic price movement
    const volatility = 0.02; // 2% daily volatility
    const randomWalk = (Math.random() - 0.5) * volatility;
    const trend = i > 7 ? 0.001 : 0.002; // Slight upward trend
    
    const price = basePrice * (1 + randomWalk + trend * (30 - i));
    const fairVal = fairValue * (1 + randomWalk * 0.5);
    const pred = prediction * (1 + randomWalk * 0.3);
    
    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.max(price, basePrice * 0.9), // Floor at 90% of base
      fairValue: Math.max(fairVal, fairValue * 0.95),
      prediction: Math.max(pred, prediction * 0.95),
    });
  }
  
  return data;
}
