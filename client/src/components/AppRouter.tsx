import React, { Suspense, lazy } from 'react';
import { Route, Switch, useLocation, Router } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Routes } from './Routes';

// Lazy load public pages
const Login = lazy(() => import('@/pages/Login'));
const Signup = lazy(() => import('@/pages/Signup'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const OnboardingFlow = lazy(() => import('./OnboardingFlow').then(m => ({ default: m.OnboardingFlow })));
const LandingPage = lazy(() => import('./LandingPage').then(m => ({ default: m.LandingPage })));
const FeaturesPage = lazy(() => import('./FeaturesPage').then(m => ({ default: m.FeaturesPage })));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const TermsOfService = lazy(() => import('@/pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const AlexRamozyPage = lazy(() => import('./AlexRamozyPage').then(m => ({ default: m.AlexRamozyPage })));
const OAuthCallback = lazy(() => import('./OAuthPopup').then(m => ({ default: m.OAuthCallback })));
const NotFound = lazy(() => import('@/pages/NotFound'));

// Loading spinner component
const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/10">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm text-slate-600">Loading...</p>
    </div>
  </div>
);

export function AppRouter() {
  const [location, setLocation] = useLocation();

  // Check for active session
  const { data: user, isLoading: isAuthLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Show loading spinner while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect logic for authenticated users on public pages
  if (user) {
    const publicOnlyRoutes = ['/', '/landing', '/login', '/signup'];
    if (publicOnlyRoutes.includes(location)) {
      if (user.onboardingCompleted === false) {
        setLocation('/onboarding');
      } else {
        setLocation('/dashboard');
      }
    }
  } else {
    // If user is not authenticated and trying to access protected routes
    const protectedPrefixes = ['/dashboard', '/onboarding'];
    if (protectedPrefixes.some(prefix => location.startsWith(prefix))) {
      setLocation('/login');
    }
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Switch>
        {/* Public routes */}
        <Route path="/">
          <LandingPage
            onLogin={() => setLocation('/login')}
            onNavigateToFeatures={() => setLocation('/features')}
          />
        </Route>
        <Route path="/landing">
          <LandingPage
            onLogin={() => setLocation('/login')}
            onNavigateToFeatures={() => setLocation('/features')}
          />
        </Route>
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/features">
          <FeaturesPage
            onGetStarted={() => user ? setLocation('/dashboard') : setLocation('/login')}
            onNavigateHome={() => setLocation('/')}
          />
        </Route>
        <Route path="/privacy">
          <PrivacyPolicy onBack={() => setLocation('/')} />
        </Route>
        <Route path="/terms">
          <TermsOfService onBack={() => setLocation('/')} />
        </Route>
        <Route path="/alex-ramozy">
          <AlexRamozyPage onDemoClick={() => setLocation('/login')} />
        </Route>
        <Route path="/api/oauth/callback" component={OAuthCallback} />

        {/* Auth callback (legacy) */}
        <Route path="/auth/callback">
          {() => {
            const params = new URLSearchParams(window.location.search);
            const sessionToken = params.get('sessionToken');
            if (sessionToken) {
              document.cookie = `app_session_id=${sessionToken}; path=/; max-age=31536000; SameSite=Lax`;
            }
            window.history.replaceState({}, '', '/');
            window.location.reload();
            return <div>Redirecting...</div>;
          }}
        </Route>

        {/* Protected routes - Onboarding */}
        <Route path="/onboarding">
          {user ? (
            <OnboardingFlow onComplete={() => setLocation('/dashboard')} />
          ) : (
            <div>Redirecting...</div>
          )}
        </Route>

        {/* Protected routes - Dashboard (all /dashboard/* paths) */}
        <Route path="/dashboard/:rest*">
          {user ? (
            <main id="main-content">
              <Router base="/dashboard">
                <Routes />
              </Router>
            </main>
          ) : (
            <div>Redirecting...</div>
          )}
        </Route>
        <Route path="/dashboard">
          {user ? (
            <main id="main-content">
              <Router base="/dashboard">
                <Routes />
              </Router>
            </main>
          ) : (
            <div>Redirecting...</div>
          )}
        </Route>

        {/* 404 */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
