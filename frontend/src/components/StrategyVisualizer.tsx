import React, { useState } from 'react';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';
import { Strategy } from '../types/strategy';
import { StrategyPieChart } from './StrategyPieChart';

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
      command: 'add_liquidity {amount} FLR-USDC.e'
    },
    {
      type: 'swap',
      description: 'Yield farming on Flare Finance',
      percentage: 20,
      command: 'swap {amount} FLR FLX'
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
    if (!amount || isNaN(parseFloat(amount))) return;
    setCurrentStep(0);
  };

  const calculateStepAmount = (percentage: number) => {
    const baseAmount = parseFloat(amount);
    return (baseAmount * percentage / 100).toFixed(2);
  };

  const executeStep = async (step: typeof DEFAULT_STRATEGY.steps[0]) => {
    setExecuting(true);
    try {
      const stepAmount = calculateStepAmount(step.percentage);
      const command = step.command.replace('{amount}', stepAmount);
      
      // Call the parent's onExecuteCommand function to fill the chat input
      if (onExecuteCommand) {
        onExecuteCommand(command);
      }
      
      // Move to next step after a short delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentStep(prev => prev + 1);
    } catch (error) {
      console.error('Error executing step:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (!showExecutor) {
    return (
      <Card className="w-full bg-white/95 dark:bg-neutral-800/95 rounded-lg backdrop-blur-sm">
        <CardContent>
          <Typography variant="h6" className="text-center mb-4">
            Strategy Breakdown
          </Typography>
          
          <div className="space-y-4">
            {DEFAULT_STRATEGY.steps.map((step, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                <div>
                  <Typography variant="subtitle1">{step.description}</Typography>
                  <Typography variant="body2" color="textSecondary">
                    {step.percentage}% allocation
                  </Typography>
                </div>
                <div className="h-12 w-12 rounded-full" style={{
                  background: `conic-gradient(from 0deg, var(--chart-${index + 1}) ${step.percentage}%, transparent ${step.percentage}%)`
                }} />
              </div>
            ))}
          </div>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="contained"
              onClick={() => setShowExecutor(true)}
              sx={{
                background: 'linear-gradient(45deg, #2196F3 30%, #4CAF50 90%)',
                color: 'white',
                px: 4,
                py: 1.5,
                borderRadius: 2
              }}
            >
              Execute Strategy
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (currentStep === -1) {
    return (
      <Card className="w-full bg-white/95 dark:bg-neutral-800/95 rounded-lg backdrop-blur-sm">
        <CardContent>
          <Typography variant="h6" className="text-center mb-4">
            Enter Investment Amount
          </Typography>
          
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Typography variant="body1">
                How much FLR would you like to invest in this strategy?
              </Typography>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount in FLR"
                className="w-full p-3 rounded-lg border border-neutral-200 dark:border-neutral-600"
              />
              <Typography variant="body2" color="textSecondary">
                This amount will be split according to the strategy allocation
              </Typography>
            </div>

            <Button
              variant="contained"
              onClick={handleAmountSubmit}
              disabled={!amount || isNaN(parseFloat(amount))}
              fullWidth
              sx={{
                mt: 2,
                background: 'linear-gradient(45deg, #2196F3 30%, #4CAF50 90%)',
                color: 'white'
              }}
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
    <Card className="w-full bg-white/95 dark:bg-neutral-800/95 rounded-lg backdrop-blur-sm">
      <CardContent>
        <Typography variant="h6" className="text-center mb-4">
          {isComplete ? 'Strategy Execution Complete!' : 'Executing Strategy'}
        </Typography>

        {!isComplete && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Typography variant="subtitle1">
                Step {currentStep + 1} of {DEFAULT_STRATEGY.steps.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {Math.round((currentStep / DEFAULT_STRATEGY.steps.length) * 100)}% Complete
              </Typography>
            </div>

            <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${(currentStep / DEFAULT_STRATEGY.steps.length) * 100}%` }}
              />
            </div>

            <div className="p-4 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
              <Typography variant="subtitle1" gutterBottom>
                {currentStepData.description}
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Amount: {calculateStepAmount(currentStepData.percentage)} FLR
              </Typography>
              <Typography variant="body2" color="info" className="mb-2">
                Press Execute to fill the command, then press Enter to confirm the transaction
              </Typography>
              <Button
                variant="contained"
                onClick={() => executeStep(currentStepData)}
                disabled={executing}
                fullWidth
                sx={{ mt: 2 }}
              >
                {executing ? 'Filling command...' : 'Execute Step'}
              </Button>
            </div>
          </div>
        )}

        {isComplete && (
          <div className="text-center">
            <Typography variant="h4" className="mb-8 font-bold">
              Strategy Execution Complete!
            </Typography>
            
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
                    <div className="w-3 h-3 mt-1.5 rounded-sm" style={{ 
                      backgroundColor: `var(--chart-${index + 1})` 
                    }} />
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