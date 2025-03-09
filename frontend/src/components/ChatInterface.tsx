import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Plus, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount, useWalletClient } from 'wagmi';
import { StrategyVisualizer } from './StrategyVisualizer';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Define interfaces
interface Message {
  text: string;
  type: 'user' | 'bot';
  imageData?: string;
  isTyping?: boolean;
}

interface MarkdownComponentProps {
  children: React.ReactNode;
  node?: any;
  inline?: boolean;
  className?: string;
  [key: string]: any;
}

interface RiskAssessmentState {
  isComplete: boolean;
  currentQuestion: number;
  answers: Record<string, string>;
  portfolioImage: string | null;
  portfolioAnalysis: string | null;
  strategyType: 'conservative' | 'moderate' | 'aggressive' | null;
  currentStrategyStep: number;
  strategyAmount: string;
}

interface QuestionOption {
  id: string;
  question: string;
  options: string[];
}

interface AnalysisResult {
  risk_score: number;
  text: string;
}

// Constants
const BACKEND_ROUTE = "http://localhost:8080/api/routes/chat/";

// Risk assessment questions (used only if no image is provided)
const RISK_QUESTIONS: QuestionOption[] = [
  {
    id: 'experience',
    question: 'What is your level of investment experience?',
    options: [
      'Beginner - New to investing',
      'Intermediate - Some experience with stocks/funds',
      'Advanced - Experienced with various investment types'
    ]
  },
  {
    id: 'timeline',
    question: 'What is your investment timeline?',
    options: [
      'Short-term (< 1 year)',
      'Medium-term (1-5 years)',
      'Long-term (5+ years)'
    ]
  },
  {
    id: 'risk_tolerance',
    question: 'How would you react to a 20% drop in your investment?',
    options: [
      'Sell immediately to prevent further losses',
      'Hold and wait for recovery',
      'Buy more to average down'
    ]
  }
];

// Strategy templates
const STRATEGY_TEMPLATES = {
  conservative: {
    title: "🔵 Conservative Flare DeFi Strategy",
    allocation: [
      "- Focus on FLR delegation to FTSO providers (5-8% APY)",
      "- Participate in SparkDEX liquidity pools with stablecoin pairs",
      "- Recommended allocation:",
      "  • 60% FLR delegation",
      "  • 30% stablecoin LP on SparkDEX",
      "  • 10% held in native FLR"
    ],
    transition: [
      "- Start with small positions in stablecoin pools",
      "- Focus on FTSO delegation for steady returns",
      "- Gradually explore SparkDEX's low-risk pairs"
    ]
  },
  moderate: {
    title: "🟡 Moderate Flare DeFi Strategy",
    allocation: [
      "- Mix of FTSO delegation and liquidity provision",
      "- Active participation in SparkDEX and Flare Finance",
      "- Recommended allocation:",
      "  • 40% FLR delegation",
      "  • 40% liquidity provision (mixed pairs)",
      "  • 20% yield farming on Flare Finance"
    ],
    transition: [
      "- Convert some stock positions to FLR",
      "- Explore yield farming with established protocols",
      "- Balance between delegation and LP rewards"
    ]
  },
  aggressive: {
    title: "🔴 Aggressive Flare DeFi Strategy",
    allocation: [
      "- Focus on high-yield opportunities in the Flare ecosystem",
      "- Active trading and yield farming",
      "- Recommended allocation:",
      "  • 30% FLR delegation",
      "- 40% yield farming on new protocols",
      "  • 30% active LP position management"
    ],
    transition: [
      "- Actively participate in new Flare protocols",
      "- Leverage your trading experience in DeFi",
      "- Explore advanced strategies across the ecosystem"
    ]
  }
};

// Utility functions
const formatRiskProfile = (strategyType: 'conservative' | 'moderate' | 'aggressive'): string => {
  const strategy = STRATEGY_TEMPLATES[strategyType];
  
  let profile = "Based on your assessment, here's your Flare DeFi investment profile:\n\n";
  
  profile += strategy.title + "\n\n" + 
    "Mix of FTSO delegation and liquidity provision\n\n" +
    "Active participation in SparkDEX and Flare Finance\n\n" +
    "Recommended allocation:\n" +
    strategy.allocation.join("\n") + "\n\n" +
    "💡 Transition Strategy from TradFi:\n" +
    strategy.transition.join("\n") + "\n\n" +
    "I've prepared a visual breakdown of this strategy below. You can click 'Execute Strategy' when you're ready to implement it step by step.\n\n" +
    "You can also continue chatting with me for specific recommendations about Flare protocols and how to implement this strategy!";
  
  return profile;
};

