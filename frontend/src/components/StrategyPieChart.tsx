import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
    <div className={cn('relative flex items-start gap-8', className)}>
      {/* SVG Pie Chart */}
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
                stroke="hsl(var(--background))"
                strokeWidth="2"
                className={cn(
                  "transition-all duration-300 cursor-pointer",
                  selectedSegment?.label === segment.label && "filter brightness-110"
                )}
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

        {/* Center label */}
        {selectedSegment && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center bg-background/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
              <p className="font-bold text-lg">{selectedSegment.value}%</p>
              <p className="text-xs text-muted-foreground">{selectedSegment.label}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-3">
        {segments.map((segment) => (
          <Card
            key={segment.label}
            className={cn(
              "transition-all duration-300",
              selectedSegment?.label === segment.label && "bg-accent"
            )}
          >
            <div 
              className="flex items-start gap-3 p-3"
              onMouseEnter={() => setSelectedSegment(segment)}
              onMouseLeave={() => setSelectedSegment(null)}
            >
              <div
                className="w-4 h-4 rounded flex-shrink-0 mt-1"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">
                    {segment.label}
                  </span>
                  <Badge variant="secondary" className="shrink-0">
                    {segment.value}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {segment.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}; 