import React, { useEffect, useState } from 'react';

interface PieChartSegment {
  label: string;
  value: number;
  color: string;
  description: string;
}

interface StrategyPieChartProps {
  segments: PieChartSegment[];
  className?: string;
}

export const StrategyPieChart: React.FC<StrategyPieChartProps> = ({ segments, className = '' }) => {
  const [animatedSegments, setAnimatedSegments] = useState<PieChartSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<PieChartSegment | null>(null);
  const size = 280;
  const center = size / 2;
  const radius = size * 0.35;

  useEffect(() => {
    const animateSegments = async () => {
      setAnimatedSegments([]);
      for (const segment of segments) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setAnimatedSegments(prev => [...prev, segment]);
      }
    };
    animateSegments();
  }, [segments]);

  const getCoordinatesForPercent = (percent: number) => {
    const x = center + radius * Math.cos(2 * Math.PI * percent - Math.PI / 2);
    const y = center + radius * Math.sin(2 * Math.PI * percent - Math.PI / 2);
    return [x, y];
  };

  let cumulativePercent = 0;

  return (
    <div className={`relative flex items-start gap-8 ${className}`}>
      <div className="relative">
        <svg 
          width={size} 
          height={size} 
          viewBox={`0 0 ${size} ${size}`}
          className="transform transition-all duration-500"
        >
          {animatedSegments.map((segment, index) => {
            const startPercent = cumulativePercent;
            const slicePercent = segment.value / 100;
            cumulativePercent += slicePercent;

            const [startX, startY] = getCoordinatesForPercent(startPercent);
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

            const pathData = [
              `M ${center} ${center}`,
              `L ${startX} ${startY}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`,
              'Z'
            ].join(' ');

            return (
              <path
                key={segment.label}
                d={pathData}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
                className="transition-all duration-300 hover:opacity-90"
                onMouseEnter={() => setSelectedSegment(segment)}
                onMouseLeave={() => setSelectedSegment(null)}
                style={{
                  animation: `fadeIn 0.5s ease-out ${index * 0.2}s forwards`,
                  opacity: 0
                }}
              />
            );
          })}
        </svg>
      </div>

      {/* Right-side legend */}
      <div className="flex flex-col gap-3">
        {segments.map((segment, index) => (
          <div
            key={segment.label}
            className={`flex items-center gap-3 p-2 rounded transition-all duration-300 ${
              selectedSegment?.label === segment.label ? 'bg-neutral-100 dark:bg-neutral-800' : ''
            }`}
          >
            <div
              className="w-4 h-4 rounded flex-shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{segment.label}</span>
                <span className="text-sm font-bold text-blue-500">{segment.value}%</span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {segment.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}; 