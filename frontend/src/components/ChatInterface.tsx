import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Plus, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount, useWalletClient } from 'wagmi';
import { PriceFeeds } from './PriceFeeds';

// Define interfaces
interface Message {
  text: string;
  type: 'user' | 'bot';
  imageData?: string;
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
      "  • 40% yield farming on new protocols",
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
  
  profile += strategy.title + "\n" + 
    strategy.allocation.join("\n") + "\n\n" +
    "💡 Transition Strategy from TradFi:\n" +
    strategy.transition.join("\n") + "\n\n";
  
  profile += "You can now continue chatting with me for specific recommendations about Flare protocols and how to implement this strategy!";
  
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
    text: "Hi! I'm Artemis, your DeFi advisor. Let's start by understanding your investment profile. You can either answer a few questions or optionally upload your TradFi portfolio for a personalized recommendation.",
    type: 'bot'
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

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add a message to the chat
  const addMessage = (text: string, type: 'user' | 'bot', imageData?: string) => {
    setMessages(prev => [...prev, { text, type, imageData }]);
  };

  // Connection status component
  const ConnectionStatus = () => {
    if (isConnected && address) {
      return (
        <div className="text-sm text-green-600 mb-2">
          Connected: {address.slice(0, 6)}...{address.slice(-4)}
        </div>
      );
    }
    return (
      <div className="text-sm text-red-600 mb-2">
        Not connected - Please connect your wallet
      </div>
    );
  };

  // Generate risk profile based on portfolio risk_score
  const generateRiskProfileFromScore = (risk_score: number): string => {
    if (risk_score <= 4) {
      return formatRiskProfile('conservative');
    } else if (risk_score <= 7) {
      return formatRiskProfile('moderate');
    } else {
      return formatRiskProfile('aggressive');
    }
  };

  // Generate risk profile based on quiz answers
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
      addMessage("📊 Analyzing your TradFi portfolio to identify optimal transition paths to Flare DeFi...", 'bot');
  
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
  
        addMessage("📈 Portfolio Analysis Complete!", 'bot');
        addMessage(analysisResult.text, 'bot');
        addMessage(profile, 'bot');
      } catch (error) {
        console.error('Portfolio analysis failed:', error);
        addMessage("I apologize, but I couldn't analyze your portfolio image. Let's continue with the questions to understand your investment profile.", 'bot');
        addMessage(RISK_QUESTIONS[0].question, 'bot');
      } finally {
        setIsLoading(false);
      }
    };
  
    reader.onerror = (error) => {
      console.error('FileReader error:', error, reader.error);
      addMessage("Sorry, I couldn't read your image file. Please try again or continue without the portfolio analysis.", 'bot');
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
        <code className="bg-gray-200 rounded px-1 py-0.5 text-sm">{children}</code> :
        <pre className="bg-gray-200 rounded p-2 my-2 overflow-x-auto">
          <code {...props} className="text-sm">{children}</code>
        </pre>
    ),
    a: ({ children, ...props }) => (
      <a {...props} className="text-pink-600 hover:underline">{children}</a>
    )
  };

  // Render user interface
  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full shadow-lg bg-white">
        {/* Header */}
        <div className="bg-pink-600 text-white p-4">
          <h1 className="text-xl font-bold">Artemis</h1>
          <p className="text-sm opacity-80">DeFAI Copilot for Flare (gemini-2.0-flash)</p>
          <ConnectionStatus />
        </div>
  
        {/* Messages container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Message bubbles */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white font-bold mr-2">
                  A
                </div>
              )}
              <div
                className={`max-w-xs px-4 py-2 rounded-xl ${message.type === 'user'
                    ? 'bg-pink-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
              >
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
              </div>
              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold ml-2">
                  U
                </div>
              )}
            </div>
          ))}

          {/* Portfolio upload option */}
          {!riskAssessment.isComplete && !riskAssessment.portfolioImage && (
            <div className="flex flex-col items-center gap-4">
              <label className="cursor-pointer bg-pink-100 hover:bg-pink-200 text-pink-600 px-4 py-2 rounded-full transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <span>Upload Portfolio (Optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleSkipAssessment}
                className="text-gray-500 hover:text-gray-700 text-sm underline"
              >
                Skip Assessment
              </button>
            </div>
          )}
          
          {/* Risk assessment quiz options */}
          {!riskAssessment.isComplete && !riskAssessment.portfolioImage && (
            <div className="flex flex-col items-center gap-2">
              {RISK_QUESTIONS[riskAssessment.currentQuestion]?.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswerSelect(option)}
                  className="w-full max-w-xs bg-pink-50 hover:bg-pink-100 text-pink-600 px-4 py-2 rounded-lg transition-colors text-left"
                >
                  {option}
                </button>
              ))}
            </div>
          )}
          
          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-pink-600 flex items-center justify-center text-white font-bold mr-2">
                A
              </div>
              <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-xl rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
  
        {/* Input form - Only show after risk assessment is complete */}
        {riskAssessment.isComplete && (
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
              {/* Image preview if an image is selected */}
              {chatImagePreview && (
                <div className="relative inline-block mb-2 ml-2">
                  <img 
                    src={chatImagePreview} 
                    alt="Upload preview" 
                    className="h-16 w-auto rounded border border-gray-300"
                  />
                  <button
                    type="button"
                    onClick={removeChatImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    aria-label="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              
              <div className="flex space-x-2">
                {/* Plus button for image upload */}
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-400"
                  disabled={isLoading || !!selectedChatImage}
                >
                  <Plus className="w-5 h-5" />
                </button>
                
                {/* Hidden file input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleChatImageSelect}
                  className="hidden"
                  disabled={isLoading}
                />
                
                <input
                  type="text"
                  value={inputText}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                  placeholder={awaitingConfirmation 
                    ? "Type CONFIRM to proceed or anything else to cancel" 
                    : selectedChatImage 
                      ? "Add a message with your image..." 
                      : "Type your message... (Markdown supported)"
                  }
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  disabled={isLoading}
                />
                
                <button
                  type="submit"
                  disabled={isLoading || (!inputText.trim() && !selectedChatImage)}
                  className="bg-pink-600 text-white p-2 rounded-full hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
