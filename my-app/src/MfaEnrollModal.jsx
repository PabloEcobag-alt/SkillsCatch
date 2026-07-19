import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { ShieldCheck, X, Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function MfaEnrollModal({ isOpen, onClose, onEnrolled }) {
  const [step, setStep] = useState('loading'); // loading | scan | verify | success | error
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      startEnrollment();
    }
    return () => {
      setStep('loading');
      setVerifyCode('');
      setError('');
    };
  }, [isOpen]);

  const startEnrollment = async () => {
    setStep('loading');
    setError('');
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStep('scan');
    } catch (err) {
      setError(err.message || 'Failed to start MFA enrollment.');
      setStep('error');
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (verifyCode.length !== 6) {
      setError('Please enter a 6-digit code.');
      return;
    }

    setVerifying(true);
    setError('');
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setStep('success');
      if (onEnrolled) onEnrolled();
    } catch (err) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in-95 duration-300">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors">
          <X size={18} className="text-gray-400" />
        </button>

        {/* Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <Loader2 size={32} className="text-indigo-600 animate-spin mb-4" />
            <p className="text-gray-500 text-sm">Setting up Two-Factor Authentication...</p>
          </div>
        )}

        {/* Scan QR */}
        {step === 'scan' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={24} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Set Up Two-Factor Auth</h3>
              <p className="text-sm text-gray-500 mt-1">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            </div>

            <div className="flex justify-center">
              <div className="bg-white p-3 rounded-xl border-2 border-slate-100 shadow-sm">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Manual Entry Key</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono text-slate-700 bg-white px-3 py-2 rounded-lg border border-slate-200 break-all select-all">{secret}</code>
                <button onClick={copySecret} className="shrink-0 p-2 bg-white border border-slate-200 rounded-lg hover:bg-indigo-50 transition-colors" title="Copy">
                  {copied ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} className="text-slate-400" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Enter 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 text-gray-900 text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-indigo-600 outline-none"
                  autoFocus
                  disabled={verifying}
                />
              </div>
              <button
                type="submit"
                disabled={verifying || verifyCode.length !== 6}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <><Loader2 size={18} className="animate-spin" /> Verifying...</> : 'Verify & Enable MFA'}
              </button>
            </form>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">MFA Enabled!</h3>
            <p className="text-sm text-gray-500">Your account is now protected with two-factor authentication. You'll need your authenticator app code each time you sign in.</p>
            <button onClick={onClose} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
              Done
            </button>
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Setup Failed</h3>
            <p className="text-sm text-red-600">{error}</p>
            <div className="flex gap-3">
              <button onClick={startEnrollment} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors">
                Retry
              </button>
              <button onClick={onClose} className="flex-1 bg-white text-gray-700 border border-gray-300 font-bold py-3 rounded-xl hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
