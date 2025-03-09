import React, { useState } from 'react';
import { StrategyPieChart } from './StrategyPieChart';
import { Strategy } from '../types/strategy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

// Define the strategy based on the moderate profile from chat
const DEFAULT_STRATEGY: Strategy = {
  title: "🟡 Moderate Flare DeFi Strategy",
  steps: [
    {
      type: 'stake',
      description: 'Stake FLR tokens for FTSO delegation',
      percentage: 40,
      command: 'stake {amount} FLR'
    },
    {
      type: 'lp',
      description: 'Provide liquidity in mixed pairs',
      percentage: 40,
      command: 'pool add {amount} FLR USDC.e'
    },
    {
      type: 'swap',
      description: 'Yield farming on Flare Finance',
      percentage: 20,
      command: 'swap {amount} FLR to FLX'
    }
  ]
};

interface StrategyVisualizerProps {
  onExecuteCommand?: (command: string) => void;
}

export const StrategyVisualizer: React.FC<StrategyVisualizerProps> = ({ onExecuteCommand }) => {
  const [showExecutor, setShowExecutor] = useState(false);
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [executing, setExecuting] = useState(false);

  const handleAmountSubmit = () => {
    if (amount && !isNaN(parseFloat(amount))) {
      setCurrentStep(0);
    }
  };

  const calculateStepAmount = (percentage: number): string => {
    const totalAmount = parseFloat(amount);
    if (isNaN(totalAmount)) return '0';
    return ((totalAmount * percentage) / 100).toFixed(2);
  };

  const executeStep = async (step: typeof DEFAULT_STRATEGY.steps[0]) => {
    setExecuting(true);
    try {
      const stepAmount = calculateStepAmount(step.percentage);
      const formattedCommand = step.command.replace('{amount}', stepAmount);
      onExecuteCommand?.(formattedCommand);
      setCurrentStep(prev => prev + 1);
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
            {DEFAULT_STRATEGY.steps.map((step, index) => (
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

  const isComplete = currentStep >= DEFAULT_STRATEGY.steps.length;
  const currentStepData = DEFAULT_STRATEGY.steps[currentStep];

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
                Step {currentStep + 1} of {DEFAULT_STRATEGY.steps.length}
              </p>
              <Badge variant="secondary">
                {Math.round((currentStep / DEFAULT_STRATEGY.steps.length) * 100)}% Complete
              </Badge>
            </div>

            <Progress 
              value={(currentStep / DEFAULT_STRATEGY.steps.length) * 100} 
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
                  segments={DEFAULT_STRATEGY.steps.map((step, index) => ({
                    label: step.type.toUpperCase(),
                    value: step.percentage,
                    description: step.description,
                    color: `var(--chart-${index + 1})`
                  }))}
                  className="animate-fadeIn"
                />
              </div>
              
              <div className="flex-1 text-left space-y-6">
                {DEFAULT_STRATEGY.steps.map((step, index) => (
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