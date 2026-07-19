import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Mail, Lock, ArrowRight, Github, AlertCircle, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { logActivityForUser } from './lib/logger';
import MfaVerifyModal from './MfaVerifyModal';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // SECURITY: Track failed attempts for UI feedback
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const MAX_ATTEMPTS = 5; // Standard lockout threshold

  const navigate = useNavigate();

  // --- PASSWORD VALIDATION STATES ---
  const [validations, setValidations] = useState({
    length: false, uppercase: false, lowercase: false, number: false, special: false
  });
  const [strength, setStrength] = useState({ label: '', color: 'bg-gray-200' });

  // --- REAL-TIME PASSWORD CHECKER ---
  useEffect(() => {
    if (isLogin) return;

    const rules = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password)
    };
    
    setValidations(rules);

    const passedCount = Object.values(rules).filter(Boolean).length;
    if (password.length === 0) {
      setStrength({ label: '', color: 'bg-gray-200' });
    } else if (passedCount <= 2) {
      setStrength({ label: 'Weak', color: 'bg-red-500' });
    } else if (passedCount <= 4) {
      setStrength({ label: 'Moderate', color: 'bg-yellow-500' });
    } else {
      setStrength({ label: 'Strong', color: 'bg-green-500' });
    }
  }, [password, isLogin]);

  // 1. HANDLE SIGN IN / SIGN UP
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (isLogin) {
        // --- SIGN IN FLOW ---
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        // Success: Check if MFA is required
        setFailedAttempts(0);
        const { data: { user: loggedInUser } } = await supabase.auth.getUser();
        logActivityForUser(loggedInUser?.id, 'Login Success', { method: 'email' });
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.nextLevel === 'aal2' && aalData?.currentLevel !== 'aal2') {
          setShowMfaChallenge(true);
        } else {
          navigate('/dashboard');
        }
      } else {
        // --- SIGN UP FLOW ---
        const isFullySecure = Object.values(validations).every(Boolean);
        if (!isFullySecure) {
          setMessage({ type: 'error', text: 'Please ensure your password meets all security requirements.' });
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (signUpData?.user?.id) logActivityForUser(signUpData.user.id, 'Account Signup', { email });
        setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
      }
    } catch (error) {
      // SECURITY: User-Friendly Lockout Logic
      let friendlyMessage = error.message;

      if (isLogin) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setPassword(''); 
        console.warn(`Login failed for ${email}: attempt ${newAttempts}`);

        if (error.status === 429 || error.message.toLowerCase().includes("rate limit") || 
        error.message.toLowerCase().includes("too many requests")) {
          friendlyMessage = "Account temporarily locked due to too many invalid attempts. For your security, please try again in 30 minutes.";
        } else if (error.message.includes("Invalid login credentials")) {
          const attemptsLeft = MAX_ATTEMPTS - newAttempts;
          if (attemptsLeft > 0) {
             friendlyMessage = `Incorrect email or password. You have ${attemptsLeft} 
             attempt${attemptsLeft === 1 ? '' : 's'} remaining before lockout.`;
          } else {
             friendlyMessage = "Maximum attempts reached. Account locked. Please try again later.";
          }
        }
      }

      setMessage({ type: 'error', text: friendlyMessage });
    } finally {
      setLoading(false); // UX FIX: Ensure the form always unlocks so the user can try again
    }
  };

  // 2. HANDLE GOOGLE / GITHUB
  const handleOAuthLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: { 
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: false
        },
      });
      if (error) throw error;
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  };

