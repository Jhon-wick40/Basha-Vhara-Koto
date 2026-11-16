/**
 * AppLayout — shared shell with Navbar + Footer
 */
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ChatbotWidget from "@/components/chatbot/ChatbotWidget";

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatbotWidget />
    </div>
  );
}
