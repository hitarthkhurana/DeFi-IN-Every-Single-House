import { useEffect, useState } from 'react';
import { ArrowRight, Upload, MessageSquare} from 'lucide-react';
import { useNavigate } from 'react-router';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

interface TypingEffectResult {
  displayText: string;
  isTyping: boolean;
  isDone: boolean;
}

const useTypingEffect = (text: string, typingSpeed = 50, startDelay = 0): TypingEffectResult => {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    let charIndex = 0;

    if (text) {
      setDisplayText('');
      setIsTyping(false);
      setIsDone(false);

      timer = setTimeout(() => {
        setIsTyping(true);

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

interface DarkGlassButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className: string }>;
}

const DarkGlassButton: React.FC<DarkGlassButtonProps> = ({ children, className = '', onClick, icon }) => {
  const Icon = icon || ArrowRight;
  return (
    <button
      onClick={onClick}
      className={`px-8 py-6 text-lg rounded-3xl bg-black/80 backdrop-blur-sm border border-white/10 text-white hover:bg-black/90 shadow-lg transition-all duration-200 flex items-center gap-3 group ${className}`}
    >
      {icon && <Icon className="w-5 h-5" />}
      <span>{children}</span>
      {!icon && <ArrowRight className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" />}
    </button>
  );
};

export function LandingPage() {
  const navigate = useNavigate();
  const { isConnected } = useAppKitAccount();
  const { open } = useAppKit();

  const assistantMessageText = "Hi there! I'm your DeFi assistant. I'd love to learn more about your investing background. What broker do you use?";
  const userMessageText = "I use Robinhood and want to explore DeFi investing options.";

  const assistantTyping = useTypingEffect(assistantMessageText, 40, 500);
  const userTyping = useTypingEffect(userMessageText, 40, 5000);

  const showUserBubble = assistantTyping.isDone || userTyping.isTyping || userTyping.isDone;

  useEffect(() => {
    if (isConnected) {
      navigate("/chat");
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-950">
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-lg"></div>
          <span className="text-xl font-bold text-neutral-900 dark:text-white">2DeFi</span>
        </div>
        <appkit-connect-button />
      </nav>

      <section className="container mx-auto px-4 py-20 md:py-32 flex flex-col items-center text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-neutral-900 dark:text-white leading-tight max-w-4xl">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-400">TradFi</span> {"=>"} <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">DeFi</span>
        </h1>

        <span className="text-2xl font-bold italic animate-float">
          <span className="text-blue-500">D</span>eFi{" "}
          <span className="text-blue-500">IN</span>{" "}
          <span className="text-blue-500">E</span>very{" "}
          <span className="text-blue-500">S</span>ingle{" "}
          <span className="text-blue-500">H</span>ouse
        </span>

        <p className="mt-6 text-xl text-neutral-600 dark:text-neutral-300 max-w-2xl">
          Chat with our AI assistant to seamlessly create a personalized decentralized finance strategy that matches your traditional investment style.
        </p>
        <div className="mt-10">
          <DarkGlassButton onClick={() => { open({ view: 'Connect' }); }}>
            Start Your DeFi Journey
          </DarkGlassButton>
        </div>

        <div className="relative w-full max-w-5xl mt-16 pb-16">
          <div className="absolute -top-8 -left-4 w-20 h-20 bg-blue-500/10 rounded-full blur-xl"></div>
          <div className="absolute top-1/2 -right-12 w-32 h-32 bg-emerald-400/10 rounded-full blur-xl"></div>

          <div className="relative h-96 bg-white dark:bg-neutral-800 rounded-xl shadow-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
                <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-600"></div>
              </div>
              <div className="text-sm text-neutral-500 dark:text-neutral-400">DeFi Bridge Assistant</div>
              <div className="w-16"></div>
            </div>
            <div className="p-6 h-64 flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-tr from-blue-500 to-emerald-400 rounded-full flex items-center justify-center text-white">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="bg-neutral-100 dark:bg-neutral-700 p-3 rounded-lg rounded-tl-none max-w-xs">
                    <p className="text-sm text-neutral-800 dark:text-neutral-200">
                      {assistantTyping.displayText}
                      {assistantTyping.isTyping && <span className="animate-pulse">|</span>}
                    </p>
                  </div>
                </div>

                {showUserBubble && (
                  <div className="flex items-start gap-3 justify-end opacity-0 animate-fadeIn" style={{
                    opacity: showUserBubble ? 1 : 0,
                    animation: showUserBubble ? 'fadeIn 0.5s ease forwards' : 'none'
                  }}>
                    <div className="bg-blue-500 p-3 rounded-lg rounded-tr-none max-w-xs">
                      <p className="text-sm text-white">
                        {userTyping.displayText}
                        {userTyping.isTyping && <span className="animate-pulse">|</span>}
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-neutral-200 dark:bg-neutral-600 rounded-full"></div>
                  </div>
                )}
              </div>

              <div className="mt-6 border border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-4 flex items-center justify-center gap-2 text-neutral-600 dark:text-neutral-300">
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload your Robinhood portfolio or start from scratch!</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-neutral-100 dark:bg-neutral-900 py-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-neutral-500 dark:text-neutral-400 text-sm">
            Made with ❤️ by Alex, Hitarth from Waterloo Blockchain
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default LandingPage;
