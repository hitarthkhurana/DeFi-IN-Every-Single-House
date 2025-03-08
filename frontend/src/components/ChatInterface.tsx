import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAccount, useWalletClient } from 'wagmi';

// Define interfaces
interface Message {
  text: string;
  type: 'user' | 'bot';
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

const BACKEND_ROUTE = "http://localhost:8080/api/routes/chat/";

// Risk assessment questions
const RISK_QUESTIONS = [
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

const ChatInterface: React.FC = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [messages, setMessages] = useState<Message[]>([{
    text: "Hi! I'm Artemis, your DeFi advisor. Let's start by understanding your investment profile through a few questions. You can optionally upload your TradFi portfolio for a more personalized recommendation.",
    type: 'bot'
  }]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<boolean>(false);
  const [pendingTransaction, setPendingTransaction] = useState<string | null>(null);
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessmentState>({
    isComplete: false,
    currentQuestion: 0,
    answers: {},
    portfolioImage: null,
    portfolioAnalysis: null
  });
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add connection status display
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

  const analyzePortfolioImage = async (imageData: string): Promise<string> => {
    try {
      // Remove the data URL prefix to get just the base64 data
      const base64Image = imageData.split(',')[1];
      
      const response = await fetch(BACKEND_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: "Analyze this portfolio for DeFi transition opportunities",
          content_type: "conversational",
          context: {
            portfolioAnalysis: true,
            userProfile: "new_user",
            transitionType: "tradfi_to_defi"
          },
          image_data: {
            mime_type: "image/jpeg",
            data: base64Image
          },
          walletAddress: address || null
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze portfolio image');
      }

      const data = await response.json();
      console.log('Portfolio Analysis:', {
        status: response.status,
        data: data,
        responseType: typeof data.response,
        responsePreview: data.response?.substring(0, 100)
      });

      if (!data.response) {
        throw new Error('No analysis received from the server');
      }

      return data.response;
    } catch (error) {
      console.error('Error analyzing portfolio:', error);
      return 'I am sorry but I cannot directly process images. Please provide me with the relevant data instead.';
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size and type
      if (file.size > 4 * 1024 * 1024) {
        setMessages(prev => [...prev, 
          { text: "The image file is too large. Please upload an image smaller than 4MB.", type: 'bot' }
        ]);
        return;
      }

      if (!file.type.startsWith('image/')) {
        setMessages(prev => [...prev, 
          { text: "Please upload a valid image file (JPEG, PNG, etc).", type: 'bot' }
        ]);
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
        setMessages(prev => [...prev, 
          { text: "📊 Analyzing your TradFi portfolio to identify optimal transition paths to Flare DeFi...", type: 'bot' }
        ]);

        try {
          const analysis = await analyzePortfolioImage(imageData);
          
          // Log successful analysis
          console.log('Portfolio analysis completed:', {
            analysisLength: analysis.length,
            preview: analysis.substring(0, 100) + '...'
          });

          setRiskAssessment(prev => ({
            ...prev,
            portfolioImage: imageData,
            portfolioAnalysis: analysis
          }));
          
          setMessages(prev => [...prev, 
            { 
              text: "📈 Portfolio Analysis Complete!\n\n" + 
                    analysis + 
                    "\n\nNow, I'll ask a few questions to better understand your goals and create a personalized Flare DeFi strategy that aligns with your current portfolio.", 
              type: 'bot' 
            },
            { text: RISK_QUESTIONS[0].question, type: 'bot' }
          ]);
        } catch (error) {
          console.error('Portfolio analysis failed:', error);
          setMessages(prev => [...prev, 
            { text: "I apologize, but I couldn't analyze your portfolio image. Let's continue with the questions to understand your investment profile.", type: 'bot' },
            { text: RISK_QUESTIONS[0].question, type: 'bot' }
          ]);
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = (error) => {
        console.error('FileReader error:', error, reader.error);
        setMessages(prev => [...prev, 
          { text: "Sorry, I couldn't read your image file. Please try again or continue without the portfolio analysis.", type: 'bot' }
        ]);
        setIsLoading(false);
      };

      reader.readAsDataURL(file);
    }
  };

  const generateRiskProfile = (answers: Record<string, string>, portfolioImage: string | null, portfolioAnalysis: string | null): string => {
    // Simple risk scoring system
    let riskScore = 0;
    
    // Score based on experience
    if (answers.experience?.includes('Beginner')) riskScore += 1;
    else if (answers.experience?.includes('Intermediate')) riskScore += 2;
    else if (answers.experience?.includes('Advanced')) riskScore += 3;
    
    // Score based on timeline
    if (answers.timeline?.includes('Short-term')) riskScore += 1;
    else if (answers.timeline?.includes('Medium-term')) riskScore += 2;
    else if (answers.timeline?.includes('Long-term')) riskScore += 3;
    
    // Score based on risk tolerance
    if (answers.risk_tolerance?.includes('Sell immediately')) riskScore += 1;
    else if (answers.risk_tolerance?.includes('Hold')) riskScore += 2;
    else if (answers.risk_tolerance?.includes('Buy more')) riskScore += 3;
    
    // Generate profile text
    let profile = "Based on your responses";
    if (portfolioAnalysis) {
      profile += " and portfolio analysis";
    }
    profile += ", here's your Flare DeFi investment profile:\n\n";
    
    // Add portfolio analysis summary if available
    if (portfolioAnalysis) {
      profile += "📊 Current Portfolio Analysis:\n" + portfolioAnalysis + "\n\n";
    }
    
    if (riskScore <= 4) {
      profile += "🔵 Conservative Flare DeFi Strategy\n" +
                "- Focus on FLR delegation to FTSO providers (5-8% APY)\n" +
                "- Participate in SparkDEX liquidity pools with stablecoin pairs\n" +
                "- Recommended allocation:\n" +
                "  • 60% FLR delegation\n" +
                "  • 30% stablecoin LP on SparkDEX\n" +
                "  • 10% held in native FLR\n\n" +
                "💡 Transition Strategy from TradFi:\n" +
                "- Start with small positions in stablecoin pools\n" +
                "- Focus on FTSO delegation for steady returns\n" +
                "- Gradually explore SparkDEX's low-risk pairs\n\n";
    } else if (riskScore <= 7) {
      profile += "🟡 Moderate Flare DeFi Strategy\n" +
                "- Mix of FTSO delegation and liquidity provision\n" +
                "- Active participation in SparkDEX and Flare Finance\n" +
                "- Recommended allocation:\n" +
                "  • 40% FLR delegation\n" +
                "  • 40% liquidity provision (mixed pairs)\n" +
                "  • 20% yield farming on Flare Finance\n\n" +
                "💡 Transition Strategy from TradFi:\n" +
                "- Convert some stock positions to FLR\n" +
                "- Explore yield farming with established protocols\n" +
                "- Balance between delegation and LP rewards\n\n";
    } else {
      profile += "🔴 Aggressive Flare DeFi Strategy\n" +
                "- Focus on high-yield opportunities in the Flare ecosystem\n" +
                "- Active trading and yield farming\n" +
                "- Recommended allocation:\n" +
                "  • 30% FLR delegation\n" +
                "  • 40% yield farming on new protocols\n" +
                "  • 30% active LP position management\n\n" +
                "💡 Transition Strategy from TradFi:\n" +
                "- Actively participate in new Flare protocols\n" +
                "- Leverage your trading experience in DeFi\n" +
                "- Explore advanced strategies across the ecosystem\n\n";
    }
    
    profile += "You can now continue chatting with me for specific recommendations about Flare protocols and how to implement this strategy!";
    
    return profile;
  };

  const handleAnswerSelect = (answer: string) => {
    const currentQ = RISK_QUESTIONS[riskAssessment.currentQuestion];
    const newAnswers = { ...riskAssessment.answers, [currentQ.id]: answer };
    
    if (riskAssessment.currentQuestion === RISK_QUESTIONS.length - 1) {
      // Last question answered, generate profile
      const profile = generateRiskProfile(newAnswers, riskAssessment.portfolioImage, riskAssessment.portfolioAnalysis);
      setMessages(prev => [...prev, 
        { text: answer, type: 'user' },
        { text: profile, type: 'bot' }
      ]);
      setRiskAssessment(prev => ({
        ...prev,
        isComplete: true,
        answers: newAnswers
      }));
    } else {
      // Move to next question
      setMessages(prev => [...prev, 
        { text: answer, type: 'user' },
        { text: RISK_QUESTIONS[riskAssessment.currentQuestion + 1].question, type: 'bot' }
      ]);
      setRiskAssessment(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1,
        answers: newAnswers
      }));
    }
  };

  const handleSkipAssessment = () => {
    setRiskAssessment(prev => ({
      ...prev,
      isComplete: true
    }));
    setMessages(prev => [...prev, 
      { text: "Skipping risk assessment. You can always ask me about investment strategies later!", type: 'bot' }
    ]);
  };

  const handleSendMessage = async (text: string): Promise<string> => {
    try {
      const response = await fetch(BACKEND_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: text,
          walletAddress: address || null
        }),
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const data = await response.json();
      console.log('Response from backend:', data); // Debug log
      
      // If there's a transaction to sign
      if (data.transaction && walletClient) {
        try {
          // Parse and format transaction data
          const txData = typeof data.transaction === 'string' ? JSON.parse(data.transaction) : data.transaction;
          console.log('Transaction data:', txData); // Debug log

          // Format transaction for wallet
          const formattedTx = {
            to: txData.to as `0x${string}`,
            data: txData.data as `0x${string}`,
            value: BigInt(txData.value),
            gas: BigInt(txData.gas),
            nonce: Number(txData.nonce),
            chainId: Number(txData.chainId)
          };
          console.log('Formatted transaction:', formattedTx); // Debug log

          // Send the transaction
          const hash = await walletClient.sendTransaction(formattedTx);
          return `${data.response}\n\nTransaction sent! Hash: ${hash}`;
        } catch (error: any) {
          console.error('Transaction error:', error);
          return `${data.response}\n\nError: ${error.message || 'Transaction was rejected or failed.'}`;
        }
      }

      return data.response;
    } catch (error) {
      console.error('Error:', error);
      return 'Sorry, there was an error processing your request. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const messageText = inputText.trim();
    setInputText('');
    setIsLoading(true);
    setMessages(prev => [...prev, { text: messageText, type: 'user' }]);

    // Handle transaction confirmation
    if (awaitingConfirmation) {
      if (messageText.toUpperCase() === 'CONFIRM') {
        setAwaitingConfirmation(false);
        const response = await handleSendMessage(pendingTransaction as string);
        setMessages(prev => [...prev, { text: response, type: 'bot' }]);
      } else {
        setAwaitingConfirmation(false);
        setPendingTransaction(null);
        setMessages(prev => [...prev, { 
          text: 'Transaction cancelled. How else can I help you?', 
          type: 'bot' 
        }]);
      }
    } else {
      const response = await handleSendMessage(messageText);
      setMessages(prev => [...prev, { text: response, type: 'bot' }]);
    }

    setIsLoading(false);
  };

  // Custom components for ReactMarkdown
  const MarkdownComponents: Record<string, React.FC<MarkdownComponentProps>> = {
    // Override paragraph to remove default margins
    p: ({ children }) => <span className="inline">{children}</span>,
    // Style code blocks
    code: ({ inline, children, ...props }) => (
      inline ? 
        <code className="bg-gray-200 rounded px-1 py-0.5 text-sm">{children}</code> :
        <pre className="bg-gray-200 rounded p-2 my-2 overflow-x-auto">
          <code {...props} className="text-sm">{children}</code>
        </pre>
    ),
    // Style links
    a: ({ children, ...props }) => (
      <a {...props} className="text-pink-600 hover:underline">{children}</a>
    )
  };

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
                className={`max-w-xs px-4 py-2 rounded-xl ${
                  message.type === 'user'
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
              </div>
              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold ml-2">
                  U
                </div>
              )}
            </div>
          ))}
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
          {!riskAssessment.isComplete && (
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
            <form onSubmit={handleSubmit} className="flex space-x-4">
              <input
                type="text"
                value={inputText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
                placeholder={awaitingConfirmation ? "Type CONFIRM to proceed or anything else to cancel" : "Type your message... (Markdown supported)"}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="bg-pink-600 text-white p-2 rounded-full hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
