import { StrategyStep } from '../types/strategy';

export class StrategyService {

  private walletAddress: string;

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress;
  }

  async executeStrategyStep(step: StrategyStep, amount: number): Promise<boolean> {
    try {
      switch (step.type) {
        case 'hold':
          // No action needed for holding
          return true;

        case 'stake':
          return await this.executeStakeStep(amount);

        case 'lp':
          return await this.executeLPStep(amount);

        case 'swap':
          return await this.executeSwapStep(amount);

        default:
          throw new Error('Unknown strategy step type');
      }
    } catch (error) {
      console.error('Error executing strategy step:', error);
      throw error;
    }
  }

  private async executeStakeStep(amount: number): Promise<boolean> {
    try {
      const response = await fetch('/api/stake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          walletAddress: this.walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute stake transaction');
      }

     
      // Here you would typically wait for transaction confirmation
      return true;
    } catch (error) {
      console.error('Stake error:', error);
      throw error;
    }
  }

  private async executeLPStep(amount: number): Promise<boolean> {
    try {
      const response = await fetch('/api/add-liquidity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          walletAddress: this.walletAddress,
          pair: 'FLR-USDC.e', // Default to FLR-USDC.e pair
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute LP transaction');
      }

      
      // Here you would typically wait for transaction confirmation
      return true;
    } catch (error) {
      console.error('LP error:', error);
      throw error;
    }
  }

  private async executeSwapStep(amount: number): Promise<boolean> {
    try {
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          fromToken: 'FLR',
          toToken: 'FLX', // Default to FLX
          walletAddress: this.walletAddress,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute swap transaction');
      }

   
      // Here you would typically wait for transaction confirmation
      return true;
    } catch (error) {
      console.error('Swap error:', error);
      throw error;
    }
  }
} 