import React, { useState, ChangeEvent } from 'react';
import { LinearProgress, Button, TextField, Box, Typography } from '@mui/material';

interface StrategyStep {
  type: 'hold' | 'stake' | 'lp' | 'swap';
  description: string;
  percentage: number;
  command: string;
}

interface Strategy {
  title: string;
  steps: StrategyStep[];
}

interface StrategyExecutorProps {
  strategy: Strategy;
  onComplete: () => void;
}

export const StrategyExecutor: React.FC<StrategyExecutorProps> = ({ strategy, onComplete }) => {
  const [amount, setAmount] = useState<string>('');
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAmountSubmit = () => {
    if (!amount || isNaN(parseFloat(amount))) return;
    setCurrentStep(0);
  };

  const calculateStepAmount = (step: StrategyStep) => {
    const baseAmount = parseFloat(amount);
    return (baseAmount * step.percentage / 100).toFixed(2);
  };

  const executeStep = async (step: StrategyStep) => {
    setExecuting(true);
    // Here we'll format the command with the actual amount
    const formattedCommand = step.command.replace('{amount}', calculateStepAmount(step));
    
    try {
      // In a real implementation, this would call your blockchain interaction functions
      // For now, we'll simulate the execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Move to next step
      setCurrentStep(prev => prev + 1);
      setProgress((currentStep + 1) / strategy.steps.length * 100);
    } catch (error) {
      console.error('Error executing step:', error);
    } finally {
      setExecuting(false);
    }
  };

  if (currentStep === -1) {
    return (
      <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h6" gutterBottom>
          {strategy.title}
        </Typography>
        <Typography variant="body1" gutterBottom>
          Please enter the total amount of FLR to invest:
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <TextField
            type="number"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            label="Amount in FLR"
            variant="outlined"
            fullWidth
          />
          <Button
            variant="contained"
            onClick={handleAmountSubmit}
            disabled={!amount || isNaN(parseFloat(amount))}
          >
            Start
          </Button>
        </Box>
      </Box>
    );
  }

  const currentStepData = strategy.steps[currentStep];
  const isComplete = currentStep >= strategy.steps.length;

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Executing Strategy
      </Typography>
      
      <LinearProgress 
        variant="determinate" 
        value={progress} 
        sx={{ mb: 3, height: 8, borderRadius: 4 }}
      />

      {isComplete ? (
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h6" color="success.main" gutterBottom>
            Strategy Execution Complete!
          </Typography>
          <Button variant="contained" onClick={onComplete}>
            Done
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Step {currentStep + 1} of {strategy.steps.length}:
          </Typography>
          <Typography variant="body1" gutterBottom>
            {currentStepData.description}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Amount: {calculateStepAmount(currentStepData)} FLR
          </Typography>
          <Button
            variant="contained"
            onClick={() => executeStep(currentStepData)}
            disabled={executing}
            sx={{ mt: 2 }}
          >
            {executing ? 'Executing...' : 'Execute Step'}
          </Button>
        </Box>
      )}
    </Box>
  );
}; 