// File validation function
const validateFile = (file: File, maxSize: number = 4 * 1024 * 1024): string | null => {
  if (file.size > maxSize) {
    return "The image file is too large. Please upload an image smaller than 4MB.";
  }

  if (!file.type.startsWith('image/')) {
    return "Please upload a valid image file (JPEG, PNG, etc).";
  }

  return null; // No error
};

const ChatInterface: React.FC = () => {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [messages, setMessages] = useState<Message[]>([{
    text: "Hi! I'm your DeFi advisor. Let's start by understanding your investment profile. You can either answer a few questions or optionally upload your TradFi portfolio for a personalized recommendation.",
    type: 'bot',
    isTyping: true
  }]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<boolean>(false);
  const [pendingTransaction, setPendingTransaction] = useState<string | null>(null);
  const [selectedChatImage, setSelectedChatImage] = useState<File | null>(null);
  const [chatImagePreview, setChatImagePreview] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentState>({
    isComplete: false,
    currentQuestion: 0,
    answers: {},
    portfolioImage: null,
    portfolioAnalysis: null,
    strategyType: null,
    currentStrategyStep: -1,
    strategyAmount: ''
  });
  const [showStrategy, setShowStrategy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Process the welcome message typing effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages([{
        text: "Hi! I'm your DeFi advisor. Let's start by understanding your investment profile. You can either answer a few questions or optionally upload your TradFi portfolio for a personalized recommendation.",
        type: 'bot',
        isTyping: false
      }]);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      const chatContainer = messagesEndRef.current.parentElement;
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Add a message to the chat with typing effect
  const addMessage = (text: string, type: 'user' | 'bot', imageData?: string) => {
    if (type === 'bot') {
      // Add a placeholder message with typing indicator first
      setMessages(prev => [...prev, { text, type, imageData, isTyping: true }]);
      
      // After a delay, replace with the actual message
      setTimeout(() => {
        setMessages(prev => {
          const updatedMessages = [...prev];
          const lastIndex = updatedMessages.length - 1;
          updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], isTyping: false };
          return updatedMessages;
        });
      }, Math.min(text.length * 15, 3000)); // Scale with message length, but cap at 3 seconds
    } else {
      // User messages don't have typing effect
      setMessages(prev => [...prev, { text, type, imageData }]);
    }
  };

  // Modify generateRiskProfileFromScore to show strategy
  const generateRiskProfileFromScore = (risk_score: number): string => {
    setShowStrategy(true); // Show strategy after profile generation
    if (risk_score <= 4) {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'conservative' }));
      return formatRiskProfile('conservative');
    } else if (risk_score <= 7) {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'moderate' }));
      return formatRiskProfile('moderate');
    } else {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'aggressive' }));
      return formatRiskProfile('aggressive');
    }
  };

  // Modify generateRiskProfileFromQuiz to show strategy
  const generateRiskProfileFromQuiz = (answers: Record<string, string>): string => {
    // Simple risk scoring system based on quiz answers
    let riskScore = 0;
    
    // Experience scoring
    if (answers.experience?.includes('Beginner')) riskScore += 1;
    else if (answers.experience?.includes('Intermediate')) riskScore += 2;
    else if (answers.experience?.includes('Advanced')) riskScore += 3;
  
    // Timeline scoring
    if (answers.timeline?.includes('Short-term')) riskScore += 1;
    else if (answers.timeline?.includes('Medium-term')) riskScore += 2;
    else if (answers.timeline?.includes('Long-term')) riskScore += 3;
  
    // Risk tolerance scoring
    if (answers.risk_tolerance?.includes('Sell immediately')) riskScore += 1;
    else if (answers.risk_tolerance?.includes('Hold')) riskScore += 2;
    else if (answers.risk_tolerance?.includes('Buy more')) riskScore += 3;
  
    setShowStrategy(true); // Show strategy after profile generation
    if (riskScore <= 4) {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'conservative' }));
      return formatRiskProfile('conservative');
    } else if (riskScore <= 7) {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'moderate' }));
      return formatRiskProfile('moderate');
    } else {
      setRiskAssessment(prev => ({ ...prev, strategyType: 'aggressive' }));
      return formatRiskProfile('aggressive');
    }
  };

  // API call to analyze portfolio image
  const analyzePortfolioImage = async (imageData: string): Promise<AnalysisResult> => {
    const res = await fetch(imageData);
    const blob = await res.blob();
  
    const formData = new FormData();
    formData.append("message", "analyze-portfolio");
    formData.append("image", blob, "portfolio.jpg");
  
    const response = await fetch(BACKEND_ROUTE, {
      method: "POST",
      body: formData,
    });
  
    if (!response.ok) {
      throw new Error("Failed to analyze portfolio image");
    }
  
    return await response.json();
  };
  
  // Handle image upload for portfolio analysis
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file
    const errorMessage = validateFile(file);
    if (errorMessage) {
      addMessage(errorMessage, 'bot');
      return;
    }

    // Log file details for debugging
    console.log('Processing portfolio image:', {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)}KB`,
      lastModified: new Date(file.lastModified).toISOString()
    });
  
    const reader = new FileReader();
    
    reader.onloadend = async () => {
      const imageData = reader.result as string;
  
      setIsLoading(true);
      // Add analyzing message without typing effect
      setMessages(prev => [...prev, {
        text: "📊 Analyzing your TradFi portfolio to identify optimal transition paths to Flare DeFi...",
        type: 'bot',
        isTyping: false
      }]);
  
      try {
        const analysisResult = await analyzePortfolioImage(imageData);
        console.log("Portfolio analysis completed:", analysisResult);
  
        // Generate risk profile based on returned risk_score and analysis text
        const profile = generateRiskProfileFromScore(analysisResult.risk_score);
  
        // Update risk assessment state and mark assessment as complete
        setRiskAssessment(prev => ({
          ...prev,
          portfolioImage: imageData,
          portfolioAnalysis: analysisResult.text,
          isComplete: true
        }));
  
        // Update messages with analysis results - without typing effect
        setMessages(prev => [
          ...prev,
          { text: "📈 Portfolio Analysis Complete!", type: 'bot', isTyping: false },
          { text: analysisResult.text, type: 'bot', isTyping: false },
          { text: profile, type: 'bot', isTyping: false }
        ]);
      } catch (error) {
        console.error('Portfolio analysis failed:', error);
        setMessages(prev => [
          ...prev,
          { 
            text: "I apologize, but I couldn't analyze your portfolio image. Let's continue with the questions to understand your investment profile.",
            type: 'bot',
            isTyping: false
          },
          {
            text: RISK_QUESTIONS[0].question,
            type: 'bot',
            isTyping: false
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    };
  
    reader.onerror = (error) => {
      console.error('FileReader error:', error, reader.error);
      setMessages(prev => [
        ...prev,
        {
          text: "Sorry, I couldn't read your image file. Please try again or continue without the portfolio analysis.",
          type: 'bot',
          isTyping: false
        }
      ]);
      setIsLoading(false);
    };
  
    reader.readAsDataURL(file);
  };  

  // Handle chat image attachment
  const handleChatImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file
    const errorMessage = validateFile(file);
    if (errorMessage) {
      alert(errorMessage);
      return;
    }
  
    setSelectedChatImage(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setChatImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove selected chat image
  const removeChatImage = () => {
    setSelectedChatImage(null);
    setChatImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Trigger file input click
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  // Handle quiz answer selection
  const handleAnswerSelect = (answer: string) => {
    // Only allow quiz if no portfolio image was provided
    if (riskAssessment.portfolioImage) return;
    
    const currentQ = RISK_QUESTIONS[riskAssessment.currentQuestion];
    const newAnswers = { ...riskAssessment.answers, [currentQ.id]: answer };
  
    if (riskAssessment.currentQuestion === RISK_QUESTIONS.length - 1) {
      // Last question answered, generate profile
      const profile = generateRiskProfileFromQuiz(newAnswers);
      addMessage(answer, 'user');
      addMessage(profile, 'bot');
      
      setRiskAssessment(prev => ({
        ...prev,
        isComplete: true,
        answers: newAnswers
      }));
    } else {
      // Move to next question
      addMessage(answer, 'user');
      addMessage(RISK_QUESTIONS[riskAssessment.currentQuestion + 1].question, 'bot');
      
      setRiskAssessment(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
        answers: newAnswers
      }));
    }
  };

  // Skip the assessment
  const handleSkipAssessment = () => {
    setRiskAssessment(prev => ({
      ...prev,
      isComplete: true
    }));
    addMessage("Skipping risk assessment. You can always ask me about investment strategies later!", 'bot');
  };

  // Modify the sendMessageToAPI function to track strategy progress
  const sendMessageToAPI = async (text: string, imageFile: File | null): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append("walletAddress", address || "");
      
      if (imageFile) {
        formData.append("image", imageFile);
      }
  
      const response = await fetch(BACKEND_ROUTE, {
        method: "POST",
        body: formData,
      });
  
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
  
      const data = await response.json();
      console.log("Response from backend:", data);
  
      if ((data.transaction || data.transactions) && walletClient) {
        try {
          let txs = [];
          let descriptions = [];
          
          if (data.transaction) {
            txs = [data.transaction];
            descriptions = ["Transaction"];
          } else if (data.transactions) {
            const parsedTransactions = JSON.parse(data.transactions);
            console.log('Parsed transactions:', parsedTransactions);
            
            txs = parsedTransactions.map((t: any) => t.tx || t);
            descriptions = parsedTransactions.map((t: any, i: number) => 
              t.description || `Transaction ${i+1}`
            );
          }

          console.log('Transactions to process:', txs);
          console.log('Transaction descriptions:', descriptions);
          
          const txHashes = [];

          for (let i = 0; i < txs.length; i++) {
            const txData = txs[i];
            try {
              const parsedTx = typeof txData === 'string' ? JSON.parse(txData) : txData;
              console.log(`Processing ${descriptions[i]}:`, parsedTx);

              if (!parsedTx.to || parsedTx.to === 'null' || parsedTx.to === 'undefined') {
                throw new Error(`Invalid 'to' address in transaction: ${parsedTx.to}`);
              }

              const formattedTx = {
                to: parsedTx.to as `0x${string}`,
                data: parsedTx.data as `0x${string}`,
                value: BigInt(parsedTx.value || '0'),
                gas: BigInt(parsedTx.gas || '0'),
                ...(parsedTx.nonce ? { nonce: Number(parsedTx.nonce) } : {}),
                chainId: Number(parsedTx.chainId || '0')
              };

              const hash = await walletClient.sendTransaction(formattedTx);
              console.log(`${descriptions[i]} sent:`, hash);
              txHashes.push(hash);

              // After successful transaction, advance the strategy step if the message matches a strategy command
              if (text.toLowerCase().startsWith('stake') || 
                  text.toLowerCase().startsWith('pool') || 
                  text.toLowerCase().startsWith('swap') || 
                  text.toLowerCase().startsWith('hold')) {
                setRiskAssessment(prev => ({
                  ...prev,
                  currentStrategyStep: prev.currentStrategyStep === -1 ? prev.currentStrategyStep + 2 : prev.currentStrategyStep + 1
                }));
              }
              
              if (i < txs.length - 1) {
                setMessages(prev => [...prev, { 
                  text: `${descriptions[i]} sent! [View on Flarescan](https://flarescan.com/tx/${hash})\n\nPlease wait for it to be confirmed before the next transaction...`, 
                  type: 'bot' 
                }]);
                
                setIsLoading(true);
                setMessages(prev => [...prev, { 
                  text: `Waiting for ${descriptions[i]} to be confirmed...`, 
                  type: 'bot' 
                }]);
                
                try {
                  await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                      resolve(null);
                    }, 15000);
                    
                    const checkReceipt = async () => {
                      try {
                        const provider = await walletClient.getChainId().then(
                          chainId => walletClient.transport.getProvider({ chainId })
                        );
                        const receipt = await provider.getTransactionReceipt({ hash });
                        if (receipt) {
                          clearTimeout(timeout);
                          resolve(receipt);
                        } else {
                          setTimeout(checkReceipt, 2000);
                        }
                      } catch {
                        setTimeout(checkReceipt, 2000);
                      }
                    };
                    
                    checkReceipt();
                  });
                  
                  setMessages(prev => [...prev, { 
                    text: `${descriptions[i]} confirmed! Please confirm the next transaction...`, 
                    type: 'bot' 
                  }]);
                } catch (e) {
                  console.warn('Error waiting for transaction confirmation:', e);
                  setMessages(prev => [...prev, { 
                    text: `${descriptions[i]} may not be confirmed yet, but we'll proceed with the next transaction. Please confirm it now...`, 
                    type: 'bot' 
                  }]);
                }
                setIsLoading(false);
              }
            } catch (txError: any) {
              console.error(`Error in ${descriptions[i]}:`, txError);
              if (txError.message) {
                return `${data.response}\n\nError in ${descriptions[i]}: ${txError.message}\n\nPlease try again.`;
              }
              throw txError;
            }
          }
          
          return `${data.response}\n\nAll transactions completed successfully! ${txHashes.map((hash, i) => `\n${descriptions[i]}: [View on Flarescan](https://flarescan.com/tx/${hash})`).join('')}`;
        } catch (error: any) {
          console.error('Transaction error:', error);
          return `${data.response}\n\nError: ${error.message || 'Transaction was rejected or failed.'}`;
        }
      }
  
      return data.response;
    } catch (error) {
      console.error("Error:", error);
      return "Sorry, there was an error processing your request. Please try again.";
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedChatImage) || isLoading) return;
  
    const messageText = inputText.trim();
    const currentImage = selectedChatImage;
    
    // Create a message object for display
    addMessage(messageText, 'user', chatImagePreview || undefined);
    
    // Reset state
    setInputText('');
    setSelectedChatImage(null);
    setChatImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    setIsLoading(true);
  
    if (awaitingConfirmation) {
      if (messageText.toUpperCase() === 'CONFIRM') {
        setAwaitingConfirmation(false);
        const response = await sendMessageToAPI(pendingTransaction as string, null);
        addMessage(response, 'bot');
      } else {
        setAwaitingConfirmation(false);
        setPendingTransaction(null);
        addMessage('Transaction cancelled. How else can I help you?', 'bot');
      }
    } else {
      const response = await sendMessageToAPI(messageText, currentImage);
      addMessage(response, 'bot');
    }
  
    setIsLoading(false);
  };

  // Custom components for ReactMarkdown
  const MarkdownComponents: Record<string, React.FC<MarkdownComponentProps>> = {
    p: ({ children }) => <span className="inline">{children}</span>,
    code: ({ inline, children, ...props }) => (
      inline ?
        <code className="bg-neutral-200 dark:bg-neutral-800 rounded px-1 py-0.5 text-sm">{children}</code> :
        <pre className="bg-neutral-200 dark:bg-neutral-800 rounded p-2 my-2 overflow-x-auto">
          <code {...props} className="text-sm">{children}</code>
        </pre>
    ),
    a: ({ children, ...props }) => (
      <a {...props} className="text-blue-500 hover:underline">{children}</a>
    )
  };

  // Render typing indicator animation
  const renderTypingIndicator = () => (
    <div className="flex space-x-2">
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }} />
    </div>
  );

  // Create a new file: ChatInterface.module.css
  const styles = {
    fadeIn: `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `
  };

  // Render user interface
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
      {/* Header */}
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-lg"></div>
          <span className="text-xl font-bold text-neutral-900 dark:text-white">2DeFi</span>
        </div>
        <div className="flex items-center space-x-2">
          <appkit-button />
        </div>
      </nav>

      {/* Main chat container */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="bg-white dark:bg-neutral-800 shadow-xl border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <CardHeader className="bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
              </div>
              <CardTitle className="text-sm text-neutral-500 dark:text-neutral-400">DeFi Bridge Assistant</CardTitle>
              <div className="w-20"></div>
            </div>
          </CardHeader>
          
          <CardContent className="p-6 h-[65vh] overflow-y-auto scroll-smooth">
            <div className="space-y-6">
              {/* Message bubbles */}
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} items-start gap-3`}
                >
                  {message.type === 'bot' && (
                    <div className="flex-shrink-0">
                      <Avatar className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-emerald-400">
                        <AvatarFallback>
                          <MessageSquare className="w-4 h-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  
                  <div
                    className={`max-w-xs sm:max-w-2xl p-3 rounded-lg ${
                      message.type === 'user'
                        ? 'bg-blue-500 text-white rounded-tr-none'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-tl-none'
                    }`}
                  >
                    {message.isTyping ? (
                      renderTypingIndicator()
                    ) : (
                      <>
                        <ReactMarkdown
                          components={MarkdownComponents}
                          className="text-sm break-words whitespace-pre-wrap"
                        >
                          {message.text}
                        </ReactMarkdown>
                        
                        {message.imageData && (
                          <div className="mt-2">
                            <img 
                              src={message.imageData} 
                              alt="Attached" 
                              className="max-w-full rounded"
                              style={{ maxHeight: "200px" }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {message.type === 'user' && (
                    <div className="flex-shrink-0">
                      <Avatar className="w-8 h-8 bg-neutral-200 dark:bg-neutral-600">
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
              ))}

              {/* Portfolio upload option */}
              {!riskAssessment.isComplete && !riskAssessment.portfolioImage && !isLoading && (
                <div className="flex flex-col items-center gap-4 my-8 animate-fadeIn opacity-0" style={{ animation: 'fadeIn 0.5s ease 1s forwards' }}>
                  <Button 
                    variant="outline"
                    className="bg-gradient-to-tr from-blue-500/10 to-emerald-400/10 border border-white/10 hover:bg-gradient-to-tr hover:from-blue-500/20 hover:to-emerald-400/20 transition-all duration-200 px-6 py-4 rounded-2xl"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => handleImageUpload(e as any);
                      input.click();
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    <span>Upload Portfolio (Optional)</span>
                  </Button>
                  <Button
                    variant="link"
                    onClick={handleSkipAssessment}
                    className="text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
                  >
                    Skip Assessment
                  </Button>
                </div>
              )}
              
              {/* Risk assessment quiz options */}
              {!riskAssessment.isComplete && !riskAssessment.portfolioImage && !isLoading && (
                <div className="flex flex-col items-center gap-3 my-6 animate-fadeIn opacity-0" style={{ animation: 'fadeIn 0.5s ease 1.5s forwards' }}>
                  {RISK_QUESTIONS[riskAssessment.currentQuestion]?.options.map((option, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      onClick={() => handleAnswerSelect(option)}
                      className="w-full max-w-md bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 px-4 py-3 rounded-xl transition-colors text-left justify-start"
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start items-start gap-3">
                  <Avatar className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-emerald-400">
                    <AvatarFallback>
                      <MessageSquare className="w-4 h-4 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg rounded-tl-none">
                    {renderTypingIndicator()}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
          
          {/* Input form - Only show after risk assessment is complete */}
          {riskAssessment.isComplete && (
            <CardFooter className="bg-neutral-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700 p-4">
              <form onSubmit={handleSubmit} className="w-full">
                {/* Image preview if an image is selected */}
                {chatImagePreview && (
                  <div className="relative inline-block mb-3 ml-2">
                    <img 
                      src={chatImagePreview} 
                      alt="Upload preview" 
                      className="h-16 w-auto rounded border border-neutral-200 dark:border-neutral-700"
                    />
                    <Button
                      type="button"
                      onClick={removeChatImage}
                      size="sm"
                      variant="destructive"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                
                <div className="flex gap-2 items-center">
                  {/* Plus button for image upload */}
                  <Button
                    type="button"
                    onClick={openFileDialog}
                    variant="outline"
                    size="icon"
                    className="rounded-full h-10 w-10 bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700"
                    disabled={isLoading || !!selectedChatImage}
                  >
                    <Plus className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  </Button>
                  
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleChatImageSelect}
                    className="hidden"
                    disabled={isLoading}
                  />
                  
                  <Input
                    type="text"
                    value={inputText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                    placeholder={awaitingConfirmation 
                      ? "Type CONFIRM to proceed or anything else to cancel" 
                      : selectedChatImage 
                        ? "Add a message with your image..." 
                        : "Type your message... (Markdown supported)"
                    }
                    className="flex-1 h-10 px-4 rounded-full border-neutral-300 dark:border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-neutral-800 dark:text-white"
                    disabled={isLoading}
                  />
                  
                  <Button
                    type="submit"
                    disabled={isLoading || (!inputText.trim() && !selectedChatImage)}
                    className="rounded-full h-10 w-10 bg-gradient-to-tr from-blue-500 to-emerald-400 hover:opacity-90 p-0"
                  >
                    <Send className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </form>
            </CardFooter>
          )}
        </Card>
        
        {/* Additional info card */}
        {riskAssessment.isComplete && (
          <div className="mt-6">
            <Card className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-neutral-200 dark:border-neutral-700">
              <CardContent className="p-4">
                {showStrategy && (
                  <StrategyVisualizer 
                    strategyType={riskAssessment.strategyType || 'moderate'}
                    currentStepOverride={riskAssessment.currentStrategyStep}
                    onExecuteCommand={(command) => {
                      setInputText(command);
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (input) {
                        input.focus();
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      
      {/* Floating gradient orbs for background effect */}
      <div className="fixed -top-20 -left-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="fixed top-1/3 -right-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl"></div>
      <div className="fixed bottom-20 left-1/4 w-40 h-40 bg-pink-500/10 rounded-full blur-3xl"></div>
      
      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-neutral-200 dark:border-neutral-800">
        <div className="container mx-auto px-4 text-center text-neutral-500 dark:text-neutral-400 text-sm">
          Made with ❤️ by Alex and Hitarth
        </div>
      </footer>
      
      <style>{styles.fadeIn}</style>
    </div>
  );
};

export default ChatInterface;
