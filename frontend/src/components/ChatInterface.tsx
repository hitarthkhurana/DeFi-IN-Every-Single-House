import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Plus, X, BarChart, ShieldCheck, MessageSquare, ChevronDown, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount, useWalletClient } from 'wagmi';
import { PriceFeeds } from './PriceFeeds';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

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

// @ts-expect-error - Will be used later
const useTypingEffect = (text: string, typingSpeed = 50, startDelay = 0) => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let charIndex = 0;

    if (text) {
      setDisplayText('');
      setIsTyping(true);
      setIsDone(false);

      timer = setTimeout(() => {
        const typingInterval = setInterval(() => {
          if (charIndex < text.length) {
            setDisplayText(text.substring(0, charIndex + 1));
            charIndex++;
          } else {
            clearInterval(typingInterval);
            setIsTyping(false);
            setIsDone(true);
          }
        }, typingSpeed);

        return () => clearInterval(typingInterval);
      }, startDelay);
    }

    return () => clearTimeout(timer);
  }, [text, typingSpeed, startDelay]);

  return { displayText, isTyping, isDone };
};

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
  const { address, isConnected } = useAccount();
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
    portfolioAnalysis: null
  });
  const [showStrategy, setShowStrategy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Quick action buttons
  const quickActions = [
    { text: "Check my balance", action: () => handleQuickAction("Check my balance") },
    { text: "Stake 0.1 FLR", action: () => handleQuickAction("stake 0.1 FLR") },
    { text: "Swap 0.1 FLR to USDC.e", action: () => handleQuickAction("Swap 0.1 FLR to USDC.e") },
    { text: "Swap 1 FLR to USDC.e", action: () => handleQuickAction("Swap 1 FLR to USDC.e") },
    { text: "Swap 0.5 FLR to USDT", action: () => handleQuickAction("Swap 0.5 FLR to USDT") },
    { text: "Swap 0.1 FLR to FLX", action: () => handleQuickAction("Swap 0.1 FLR to FLX") },
    { text: "Swap 0.1 FLX to FLR", action: () => handleQuickAction("Swap 0.1 FLX to FLR") },
  ];
  
  // Function to handle quick action button clicks
  const handleQuickAction = (text: string) => {
    setInputText(text);
    // Automatically submit the form after a short delay to allow state update
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
        form.dispatchEvent(submitEvent);
      }
    }, 100);
  };
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
      return formatRiskProfile('conservative');
    } else if (risk_score <= 7) {
      return formatRiskProfile('moderate');
    } else {
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
      return formatRiskProfile('conservative');
    } else if (riskScore <= 7) {
      return formatRiskProfile('moderate');
    } else {
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

  // Send message to backend API
  const sendMessageToAPI = async (text: string, imageFile: File | null): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append("walletAddress", address || "");
      
      // If there's an image, append it to the form data
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
  
      // If there's a transaction to sign
      if (data.transaction && walletClient) {
        try {
          const txData =
            typeof data.transaction === "string"
              ? JSON.parse(data.transaction)
              : data.transaction;
          const formattedTx = {
            to: txData.to as `0x${string}`,
            data: txData.data as `0x${string}`,
            value: BigInt(txData.value),
            gas: BigInt(txData.gas),
            nonce: Number(txData.nonce),
            chainId: Number(txData.chainId),
          };
  
          const hash = await walletClient.sendTransaction(formattedTx);
          return `${data.response}\n\nTransaction sent! Hash: ${hash}`;
        } catch (error: any) {
          console.error("Transaction error:", error);
          return `${data.response}\n\nError: ${error.message || "Transaction was rejected or failed."}`;
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
          <span className="text-xl font-bold text-neutral-900 dark:text-white">DINESH AI</span>
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
                    className={`max-w-xs p-3 rounded-lg ${
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

              {/* Show strategy visualization after risk assessment */}
              {showStrategy && riskAssessment.isComplete && (
                <div className="my-8 w-full max-w-2xl mx-auto bg-white/95 dark:bg-neutral-800/95 rounded-lg shadow-lg animate-fadeIn">
                  <StrategyVisualizer 
                    onExecuteCommand={(command) => {
                      setInputText(command);
                      // Focus the input
                      const input = document.querySelector('input[type="text"]') as HTMLInputElement;
                      if (input) {
                        input.focus();
                        // Scroll to the input
                        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                  />
                </div>
              )}

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
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-neutral-200 dark:border-neutral-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <BarChart className="w-4 h-4 mr-2 text-blue-500" />
                  Portfolio Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Ask for detailed portfolio analysis and optimization suggestions
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-neutral-200 dark:border-neutral-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" />
                  Security Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Learn about best practices for securing your DeFi investments
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm border-neutral-200 dark:border-neutral-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <ArrowRight className="w-4 h-4 mr-2 text-pink-500" />
                  Strategy Guide
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  Ask for step-by-step migration plans from TradFi to DeFi
                </p>
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
