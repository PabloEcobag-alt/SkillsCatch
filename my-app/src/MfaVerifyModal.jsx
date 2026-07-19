import React, { useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function MfaVerifyModal({ onVerified }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setVerifying(true);
    setError('');
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpFactor = factors.totp?.[0];
      
      if (!totpFactor) {
        throw new Error('No TOTP factor found. Please contact support.');
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ 
        factorId: totpFactor.id 
      });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      if (onVerified) onVerified();
    } catch (err) {
      if (err.message?.includes('Invalid') || err.message?.includes('invalid')) {
        setError('Invalid code. Please check your authenticator app and try again.');
      } else {
        setError(err.message || 'Verification failed. Please try again.');
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Two-Factor Authentication</h2>
          <p className="text-sm text-gray-500 mt-2">Enter the 6-digit code from your authenticator app to continue.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg mb-6">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="mfa-code" className="block text-sm font-medium text-gray-700 mb-2">Authentication Code</label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full px-4 py-4 rounded-xl border border-gray-300 text-gray-900 text-center text-3xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-indigo-600 outline-none"
              autoFocus
              disabled={verifying}
            />
          </div>
          <button
            type="submit"
            disabled={verifying || code.length !== 6}
            className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {verifying ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : 'Verify & Sign In'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Open your authenticator app (Google Authenticator, Authy) to find your code.
        </p>
      </div>
    </div>
  );
}
