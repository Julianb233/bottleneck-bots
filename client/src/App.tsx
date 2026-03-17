import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./contexts/ThemeContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { TourProvider } from "./components/tour/TourProvider";
import { SkipNavLink } from "./components/SkipNavLink";
import { NotificationProvider } from "./components/notifications";
import { trpc } from "@/lib/trpc";
import { AppRouter } from "./components/AppRouter";

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-slate-600">Loading...</p>
    </div>
  </div>
);

function App() {
  // Check for active session (used by TourProvider)
  const { data: user, isLoading: isAuthLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

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
              isDashboardActive={true}
            >
              <SkipNavLink />
              <Toaster />
<<<<<<< HEAD
              <Suspense fallback={<LoadingSpinner />}>
                <AppRouter />
              </Suspense>
=======

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
                  <RoutesComponent />
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
>>>>>>> worktree-agent-a20122b4
            </TourProvider>
          </NotificationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
