import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Check, User, Camera } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import PropTypes from 'prop-types';

const AVATAR_SEEDS = [
  'gamer1', 'hacker2', 'cyber3', 'techie4', 'dev5', 'coder6',
  'ninja7', 'pixel8', 'bot9', 'neon10', 'glitch11', 'matrix12'
];

const AVATAR_URLS = AVATAR_SEEDS.map(
  seed => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`
);

export default function AvatarPicker({ isOpen, onClose, userId, currentAvatar, onAvatarChange }) {
  const [activeTab, setActiveTab] = useState('avatars');
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatar || '');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  // Cleanup object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  if (!isOpen) return null;

  const handleSelectAvatar = (url) => {
    setSelectedAvatar(url);
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Size check
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be under 2MB');
      return;
    }

    // MIME type check
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Only JPG, PNG, WebP, and GIF images are allowed');
      return;
    }

    // Magic number validation (basic)
    const reader = new FileReader();
    reader.onload = (ev) => {
      const arr = new Uint8Array(ev.target.result).subarray(0, 4);
      let header = '';
      for (let i = 0; i < arr.length; i++) {
        header += arr[i].toString(16);
      }
      
      // JPEG: ff d8 ff, PNG: 89 50 4e 47, GIF: 47 49 46 38, WebP: 52 49 46 46
      const validSignatures = ['ffd8ff', '89504e47', '47494638', '52494646'];
      if (!validSignatures.some(sig => header.startsWith(sig))) {
        alert('Invalid file format. Please upload a valid image.');
        return;
      }

      // Create robust preview using URL.createObjectURL
      if (preview) {
        URL.revokeObjectURL(preview); // Clean up previous preview
      }
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setSelectedAvatar('');
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      let avatarUrl = selectedAvatar;

      if (preview && fileRef.current?.files?.[0]) {
        const file = fileRef.current.files[0];
        const ext = file.name.split('.').pop();
        const path = `${userId}/profile_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, file, { upsert: true, contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(path);

        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', userId);

      if (error) throw error;

      onAvatarChange(avatarUrl);
      onClose();
    } catch (err) {
      console.error('Avatar save error:', err);
      alert('Failed to save avatar. Make sure Supabase storage bucket "avatars" exists.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden theme-surface border">
        <div className="flex items-center justify-between p-5 border-b theme-border">
          <h3 className="text-lg font-bold theme-text">Choose Your Avatar</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-black/5 rounded-full theme-text-secondary"><X size={20} /></button>
        </div>

        <div className="flex border-b theme-border">
          <button
            onClick={() => setActiveTab('avatars')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'avatars' ? 'theme-primary border-b-2' : 'theme-text-secondary hover:opacity-80'}`}
            style={activeTab === 'avatars' ? { borderColor: 'var(--color-primary-hex)' } : {}}
          >
            <User size={14} className="inline mr-1.5" /> Choose Avatar
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'upload' ? 'theme-primary border-b-2' : 'theme-text-secondary hover:opacity-80'}`}
            style={activeTab === 'upload' ? { borderColor: 'var(--color-primary-hex)' } : {}}
          >
            <Camera size={14} className="inline mr-1.5" /> Upload Photo
          </button>
        </div>

        <div className="p-5">
          {activeTab === 'avatars' ? (
            <div className="grid grid-cols-4 gap-3">
              {AVATAR_URLS.map((url, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectAvatar(url)}
                  className={`relative rounded-xl p-2 border-2 transition-all hover:scale-105 ${
                    selectedAvatar === url ? 'shadow-md' : 'hover:opacity-80'
                  }`}
                  style={{ borderColor: selectedAvatar === url ? 'var(--color-primary-hex)' : 'var(--color-surface-border)', backgroundColor: selectedAvatar === url ? 'rgba(var(--color-primary), 0.08)' : 'transparent' }}
                >
                  <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-auto rounded-lg" />
                  {selectedAvatar === url && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center theme-primary-bg">
                      <Check size={12} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {preview ? (
                <div className="relative mb-4">
                  <img src={preview} alt="Preview" className="w-32 h-32 rounded-full object-cover border-4" style={{ borderColor: 'var(--color-surface-border)' }} />
                  <button onClick={() => { 
                    if (preview) {
                      URL.revokeObjectURL(preview);
                    }
                    setPreview(null); 
                    if (fileRef.current) fileRef.current.value = ''; 
                  }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1"><X size={14} /></button>
                </div>
              ) : (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:opacity-80 transition-all mb-4 theme-border"
                >
                  <Upload size={32} className="theme-text-secondary opacity-40 mb-2" />
                  <p className="text-sm theme-text-secondary font-medium">Click to upload photo</p>
                  <p className="text-xs theme-text-secondary opacity-60 mt-1">JPG, PNG under 2MB</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>
          )}
        </div>

        <div className="p-5 border-t flex gap-3 theme-border">
          <button onClick={onClose} className="flex-1 py-2.5 border rounded-xl text-sm font-bold theme-text-secondary hover:bg-black/5 theme-border">Cancel</button>
          <button
            onClick={handleSave}
            disabled={uploading || (!selectedAvatar && !preview)}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors theme-primary-bg hover:opacity-90"
          >
            {uploading ? 'Saving...' : 'Save Avatar'}
          </button>
        </div>
      </div>
    </div>
  );
}

AvatarPicker.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  userId: PropTypes.string.isRequired,
  currentAvatar: PropTypes.string,
  onAvatarChange: PropTypes.func.isRequired
};
