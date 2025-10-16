import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import LoginForm from "./LoginForm";
import AdminSignupForm from "./AdminSignupForm";

const AuthContainer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [currentView, setCurrentView] = useState<'login' | 'signup'>('login');

  // Set initial view based on current route
  useEffect(() => {
    if (location.pathname === '/signup') {
      setCurrentView('signup');
    } else {
      setCurrentView('login');
    }
  }, [location.pathname]);

  const handleNavigateToSignup = () => {
    setCurrentView('signup');
  };

  const handleNavigateToLogin = () => {
    setCurrentView('login');
  };

  const handleLogin = (user: { id: string; name: string; role: string; branchId: string }) => {
    login(user as any);
    navigate('/');
  };

  return (
    <div className="relative min-h-screen overflow-y-auto">
      {/* Login Form */}
      <div
        className={`absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          currentView === 'login' ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <LoginForm onLogin={handleLogin} onNavigateToSignup={handleNavigateToSignup} />
      </div>

      {/* Signup Form */}
      <div
        className={`absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          currentView === 'signup' ? 'translate-x-0' : 'translate-x-full'
        } overflow-y-auto`}
      >
        <AdminSignupForm onNavigateToLogin={handleNavigateToLogin} />
      </div>
    </div>
  );
};

export default AuthContainer;
