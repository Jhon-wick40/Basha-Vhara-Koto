import { supabase } from "@/integrations/supabase/client";

export interface ChatbotFaq {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  timestamp: Date;
  suggestions?: string[];
}

/**
 * Fetch all active FAQs from database sorted by sort_order
 */
export async function fetchActiveFaqs(): Promise<ChatbotFaq[]> {
  try {
    const { data, error } = await supabase
      .from("chatbot_faqs")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("Could not load chatbot FAQs from DB:", error.message);
      return [];
    }
    return (data as ChatbotFaq[]) || [];
  } catch (err) {
    console.warn("Error fetching chatbot FAQs:", err);
    return [];
  }
}

/**
 * Find the best answer based on Admin Q&A knowledge base + AI fallback
 */
export function getSmartBotReply(
  userQuery: string,
  faqs: ChatbotFaq[]
): { answer: string; relatedQuestions?: string[] } {
  const cleanInput = userQuery.trim().toLowerCase();

  // 1. Exact match with any question
  const exactMatch = faqs.find(
    f => f.question.trim().toLowerCase() === cleanInput
  );
  if (exactMatch) {
    const otherQuestions = faqs
      .filter(f => f.id !== exactMatch.id)
      .slice(0, 3)
      .map(f => f.question);
    return { answer: exactMatch.answer, relatedQuestions: otherQuestions };
  }

  // 2. High-confidence keyword / token score matching
  const inputWords = cleanInput
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2);

  let bestFaq: ChatbotFaq | null = null;
  let highestScore = 0;

  for (const faq of faqs) {
    let score = 0;
    const qLower = faq.question.toLowerCase();
    const keywordsLower = (faq.keywords || []).map(k => k.toLowerCase());

    for (const word of inputWords) {
      if (qLower.includes(word)) score += 3;
      for (const kw of keywordsLower) {
        if (kw === word) score += 5;
        else if (kw.includes(word) || word.includes(kw)) score += 2;
      }
    }

    if (score > highestScore && score >= 3) {
      highestScore = score;
      bestFaq = faq;
    }
  }

  if (bestFaq) {
    const otherQuestions = faqs
      .filter(f => f.id !== bestFaq.id)
      .slice(0, 3)
      .map(f => f.question);
    return { answer: bestFaq.answer, relatedQuestions: otherQuestions };
  }

  // 3. Conversational AI Greetings & Intents
  if (/^(hi|hello|hey|salam|assalamu|kemon|good morning|good evening)/i.test(cleanInput)) {
    return {
      answer:
        "Hello! 👋 I am your Basha Vhara Koto Smart Assistant. I can help you with finding flats, tenant history lookup, custom IDs, rent payments, and landlord listings. How can I help you today?",
      relatedQuestions: faqs.slice(0, 4).map(f => f.question),
    };
  }

  if (/(basha|flat|house|apartment|rent|room|find)/i.test(cleanInput)) {
    return {
      answer:
        "You can explore all available rental properties on our Home and Listings pages. You can filter by Division, District, Thana, property type, and rent budget in BDT.",
      relatedQuestions: faqs.slice(0, 3).map(f => f.question),
    };
  }

  if (/(custom uid|custom id|t-|l-|uuid|user id)/i.test(cleanInput)) {
    return {
      answer:
        "Every user has a shareable Custom ID (like T-238723). You can copy it from your Profile page and share it with landlords to check your rental history or leave reviews without revealing your email address.",
      relatedQuestions: faqs.slice(0, 3).map(f => f.question),
    };
  }

  if (/(contact|support|phone|help|admin|office)/i.test(cleanInput)) {
    return {
      answer:
        "For direct assistance, you can message verified landlords or tenants on the platform, or submit feedback via the Feedback section. Our admin team monitors all safety and verification requests.",
      relatedQuestions: faqs.slice(0, 3).map(f => f.question),
    };
  }

  // 4. Fallback for unmatched questions
  return {
    answer:
      "I'm not quite sure about that yet, but I've noted your question! Here are some common topics configured by our admin that might help you:",
    relatedQuestions: faqs.slice(0, 4).map(f => f.question),
  };
}