// 3. HANDLE PASSWORD RESET
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`, // Force redirect here
      });
      
      if (error) throw error;
      
      // SECURITY: Anti-Enumeration Message
      setMessage({ type: 'success', text: 'If an account exists, a reset link has been sent to your registered email.' });
      console.log('Password reset requested for:', email);
    } catch (error) {
      // SECURITY: Even on error, show the exact same message to confuse attackers
      setMessage({ type: 'success', text: 'If an account exists, a reset link has been sent to your registered email.' });
      console.error("Reset Error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const ValidationItem = ({ passed, text }) => (
    <div className={`flex items-center gap-2 text-xs transition-colors duration-300 ${passed ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
      {passed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      <span>{text}</span>
    </div>
  );

  // --- VIEW: MFA CHALLENGE ---
  if (showMfaChallenge) {
    return <MfaVerifyModal onVerified={() => navigate('/dashboard')} />;
  }

  // --- VIEW: FORGOT PASSWORD ---
  if (isForgotPassword) {
    return (
      <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Password</h2>
          <p className="text-gray-500 mb-6">Enter your email for reset instructions.</p>

          {message.text && (
            <div className={`p-3 rounded mb-4 text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span className="font-medium leading-tight">{message.text}</span>
            </div>
          )}

          <form onSubmit={handleResetPassword} className="space-y-5">
            <input 
              type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-indigo-600 text-gray-900"
              placeholder="you@example.com"
              disabled={loading}
            />
            <button disabled={loading} className="w-full bg-indigo-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
          <button onClick={() => setIsForgotPassword(false)} disabled={loading} className="mt-6 w-full text-indigo-600 text-sm font-semibold hover:underline disabled:opacity-50">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // --- VIEW: MAIN LOGIN / SIGN UP ---
  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex overflow-hidden glow-hover">
        
        {/* Left Side: Branding */}
        <div className="w-5/12 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-8 lg:p-10 text-white flex flex-col justify-between hidden md:flex">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <Bot size={32} className="text-indigo-200" />
              <h1 className="text-2xl font-bold tracking-tight">SkillsCatch</h1>
            </div>
            <h2 className="text-2xl lg:text-3xl font-semibold leading-tight mb-4 text-white">Discover your perfect IT career path.</h2>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full md:w-7/12 p-6 md:p-8 lg:p-10 bg-white">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isLogin ? 'Welcome back!' : 'Start your journey'}
          </h2>
          
          {message.text && (
             <div className={`p-3 rounded mb-4 text-sm flex items-start gap-2 ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
               <AlertCircle size={16} className="shrink-0 mt-0.5" /> 
               <span className="font-medium leading-tight">{message.text}</span>
             </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none disabled:bg-gray-50 text-gray-900"
                  placeholder="you@example.com"
                  disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 text-gray-400" size={20} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  required value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-600 outline-none disabled:bg-gray-50 text-gray-900"
                  placeholder="••••••••"
                  disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {!isLogin && (
                <div className="mt-3 space-y-3">
                  {password.length > 0 && (
                    <div className="space-y-1.5 transition-all">
                      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-gray-500">Security Level</span>
                        <span className={strength.color.replace('bg-', 'text-')}>{strength.label}</span>
                      </div>
                      <div className="flex gap-1 h-1.5">
                        <div className={`flex-1 rounded-full transition-colors duration-500 ${password.length > 0 ? strength.color : 'bg-gray-100'}`}></div>
                        <div className={`flex-1 rounded-full transition-colors duration-500 ${strength.label === 'Moderate' || strength.label === 'Strong' ? strength.color : 'bg-gray-100'}`}></div>
                        <div className={`flex-1 rounded-full transition-colors duration-500 ${strength.label === 'Strong' ? strength.color : 'bg-gray-100'}`}></div>
                      </div>
                    </div>
                  )}

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1.5">
                    <ValidationItem passed={validations.length} text="At least 8 characters long" />
                    <ValidationItem passed={validations.uppercase} text="One uppercase letter (A-Z)" />
                    <ValidationItem passed={validations.lowercase} text="One lowercase letter (a-z)" />
                    <ValidationItem passed={validations.number} text="One number (0-9)" />
                    <ValidationItem passed={validations.special} text="One special character (!@#$%^&*)" />
                  </div>
                </div>
              )}

              {isLogin && (
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-indigo-600 hover:underline font-medium disabled:opacity-50" disabled={loading}>
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)} 
              className="w-full bg-indigo-600 text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>

          {/* OAuth Section */}
          <div className="mt-6">
            <div className="relative flex justify-center text-sm mb-4">
              <span className="px-2 bg-white text-gray-500 relative z-10 font-medium">Or continue with</span>
              <div className="absolute top-1/2 left-0 w-full border-t border-gray-200"></div>
            </div>
            
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 hover:bg-gray-50 transition-all text-gray-700 font-medium disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="hidden sm:block">Google</span>
              </button>
              
              <button 
                type="button"
                onClick={() => handleOAuthLogin('github')}
                disabled={loading || (isLogin && failedAttempts >= MAX_ATTEMPTS)}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-3 hover:bg-gray-50 transition-all text-gray-700 font-medium disabled:opacity-50"
              >
                <Github size={20} className="shrink-0" />
                <span className="hidden sm:block">GitHub</span>
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              disabled={loading}
              onClick={() => {
                setIsLogin(!isLogin);
                setMessage({ type: '', text: '' }); 
                setPassword(''); 
                setFailedAttempts(0); // Reset attempts if they toggle modes
              }} 
              className="text-indigo-600 font-semibold hover:underline disabled:opacity-50"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}