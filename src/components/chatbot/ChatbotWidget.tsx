import { useState, useEffect, useRef } from "react";
import { 
  Home, MessageCircle, X, Send, Sparkles, ChevronDown, 
  RotateCcw, HelpCircle, CornerDownLeft, Loader2 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchActiveFaqs, getSmartBotReply, ChatbotFaq, ChatMessage } from "@/lib/chatbotEngine";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [faqs, setFaqs] = useState<ChatbotFaq[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load FAQs from database on mount
  useEffect(() => {
    async function loadFaqs() {
      const data = await fetchActiveFaqs();
      setFaqs(data);

      // Initial Bot greeting
      const initialSuggestions = data.slice(0, 4).map(f => f.question);
      setMessages([
        {
          id: "welcome-msg",
          sender: "bot",
          text: "👋 Assalamu Alaikum! Welcome to Basha Vhara Koto Assistant. How can I help you today?",
          timestamp: new Date(),
          suggestions: initialSuggestions,
        },
      ]);
    }
    loadFaqs();
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setHasUnread(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue("");
    setIsTyping(true);

    // Simulate smart thinking delay
    setTimeout(() => {
      const reply = getSmartBotReply(text, faqs);
      const botMsg: ChatMessage = {
        id: "bot-" + Date.now(),
        sender: "bot",
        text: reply.answer,
        timestamp: new Date(),
        suggestions: reply.relatedQuestions,
      };

      setMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 450);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "reset-" + Date.now(),
        sender: "bot",
        text: "👋 Chat reset. What would you like to know about Basha Vhara Koto?",
        timestamp: new Date(),
        suggestions: faqs.slice(0, 4).map(f => f.question),
      },
    ]);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Chat Window */}
      {isOpen && (
        <Card className="w-[92vw] sm:w-[380px] h-[520px] max-h-[82vh] mb-3 shadow-2xl border-primary/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center relative">
                <Home className="h-5 w-5 text-primary-foreground" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-primary" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm leading-tight">Basha Vhara Assistant</h3>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-primary-foreground/20 text-primary-foreground border-none">
                    AI Auto-Reply
                  </Badge>
                </div>
                <p className="text-[11px] text-primary-foreground/80">Rental help & instant answers</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
                title="Reset conversation"
                onClick={handleResetChat}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20 rounded-full"
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-muted/20 text-xs">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-xs"
                      : "bg-card text-card-foreground border rounded-tl-xs"
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>
                </div>

                {/* Suggestion Chips */}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 max-w-[95%]">
                    {msg.suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSend(suggestion)}
                        className="text-[11px] bg-card hover:bg-primary hover:text-primary-foreground text-foreground border border-primary/20 rounded-full px-2.5 py-1 transition-colors text-left flex items-center gap-1 shadow-xs"
                      >
                        <HelpCircle className="h-3 w-3 text-primary shrink-0" />
                        <span className="line-clamp-1">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span className="text-[9px] text-muted-foreground mt-1 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-center gap-1.5 text-muted-foreground bg-card border rounded-2xl px-3 py-2 w-fit">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-[11px]">Assistant is answering...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 border-t bg-card flex items-center gap-2"
          >
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Ask a question about rent, IDs, KYC..."
              className="h-10 text-xs rounded-full bg-muted/40 focus-visible:ring-primary"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!inputValue.trim() || isTyping}
              className="h-10 w-10 shrink-0 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* Floating Toggle Button with House Icon */}
      <Button
        type="button"
        onClick={() => (isOpen ? handleClose() : handleOpen())}
        className="h-14 w-14 rounded-full shadow-2xl bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center relative transition-transform hover:scale-105 active:scale-95 min-h-[44px] min-w-[44px]"
        aria-label="Toggle Basha Assistant"
      >
        {isOpen ? (
          <ChevronDown className="h-6 w-6" />
        ) : (
          <div className="relative flex items-center justify-center">
            <Home className="h-7 w-7" />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-primary" />
            </span>
          </div>
        )}
      </Button>
    </div>
  );
}
