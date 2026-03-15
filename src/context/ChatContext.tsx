import React, { createContext, useContext, useState } from "react";

interface GuideStep {
  navigate?: string;
  highlight: string;
  label: string;
}

interface ChatContextType {
  /** Personal message panel */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** Assistant panel */
  assistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  /** Persistent guide steps available for the user */
  pendingGuide: GuideStep[] | null;
  setPendingGuide: (steps: GuideStep[] | null) => void;
  /** Request to launch the onboarding tour */
  requestTour: boolean;
  setRequestTour: (v: boolean) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const useChatContext = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within ChatProvider");
  return ctx;
};

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [chatOpen, setChatOpenRaw] = useState(false);
  const [assistantOpen, setAssistantOpenRaw] = useState(false);
  const [pendingGuide, setPendingGuide] = useState<GuideStep[] | null>(null);
  const [requestTour, setRequestTour] = useState(false);

  // Opening one closes the other
  const setChatOpen = (open: boolean) => {
    setChatOpenRaw(open);
    if (open) setAssistantOpenRaw(false);
  };
  const setAssistantOpen = (open: boolean) => {
    setAssistantOpenRaw(open);
    if (open) setChatOpenRaw(false);
  };

  return (
    <ChatContext.Provider value={{ chatOpen, setChatOpen, assistantOpen, setAssistantOpen, pendingGuide, setPendingGuide, requestTour, setRequestTour }}>
      {children}
    </ChatContext.Provider>
  );
};
