import { useState, useEffect } from 'react';
import { useContractReads } from 'wagmi';
import { type Abi } from 'viem';

// FTSO Price Feed Contract Addresses from Kinetic
const FTSO_ADDRESSES = {
  ETH: '0x1F31ba729A6A544DeEa2d405D98B066e3efE53FD',
  FLR: '0x799efB666d14739F3A6aF0b702405A94bb7F96F7',
  USDT: '0xbeCbA3ae453278574304DCb405a7f54a6155E0C4'
};

// ABI for FTSO Price Feed (minimal interface needed for price)
const FTSO_ABI = [
  {
    inputs: [],
    name: 'getCurrentPrice',
    outputs: [
      {
        internalType: 'uint256',
        name: '_price',
        type: 'uint256'
      },
      {
        internalType: 'uint256',
        name: '_timestamp',
        type: 'uint256'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

interface PriceData {
  price: string;
  timestamp: number;
}

export const PriceFeeds = () => {
  const [prices, setPrices] = useState<Record<string, PriceData>>({
    ETH: { price: '0', timestamp: 0 },
    FLR: { price: '0', timestamp: 0 },
    USDT: { price: '0', timestamp: 0 }
  });
  const [currentTime, setCurrentTime] = useState<number>(Math.floor(Date.now() / 1000));

  // Create contract configs for all price feeds
  const contracts = Object.entries(FTSO_ADDRESSES).map(([symbol, address]) => ({
    address: address as `0x${string}`,
    abi: FTSO_ABI,
    functionName: 'getCurrentPrice'
  }));

  // Use wagmi's useContractReads to fetch all prices simultaneously
  const { data, isError, isLoading } = useContractReads({
    contracts,
    query: {
      refetchInterval: 10000 // Refetch every 10 seconds
    }
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format time difference
  const getTimeAgo = (timestamp: number): string => {
    if (timestamp === 0) return 'No update';
    
    const seconds = currentTime - timestamp;
    
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return 'Over a day ago';
  };

  // Update prices when data changes
  useEffect(() => {
    if (data) {
      const symbols = Object.keys(FTSO_ADDRESSES);
      const newPrices: Record<string, PriceData> = {};
      
      data.forEach((result, index) => {
        if (result.status === 'success' && result.result) {
          const [price, timestamp] = result.result as [bigint, bigint];
          // Convert price to a human-readable format (assuming 5 decimals as per FTSO standard)
          const priceFormatted = (Number(price) / 100000).toFixed(5);
          newPrices[symbols[index]] = {
            price: priceFormatted,
            timestamp: Number(timestamp)
          };
        }
      });

      setPrices(prev => ({ ...prev, ...newPrices }));
    }
  }, [data]);

  if (isLoading) {
    return <div className="animate-pulse">Loading prices...</div>;
  }

  if (isError) {
    return <div className="text-red-500">Error fetching prices</div>;
  }

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {Object.entries(prices).map(([symbol, { price, timestamp }]) => (
        <div key={symbol} className="flex flex-col items-center p-3 bg-white dark:bg-gray-700 rounded-md shadow">
          <span className="text-sm text-gray-500 dark:text-gray-400">{symbol}/USD</span>
          <span className="text-lg font-semibold">${price}</span>
          <span className="text-xs text-gray-400">
            {getTimeAgo(timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}; 