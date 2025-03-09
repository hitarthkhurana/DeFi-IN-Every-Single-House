export interface StrategyStep {
  type: 'hold' | 'stake' | 'lp' | 'swap';
  description: string;
  percentage: number;
  command: string;
}

export interface Strategy {
  title: string;
  steps: StrategyStep[];
}

export interface StrategyExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
} 