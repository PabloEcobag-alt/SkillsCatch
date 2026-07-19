import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Briefcase, MapPin, DollarSign, ExternalLink, Clock, AlertCircle, Zap, RefreshCw } from 'lucide-react';

// DEV TOGGLE: Set to false ONLY when you are doing your final live test or Capstone presentation.
const USE_MOCK_DATA =false; 

const computeSkillMatch = (jobTitle = '', jobDescription = '', userSkills = []) => {
  if (!userSkills.length) return null;
  const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();
  const matched = userSkills.filter(skill => jobText.includes(skill.toLowerCase()));
  const percent = Math.round((matched.length / userSkills.length) * 100);
  return { percent, matched, total: userSkills.length };
};

const jobCacheRef = { current: {} };

const SkeletonCard = () => (
  <div className="p-6 rounded-2xl border shadow-sm animate-pulse theme-surface">
    <div className="flex justify-between items-start gap-4">
      <div className="flex-1 space-y-3">
        <div className="h-5 rounded-lg w-3/4" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
        <div className="h-3 rounded w-1/3" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
        <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
        <div className="flex gap-4 mt-2">
          <div className="h-3 rounded w-20" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
          <div className="h-3 rounded w-24" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
        </div>
      </div>
      <div className="w-11 h-11 rounded-xl shrink-0" style={{ backgroundColor: 'var(--color-surface-border)' }}></div>
    </div>
  </div>
);

export default function JobBoard({ targetJob, userSkills = [] }) {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const debounceRef = useRef(null);

  const fetchJobs = useCallback(async (job) => {
    setIsLoading(true);
    setError(null);

    // --- MOCK DATA FOR UI DEVELOPMENT ---
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        setJobs([
          {
            job_id: "1",
            employer_name: "TechNova Solutions",
            job_title: job || "Junior IT Specialist",
            job_city: "Makati",
            job_country: "PH",
            job_is_remote: true,
            job_posted_at_datetime_utc: new Date().toISOString(),
            job_min_salary: 45000,
            job_max_salary: 60000,
            job_salary_currency: "PHP",
            job_apply_link: "#"
          },
          {
            job_id: "2",
            employer_name: "Global Cyber Security",
            job_title: `${job || "Security"} Analyst`,
            job_city: "Cebu City",
            job_country: "PH",
            job_is_remote: false,
            job_posted_at_datetime_utc: new Date(Date.now() - 86400000).toISOString(),
            job_apply_link: "#"
          }
        ]);
        setIsLoading(false);
      }, 500);
      return;
    }

    // Check cache (5-min TTL)
    const cacheKey = job.toLowerCase().trim();
    const cached = jobCacheRef.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      setJobs(cached.data);
      setIsLoading(false);
      return;
    }

    try {
      const query = `${job} Philippines`;
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jsearch-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error("API_LIMIT_REACHED");
        throw new Error("NETWORK_ERROR");
      }

      const result = await response.json();
      const data = result.data || [];
      jobCacheRef.current[cacheKey] = { data, timestamp: Date.now() };
      setJobs(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!targetJob) {
      setIsLoading(false);
      return;
    }
    // Debounce 600ms to avoid rapid API calls on quick tab switches
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchJobs(targetJob), 600);
    return () => clearTimeout(debounceRef.current);
  }, [targetJob, retryCount, fetchJobs]);

  if (!targetJob) {
    return (
      <div className="text-center py-12 rounded-2xl border border-dashed theme-surface theme-border">
        <Briefcase size={48} className="mx-auto theme-text-secondary opacity-30 mb-4" />
        <h4 className="text-lg font-bold theme-text mb-2">No Target Job Set</h4>
        <p className="theme-text-secondary text-sm">Generate a roadmap on the Home tab first to see matching jobs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h4 className="text-xl font-bold theme-text">Live Job Market</h4>
          <p className="text-sm theme-text-secondary mt-1">Showing real-time openings for <span className="font-bold theme-primary">{targetJob}</span></p>
        </div>
        {USE_MOCK_DATA && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">DEV MODE ACTIVE</span>}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl flex items-start gap-4">
          <AlertCircle size={24} className="shrink-0 mt-1" />
          <div>
            <h4 className="font-bold">Could not load jobs</h4>
            <p className="text-sm mt-1">
              {error === "API_LIMIT_REACHED" 
                ? "You have reached your RapidAPI monthly limit. Please try again later." 
                : error === "NETWORK_ERROR"
                ? "Network error. Check your internet connection and try again."
                : "There was a problem connecting to the job board. Please try again later."}
            </p>
            <button onClick={() => { setError(null); setRetryCount(c => c + 1); }} className="mt-3 flex items-center gap-1 text-sm font-bold text-indigo-600 hover:underline">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed theme-surface theme-border">
          <p className="theme-text-secondary">No jobs found for this specific title today. Try broadening your search.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {jobs.map((job) => (
            <div key={job.job_id} className="p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow group theme-surface glow-hover">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-lg theme-text transition-colors">
                    {job.job_title}
                  </h5>
                  <p className="text-sm font-medium mb-2 theme-primary">{job.employer_name}</p>
                  {(() => {
                    const match = computeSkillMatch(job.job_title, job.job_description || '', userSkills);
                    if (!match) return null;
                    const color = match.percent >= 60 ? 'bg-green-100 text-green-700' : match.percent >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600';
                    return (
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>
                          <Zap size={10} /> {match.percent}% Skill Match
                        </span>
                        {match.matched.length > 0 && (
                          <span className="text-[10px] text-slate-400 truncate">{match.matched.slice(0, 3).join(', ')}{match.matched.length > 3 ? '...' : ''}</span>
                        )}
                      </div>
                    );
                  })()}
                  
                  <div className="flex flex-wrap gap-4 text-xs theme-text-secondary">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="theme-text-secondary" />
                      {job.job_city ? `${job.job_city}, ${job.job_country}` : job.job_is_remote ? "Remote" : "Location hidden"}
                    </div>
                    
                    {(job.job_min_salary || job.job_max_salary) && (
                      <div className="flex items-center gap-1.5">
                        <DollarSign size={14} className="theme-text-secondary" />
                        {job.job_min_salary ? `${job.job_salary_currency} ${job.job_min_salary.toLocaleString()}` : 'Negotiable'} 
                        {job.job_max_salary ? ` - ${job.job_max_salary.toLocaleString()}` : ''}
                      </div>
                    )}
                    
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="theme-text-secondary" />
                      {new Date(job.job_posted_at_datetime_utc).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <a 
                  href={job.job_apply_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="shrink-0 p-3 rounded-xl transition-colors text-white theme-primary-bg hover:opacity-80"
                  title="Apply Now"
                >
                  <ExternalLink size={18} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}