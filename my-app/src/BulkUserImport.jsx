import React, { useState } from 'react';
import { Upload, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import Papa from 'papaparse';

export default function BulkUserImport({ onImportComplete }) {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] });

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResults({ success: 0, failed: 0, errors: [] });
    } else {
      alert('Please select a valid CSV file.');
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const users = results.data;
        const importResults = { success: 0, failed: 0, errors: [] };

        for (const user of users) {
          try {
            const { email, full_name } = user;
            if (!email) {
              importResults.failed++;
              importResults.errors.push('Missing email in row');
              continue;
            }

            // Generate temporary password (user will reset via email)
            const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';

            const { data, error } = await supabase.auth.signUp({
              email: email.trim(),
              password: tempPassword,
              options: {
                data: { full_name: full_name || email.split('@')[0] }
              }
            });

            if (error) {
              importResults.failed++;
              importResults.errors.push(`${email}: ${error.message}`);
            } else {
              importResults.success++;
            }
          } catch (err) {
            importResults.failed++;
            importResults.errors.push(`Row error: ${err.message}`);
          }
        }

        setResults(importResults);
        setImporting(false);
        if (onImportComplete) onImportComplete();
      },
      error: (err) => {
        console.error('CSV Parse Error:', err);
        alert('Failed to parse CSV file.');
        setImporting(false);
      }
    });
  };

  return (
    <div className="p-6 rounded-2xl border theme-surface space-y-4">
      <div className="flex items-center gap-3">
        <Users size={20} className="theme-primary" />
        <h5 className="font-bold theme-text">Bulk User Import</h5>
      </div>
      
      <p className="text-sm theme-text-secondary">
        Upload a CSV with columns: <code className="bg-gray-100 px-1 rounded">email</code>, <code className="bg-gray-100 px-1 rounded">full_name</code>
      </p>

      <div className="border-2 border-dashed rounded-xl p-6 text-center theme-border">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="hidden"
          id="csv-upload"
          disabled={importing}
        />
        <label htmlFor="csv-upload" className="cursor-pointer">
          <Upload size={32} className="mx-auto mb-2 theme-text-secondary" />
          <p className="text-sm theme-text-secondary">
            {file ? file.name : 'Click to upload CSV file'}
          </p>
        </label>
      </div>

      {results.success > 0 || results.failed > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle size={16} />
            <span>{results.success} users imported successfully</span>
          </div>
          {results.failed > 0 && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              <span>{results.failed} failed</span>
            </div>
          )}
          {results.errors.length > 0 && (
            <div className="bg-red-50 p-3 rounded-lg text-xs text-red-700 max-h-32 overflow-y-auto">
              {results.errors.map((err, i) => <div key={i}>• {err}</div>)}
            </div>
          )}
        </div>
      ) : null}

      <button
        onClick={handleImport}
        disabled={!file || importing}
        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {importing ? <><Loader2 size={18} className="animate-spin" /> Importing...</> : 'Import Users'}
      </button>
    </div>
  );
}
