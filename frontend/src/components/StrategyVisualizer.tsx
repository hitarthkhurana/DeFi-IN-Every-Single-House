import React, { useState, useEffect } from 'react';
import { StrategyPieChart } from './StrategyPieChart';
import { Strategy } from '../types/strategy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

const STRATEGIES: Record<string, Strategy> = {
  conservative: {
    title: "🔵 Conservative Flare DeFi Strategy",
    steps: [
      {
        type: 'stake',
        description: 'Stake FLR tokens for FTSO delegation',
        percentage: 35,
        command: 'stake {amount} FLR'
      },
      {
        type: 'lp',
        description: 'Provide liquidity in stablecoin pairs',
        percentage: 10,
        command: 'pool add {amount} WFLR USDC.E'
      },
      {
        type: 'hold',
        description: 'Hold native FLR',
        percentage: 40,
        command: 'hold {amount} FLR'
      },
      {
        type: 'swap',
        description: 'Yield farming on Flare Finance',
        percentage: 15,
        command: 'swap {amount} FLR to WFLR'
      }

    ]
  },
  moderate: {
    title: "🟡 Moderate Flare DeFi Strategy",
    steps: [
      {
        type: 'stake',
        description: 'Stake FLR tokens for FTSO delegation',
        percentage: 30,
        command: 'stake {amount} FLR'
      },
      {
        type: 'swap',
        description: 'Yield farming on Flare Finance',
        percentage: 25,
        command: 'swap {amount} FLR to WFLR'
      },
      {
        type: 'lp',
        description: 'Provide liquidity in mixed pairs',
        percentage: 20,
        command: 'pool add {amount} WFLR USDC.e'
      },
      {
        type: 'hold',
        description: 'Hold native FLR',
        percentage: 25,
        command: 'hold {amount} FLR'
      }
    ]
  },
  aggressive: {
    title: "🔴 Aggressive Flare DeFi Strategy",
    steps: [
      {
        type: 'stake',
        description: 'Stake FLR tokens for FTSO delegation',
        percentage: 20,
        command: 'stake {amount} FLR'
      },
      {
        type: 'swap',
        description: 'Active trading and yield farming',
        percentage: 35,
        command: 'swap {amount} FLR to FLX'
      },
      {
        type: 'lp',
        description: 'High-yield liquidity provision',
        percentage: 30,
        command: 'pool add {amount} FLX USDC.e'
      },
      {
        type: 'hold',
        description: 'Hold native FLR',
        percentage: 15,
        command: 'hold {amount} FLR'
      }
    ]
  }
};

interface StrategyVisualizerProps {
  onExecuteCommand?: (command: string) => void;
  strategyType?: 'conservative' | 'moderate' | 'aggressive';
  currentStepOverride?: number;
}

export const StrategyVisualizer: React.FC<StrategyVisualizerProps> = ({
  onExecuteCommand,
  strategyType = 'moderate',
  currentStepOverride = -1
}) => {
  const [showExecutor, setShowExecutor] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [executing, setExecuting] = useState(false);

  // Get the appropriate strategy based on the type
  const strategy = STRATEGIES[strategyType];

  // Update currentStep when currentStepOverride changes
  useEffect(() => {
    if (currentStepOverride >= -1) {
      setCurrentStep(currentStepOverride);
    }
  }, [currentStepOverride]);

  const handleAmountSubmit = () => {
    if (amount && !isNaN(parseFloat(amount))) {
      setCurrentStep(0);
      // When amount is submitted, execute the first step automatically
      const firstStep = strategy.steps[0];
      const stepAmount = calculateStepAmount(firstStep.percentage);
      const formattedCommand = firstStep.command.replace('{amount}', stepAmount);
      onExecuteCommand?.(formattedCommand);
    }
  };

  const calculateStepAmount = (percentage: number): string => {
    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount)) return '0';
    return ((totalAmount * percentage) / 100).toFixed(2);
  };

  const executeStep = async (step: typeof strategy.steps[0]) => {
    setExecuting(true);
    try {
      const stepAmount = calculateStepAmount(step.percentage);
      const formattedCommand = step.command.replace('{amount}', stepAmount);
      
      // Special handling for hold strategy type
      if (step.type === 'hold') {
        setCurrentStep(currentStep + 1); // Auto-advance for hold strategy
        return; // Skip command execution for pure hold strategy
      }
      
      onExecuteCommand?.(formattedCommand);
    } catch (error) {
      console.error('Error executing step:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (!showExecutor) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-center">Strategy Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {strategy.steps.map((step, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
                <div>
                  <p className="font-medium">{step.description}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {step.percentage}% allocation
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full" style={{
                  background: `conic-gradient(from 0deg, var(--chart-${index + 1}) ${step.percentage}%, transparent ${step.percentage}%)`
                }} />
              </div>
            ))}
          </div>

          <div className="flex justify-center mt-6">
            <Button
              onClick={() => setShowExecutor(true)}
              className="bg-gradient-to-r from-blue-500 to-emerald-400 text-white"
            >
              Execute Strategy
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === -1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Enter Investment Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                How much FLR would you like to invest in this strategy?
              </p>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount in FLR"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                This amount will be split according to the strategy allocation
              </p>
            </div>

            <Button
              onClick={handleAmountSubmit}
              disabled={!amount || isNaN(parseFloat(amount))}
              className="w-full bg-gradient-to-r from-blue-500 to-emerald-400"
            >
              Start Execution
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isComplete = currentStep >= strategy.steps.length;
  const currentStepData = strategy.steps[currentStep];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">
          {isComplete ? 'Strategy Execution Complete!' : 'Executing Strategy'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!isComplete && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="font-medium">
                Step {currentStep + 1} of {strategy.steps.length}
              </p>
              <Badge variant="secondary">
                {Math.round((currentStep / strategy.steps.length) * 100)}% Complete
              </Badge>
            </div>

            <Progress
              value={(currentStep / strategy.steps.length) * 100}
              className="h-2"
            />

            <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <p className="font-medium mb-2">{currentStepData.description}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
                Amount: {calculateStepAmount(currentStepData.percentage)} FLR
              </p>
              <p className="text-sm text-blue-500 mb-4">
                Press Execute to fill the command, then press Enter to confirm the transaction
              </p>
              <Button
                onClick={() => executeStep(currentStepData)}
                disabled={executing}
                className="w-full"
              >
                {executing ? 'Filling command...' : 'Execute Step'}
              </Button>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="text-center">
            <h3 className="text-2xl font-bold mb-8">Strategy Execution Complete!</h3>

            <div className="flex items-start justify-between gap-8 max-w-2xl mx-auto">
              <div className="flex-1">
                <StrategyPieChart
                  segments={strategy.steps.map((step, index) => ({
                    label: step.type.toUpperCase(),
                    value: step.percentage,
                    description: step.description,
                    color: `var(--chart-${index + 1})`
                  }))}
                  className="animate-fadeIn"
                />
              </div>

              <div className="flex-1 text-left space-y-6">
                {strategy.steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 mt-1.5 rounded-sm"
                      style={{ backgroundColor: `var(--chart-${index + 1})` }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{step.type.toUpperCase()}</span>
                        <span className="text-blue-500 font-bold">{step.percentage}%</span>
                      </div>
                      <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}; 