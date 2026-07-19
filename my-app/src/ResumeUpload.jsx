import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabaseClient'; 
import { extractTextFromPDF } from './lib/pdfParser';

export default function ResumeUpload({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const fileInputRef = useRef(null);

  const handleFileSelection = (selectedFile) => {
    const validTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type)) {
      setStatus({ type: 'error', message: 'Please upload a PDF or Word document.' });
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'File size must be less than 5MB.' });
      return;
    }
    setFile(selectedFile);
    setStatus({ type: '', message: '' });
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus({ type: '', message: '' });

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('You must be logged in to upload.');

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_resume.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // 1. Upload to Supabase
      const { data, error: uploadError } = await supabase.storage
        .from('Resume') 
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      console.log("Reading PDF text...");
      // 2. Extract text from PDF
      const extractedText = await extractTextFromPDF(file);

      console.log("Text extracted length:", extractedText?.length);

      if (!extractedText) {
      throw new Error("Could not read text from this PDF. Is it a scanned image?");
      }

      // 3. Trigger Dashboard immediately
      if (onUploadComplete) {
        onUploadComplete(data.path, extractedText); 
      }

    } catch (error) {
      console.error('Upload Error:', error);
      setStatus({ type: 'error', message: error.message || 'Failed to process resume.' });
      setUploading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm max-w-xl mx-auto">
      <h3 className="text-xl font-bold text-gray-900 mb-2">Upload Your Resume</h3>
      <p className="text-gray-500 mb-6 text-sm">PDF or DOCX (Max 5MB). AI will parse this to analyze your skills.</p>

      {status.message && (
        <div className={`p-4 rounded-lg mb-6 flex items-start gap-3 text-sm ${status.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {status.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <p>{status.message}</p>
        </div>
      )}

      {!file ? (
        <div 
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer ${isDragging ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelection(e.dataTransfer.files[0]); }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelection(e.target.files[0])} className="hidden" accept=".pdf,.doc,.docx" />
          <UploadCloud size={32} className="text-indigo-600 mb-4" />
          <h4 className="text-lg font-semibold text-gray-800">Click to upload or drag and drop</h4>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-4 truncate">
            <FileText size={24} className="text-indigo-600" />
            <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
          </div>
          <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-600"><X size={20} /></button>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="mt-6 w-full bg-indigo-600 text-white rounded-xl py-3.5 font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {uploading ? "Processing..." : "Upload & Continue"}
      </button>
    </div>
  );
}