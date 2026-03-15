import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SavedRestaurantsProvider } from "./context/SavedRestaurantsContext";
import { ChatProvider } from "./context/ChatContext";
import { SavedActivitiesProvider } from "./context/SavedActivitiesContext";
import { PageActionsProvider } from "./context/PageActionsContext";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { LanguageProvider } from "./context/LanguageContext";
import AppLayout from "./components/AppLayout";
import { ThemeProvider } from "./context/ThemeContext";
import GuideSpotlight from "./components/GuideSpotlight";
import { GuideHighlightProvider } from "./context/GuideHighlightContext";
import PolicySigningGate from "./components/PolicySigningGate";
import Index from "./pages/Index";
import Landing from "./pages/Landing";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import Home from "./pages/Home";
import Discover from "./pages/Discover";

import Delivery from "./pages/Delivery";
import Explore from "./pages/Explore";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Shopping from "./pages/Shopping";
import PendingApproval from "./pages/PendingApproval";
import NotFound from "./pages/NotFound";
import Measurements from "./pages/Measurements";
import AdminClientView from "./pages/AdminClientView";
import Profile from "./pages/Profile";
import VideoLibrary from "./pages/VideoLibrary";
import Resources from "./pages/Resources";
import ResetPassword from "./pages/ResetPassword";
import Community from "./pages/Community";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, approved } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (approved === false) return <PendingApproval />;
  return <PolicySigningGate>{children}</PolicySigningGate>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ThemeProvider>
        <LanguageProvider>
          <SavedRestaurantsProvider>
          <ChatProvider>
          <SavedActivitiesProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <GuideHighlightProvider>
            <GuideSpotlight />
              <Routes>
                <Route path="/" element={<AuthRoute><Landing /></AuthRoute>} />
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/payment-success" element={<PaymentSuccess />} />
                <Route path="/payment-canceled" element={<PaymentCanceled />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route element={<ProtectedRoute><PageActionsProvider><AppLayout /></PageActionsProvider></ProtectedRoute>}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/measurements" element={<Measurements />} />
                  <Route path="/learn" element={<VideoLibrary />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/community" element={<Community />} />
                </Route>
                <Route path="/admin/client/:userId" element={<AdminRoute><AdminClientView /></AdminRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </GuideHighlightProvider>
            </BrowserRouter>
          </SavedActivitiesProvider>
          </ChatProvider>
          </SavedRestaurantsProvider>
        </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
