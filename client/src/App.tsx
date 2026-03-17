import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { TourProvider } from "./components/tour/TourProvider";
import { SkipNavLink } from "./components/SkipNavLink";
import { NotificationProvider } from "./components/notifications";
import { trpc } from "@/lib/trpc";

// Lazy load heavy components for better initial bundle size
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const AlexRamozyPage = lazy(() => import('./components/AlexRamozyPage').then(m => ({ default: m.AlexRamozyPage })));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));
const FeaturesPage = lazy(() => import('./components/FeaturesPage').then(m => ({ default: m.FeaturesPage })));
const LoginScreen = lazy(() => import('./components/LoginScreen').then(m => ({ default: m.LoginScreen })));
const OnboardingFlow = lazy(() => import('./components/OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const OAuthCallback = lazy(() => import('./components/OAuthPopup').then(m => ({ default: m.OAuthCallback })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const NotFound = lazy(() => import('./pages/NotFound'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-slate-600">Loading...</p>
    </div>
  </div>
);

type ViewState = 'LANDING' | 'LOGIN' | 'ONBOARDING' | 'DASHBOARD' | 'ALEX_RAMOZY' | 'PRIVACY' | 'TERMS' | 'FEATURES' | 'OAUTH_CALLBACK' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD' | 'NOT_FOUND';
type UserTier = 'STARTER' | 'GROWTH' | 'WHITELABEL';

// Admin email for preview access
const ADMIN_EMAIL = 'julian@aiacrobatics.com';

function App() {
  // NOTE: Defaulting to LANDING as requested by user
  const [currentView, setCurrentView] = useState<ViewState>('LANDING');
  const [userTier, setUserTier] = useState<UserTier>('STARTER'); // Default tier for new users
  const [credits, setCredits] = useState(100); // Default credits for new users
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // Check for active session
  const { data: user, isLoading: isAuthLoading, error: authError, refetch: refetchUser } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    // Handle OAuth popup callback (for integration OAuth flows)
    if (path === '/api/oauth/callback') {
      setCurrentView('OAUTH_CALLBACK');
      return;
    }

    // Handle OAuth errors redirected from server
    const error = params.get('error');
    if (error) {
      console.error('[OAuth] Authentication error:', error);
      setCurrentView('LOGIN');
      // Clear error from URL without reloading
      window.history.replaceState({}, '', path);
      return;
    }

    // Handle protected routes - redirect to login if not authenticated
    const protectedPaths = ['/dashboard', '/agent', '/settings', '/lead-lists', '/ai-campaigns', '/browser-sessions'];
    const isProtectedPath = protectedPaths.some(p => path.startsWith(p));

    if (isProtectedPath && !isAuthLoading && !user) {
      // Not logged in, redirect to login
      setCurrentView('LOGIN');
      return;
    }

    // Handle public page routes
    if (path === '/features') {
      setCurrentView('FEATURES');
      return;
    }
    if (path === '/privacy') {
      setCurrentView('PRIVACY');
      return;
    }
    if (path === '/terms') {
      setCurrentView('TERMS');
      return;
    }
    if (path === '/login') {
      setCurrentView('LOGIN');
      return;
    }
    if (path === '/signup') {
      setCurrentView('LOGIN');
      return;
    }
    if (path === '/forgot-password') {
      setCurrentView('FORGOT_PASSWORD');
      return;
    }
    if (path === '/reset-password') {
      setCurrentView('RESET_PASSWORD');
      return;
    }

    // Legacy support: Handle /auth/callback route (if still used)
    // The server now sets cookies directly, but this handles any edge cases
    if (path === '/auth/callback') {
      const sessionToken = params.get('sessionToken');
      if (sessionToken) {
        document.cookie = `app_session_id=${sessionToken}; path=/; max-age=31536000; SameSite=Lax`;
        // Clear the URL and redirect to home
        window.history.replaceState({}, '', '/');
        refetchUser();
      } else {
        // No token in callback, just redirect to home and let auth check handle it
        window.history.replaceState({}, '', '/');
        refetchUser();
      }
      return;
    }

    // 404 catch-all for unknown routes
    if (path !== '/' && !isProtectedPath) {
      setCurrentView('NOT_FOUND');
    }
  }, [refetchUser, isAuthLoading, user]);

  useEffect(() => {
    if (user) {
      const path = window.location.pathname;
      // Don't redirect authenticated users away from public pages they explicitly navigated to
      const publicOnlyPaths = ['/privacy', '/terms', '/features'];
      if (publicOnlyPaths.includes(path)) {
        return; // Let them stay on the public page
      }
      // User is logged in - check if onboarding is completed
      if (user.onboardingCompleted === false) {
        setCurrentView('ONBOARDING');
      } else {
        // If user is on login/signup, redirect to dashboard
        if (path === '/login' || path === '/signup' || path === '/') {
          setCurrentView('DASHBOARD');
        } else if (currentView === 'LANDING' || currentView === 'LOGIN') {
          // If state was set to LANDING/LOGIN but user is authenticated, go to dashboard
          setCurrentView('DASHBOARD');
        }
      }
    }
  }, [user]);

  // Toggle between landing and dashboard for admin preview
  const toggleAdminPreview = () => {
    if (!isAdmin) return;
    if (currentView === 'DASHBOARD') {
      setIsAdminPreview(true);
      setCurrentView('LANDING');
    } else {
      setIsAdminPreview(false);
      setCurrentView('DASHBOARD');
    }
  };

  const handleLogin = (tier: UserTier, needsOnboarding?: boolean) => {
    setUserTier(tier);
    // Credits are now fetched from subscription data in Dashboard via tRPC
    // No hardcoded credit values - Dashboard queries getMySubscription for actual usage

    // Route to onboarding if needed, otherwise go to dashboard
    if (needsOnboarding) {
      setCurrentView('ONBOARDING');
    } else {
      setCurrentView('DASHBOARD');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable={true}>
        <TooltipProvider>
          <NotificationProvider>
            <TourProvider
              onboardingCompleted={user?.onboardingCompleted === true}
              isDashboardActive={currentView === 'DASHBOARD'}
            >
              <SkipNavLink />
              <Toaster />

            {/* Admin Preview Toggle - Only visible for admin user */}
            {isAdmin && (
              <button
                onClick={toggleAdminPreview}
                className="fixed bottom-4 right-4 z-50 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium transition-all hover:scale-105"
                title={currentView === 'DASHBOARD' ? 'Preview Landing Page' : 'Back to Dashboard'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {currentView === 'DASHBOARD' ? 'Preview Site' : 'Dashboard'}
              </button>
            )}

            <Suspense fallback={<LoadingSpinner />}>
              {currentView === 'OAUTH_CALLBACK' && (
                <OAuthCallback />
              )}

              {currentView === 'ALEX_RAMOZY' && (
                <AlexRamozyPage onDemoClick={() => setCurrentView('LOGIN')} />
              )}
              {currentView === 'LANDING' && (
                <LandingPage
                  onLogin={() => {
                    if (isAdminPreview && isAdmin) {
                      // Admin in preview mode - go back to dashboard
                      setIsAdminPreview(false);
                      setCurrentView('DASHBOARD');
                    } else {
                      setCurrentView('LOGIN');
                    }
                  }}
                  onNavigateToFeatures={() => setCurrentView('FEATURES')}
                />
              )}

              {currentView === 'FEATURES' && (
                <FeaturesPage
                  onGetStarted={() => {
                    if (user && !isAdminPreview) {
                      // User is logged in - go to dashboard
                      setCurrentView('DASHBOARD');
                    } else {
                      setCurrentView('LOGIN');
                    }
                  }}
                  onNavigateHome={() => setCurrentView('LANDING')}
                />
              )}

              {currentView === 'LOGIN' && (
                <LoginScreen
                  onAuthenticated={handleLogin}
                  onBack={() => setCurrentView('LANDING')}
                />
              )}

              {currentView === 'ONBOARDING' && (
                <OnboardingFlow onComplete={async () => {
                  // Refetch user data to get updated onboardingCompleted status
                  await refetchUser();
                  setCurrentView('DASHBOARD');
                }} />
              )}

              {currentView === 'DASHBOARD' && (
                <main id="main-content">
                  <Dashboard userTier={userTier} credits={credits} />
                </main>
              )}

              {currentView === 'PRIVACY' && (
                <PrivacyPolicy onBack={() => setCurrentView('LANDING')} />
              )}

              {currentView === 'TERMS' && (
                <TermsOfService onBack={() => setCurrentView('LANDING')} />
              )}

              {currentView === 'FORGOT_PASSWORD' && (
                <ForgotPassword />
              )}

              {currentView === 'RESET_PASSWORD' && (
                <ResetPassword />
              )}

              {currentView === 'NOT_FOUND' && (
                <NotFound />
              )}
            </Suspense>
            </TourProvider>
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
