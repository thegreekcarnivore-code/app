import { Suspense, lazy, type ReactNode } from "react";
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

const Landing = lazy(() => import("./pages/Landing"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCanceled = lazy(() => import("./pages/PaymentCanceled"));
const Home = lazy(() => import("./pages/Home"));
const Discover = lazy(() => import("./pages/Discover"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Admin = lazy(() => import("./pages/Admin"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Measurements = lazy(() => import("./pages/Measurements"));
const AdminClientView = lazy(() => import("./pages/AdminClientView"));
const Profile = lazy(() => import("./pages/Profile"));
const VideoLibrary = lazy(() => import("./pages/VideoLibrary"));
const Resources = lazy(() => import("./pages/Resources"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Community = lazy(() => import("./pages/Community"));

const RouteLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, approved } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (approved === false) return <PendingApproval />;
  return <PolicySigningGate>{children}</PolicySigningGate>;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="h-8 w-8 border-2 border-gold border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/home" replace />;
  return <>{children}</>;
};

const AuthRoute = ({ children }: { children: ReactNode }) => {
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
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<AuthRoute><Landing /></AuthRoute>} />
                  <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
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
              </Suspense>
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
