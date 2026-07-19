import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { supabase } from './lib/supabaseClient';
import { analyzeResumeWithAI } from './lib/aiService'; 
import { useDebounce } from './lib/useDebounce';
import { logActivity } from './lib/logger';
import { 
  Home, Target, Briefcase, Newspaper, User, Info, 
  MessageSquare, Bell, Upload, ChevronRight, CheckCircle, Bot, X, Edit3, Send, Trash2, Save, RefreshCw, MapPin, 
  ShieldCheck, Mail, BriefcaseBusiness, ExternalLink, BookOpen, Play, FileText, AlertCircle, Settings, Shield
} from 'lucide-react';
import ResumeUpload from './ResumeUpload'; 
import JobBoard from './JobBoard';
import ProfileSidebar from './ProfileSidebar';
import MfaEnrollModal from './MfaEnrollModal';
import ExportPdfButton from './ExportPdfButton';
import AvatarPicker from './AvatarPicker';
import SettingsPage from './SettingsPage';
import IndustryNews from './IndustryNews';
import { useTheme } from './lib/ThemeContext';

const getSafeResourceUrl = (url, title) => {
  if (!url || typeof url !== 'string') {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(title || 'IT Tutorial')}`;
  }

  const lowerUrl = url.toLowerCase();

  // Catch any manifestation of raw Google/YouTube video streaming pipelines
  if (lowerUrl.includes('googlevideo.com') || lowerUrl.includes('videoplayback') || lowerUrl.includes('youtube.com/api')) {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(title || 'IT Tutorial')}`;
  }

  return url;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState("Analyzing resume and target role...");
  const [extractedSkills, setExtractedSkills] = useState(null); 
  const [targetJob, setTargetJob] = useState("");              
  const [aiReport, setAiReport] = useState(null);              
  const [selectedSkills, setSelectedSkills] = useState([]);
  
  // PROFILE & SIDEBAR STATES
  const [isProfileOpen, setIsProfileOpen] = useState(false); 
  const [userProfile, setUserProfile] = useState(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);

  // MULTI-ROADMAP STATES
  const [completedTasks, setCompletedTasks] = useState([]);
  const [toastMessage, setToastMessage] = useState("");
  const [savedRoadmaps, setSavedRoadmaps] = useState([]); 
  const [activeRoadmapIndex, setActiveRoadmapIndex] = useState(0); 

  // 1. Fetch User Data
  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*') 
            .eq('id', user.id)
            .maybeSingle();
          
          if (profile) {
            setUserProfile({ ...profile, email: user.email });
            if (profile.target_role) setTargetJob(profile.target_role);
            if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
            console.log('Profile loaded, role:', profile.role);
          } else {
            setUserProfile({ email: user.email });
            console.log('No profile found for user:', user.id);
          }
        } catch (err) { console.log("Profile fetch error:", err); }
      }
    };
    getUserData();
  }, []);

  useEffect(() => {
    if (extractedSkills) setSelectedSkills(extractedSkills);
  }, [extractedSkills]);

  // 2. Fetch Multi-Progress Data
  const fetchProgressData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: roadmapData } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (roadmapData) setSavedRoadmaps(roadmapData);

    const { data: progressData } = await supabase
      .from('task_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_completed', true);
    
    if (progressData) setCompletedTasks(progressData);
  };

  useEffect(() => {
    if (activeTab === "progress" || activeTab === "home") {
      fetchProgressData();
    }
  }, [activeTab]);

  // --- REAL-TIME MARKET STATS VIA JSEARCH API ---
  const [marketStats, setMarketStats] = useState({ postings: 0, growth: 0, locations: [] });
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState(null);
  const marketCacheRef = React.useRef({});
  const debouncedTargetJob = useDebounce(targetJob, 800);

  // Dynamic loading text for roadmap generation
  const loadingMessages = [
    "Analyzing resume and target role...",
    "Calculating skill gaps...",
    "Searching for verified YouTube tutorials...",
    "Compiling your 4-week trajectory...",
    "Finalizing..."
  ];

  useEffect(() => {
    let interval;
    if (isAnalyzing) {
      let messageIndex = 0;
      setLoadingText(loadingMessages[0]);
      
      interval = setInterval(() => {
        messageIndex = (messageIndex + 1) % loadingMessages.length;
        setLoadingText(loadingMessages[messageIndex]);
      }, 3000);
    } else {
      setLoadingText("Analyzing resume and target role...");
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAnalyzing]);

  useEffect(() => {
    if (!debouncedTargetJob) {
      setMarketStats({ postings: 0, growth: 0, locations: [] });
      return;
    }

    const cacheKey = debouncedTargetJob.toLowerCase().trim();
    const cached = marketCacheRef.current[cacheKey];
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      setMarketStats(cached.data);
      setMarketError(null);
      return;
    }

    const fetchMarketData = async () => {
      setMarketLoading(true);
      setMarketError(null);
      try {
        const query = `${debouncedTargetJob} Philippines`;
        
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
        const jobs = result.data || [];

        const locationCount = {};
        jobs.forEach(job => {
          const city = job.job_city || (job.job_is_remote ? "Remote" : "Unknown");
          locationCount[city] = (locationCount[city] || 0) + 1;
        });
        const topLocations = Object.entries(locationCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([loc]) => loc);

        const stats = {
          postings: jobs.length > 0 ? jobs.length.toLocaleString() : "0",
          growth: jobs.length > 0 ? Math.min(Math.round(jobs.length * 0.3), 25) : 0,
          locations: topLocations.length > 0 ? topLocations : ["No data"]
        };

        marketCacheRef.current[cacheKey] = { data: stats, timestamp: Date.now() };
        setMarketStats(stats);
      } catch (err) {
        console.error("Market data fetch error:", err);
        setMarketError(err.message === "API_LIMIT_REACHED" 
          ? "API limit reached. Try again later." 
          : "Could not load market data.");
      } finally {
        setMarketLoading(false);
      }
    };

    fetchMarketData();
  }, [debouncedTargetJob]);

  // --- LOGIC FUNCTIONS ---
  const handleLogout = async () => {
    logActivity('Logout');
    await supabase.auth.signOut();
    navigate('/');
  };

  // --- SECURITY: MFA ENROLLMENT ---
  const enrollMFA = () => {
    setShowMfaModal(true);
  };

  const toggleSkill = (skill) => {
    setSelectedSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]);
  };

  const toggleTask = async (weekNum, taskIdx, currentStatus, role) => {
    const newStatus = !currentStatus;

    if (newStatus) {
      setCompletedTasks(prev => [...prev, { week_number: weekNum, task_index: taskIdx, target_role: role }]);
      setToastMessage("Great job! Keep the momentum going.");
      setTimeout(() => setToastMessage(""), 3000); 
    } else {
      setCompletedTasks(prev => prev.filter(t => !(t.week_number === weekNum && t.task_index === taskIdx && t.target_role === role)));
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('task_progress')
        .upsert({
          user_id: user.id,
          target_role: role, 
          week_number: weekNum,
          task_index: taskIdx,
          is_completed: newStatus,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id, target_role, week_number, task_index' });

      if (error) console.error("Supabase Error saving task:", error.message);
    } catch (err) {
      console.error("Error updating task:", err.message);
    }
  };

  const deleteRoadmap = async (roleToDelete) => {
    if (!window.confirm(`Are you sure you want to delete the ${roleToDelete} roadmap? All progress will be lost.`)) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('roadmaps').delete().match({ user_id: user.id, target_role: roleToDelete });
      await supabase.from('task_progress').delete().match({ user_id: user.id, target_role: roleToDelete });
      
      setActiveRoadmapIndex(0);
      fetchProgressData();
      
      setToastMessage("Roadmap deleted successfully.");
      setTimeout(() => setToastMessage(""), 3000);
    } catch (err) {
      console.error("Error deleting roadmap:", err);
    }
  };

  const handleFinalAnalysis = async () => {
    if (savedRoadmaps.length >= 3) {
      alert("You already have 3 active roadmaps! Please go to 'My Progress' and delete one before generating a new path.");
      return;
    }

    if (savedRoadmaps.some(r => r.target_role.toLowerCase() === targetJob.toLowerCase())) {
      alert(`You already have a roadmap for ${targetJob}. Check your Progress tab!`);
      return;
    }

    setIsAnalyzing(true);
    try {
      const report = await analyzeResumeWithAI(selectedSkills.join(', '), "ROADMAP", targetJob);
      setAiReport(report); 
    } catch (error) {
      console.error(error);
      const msg = error.message === "REQUEST_IN_PROGRESS"
        ? "A request is already processing. Please wait."
        : error.message === "RATE_LIMIT_EXCEEDED"
        ? "AI rate limit reached. Please wait 60 seconds and try again."
        : "AI generation failed. Check your internet connection and try again.";
      setToastMessage(msg);
      setTimeout(() => setToastMessage(""), 5000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveRoadmapToProgress = async () => {
    if (savedRoadmaps.length >= 3) {
      alert("You already have 3 saved roadmaps! Please delete one first.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('roadmaps').upsert({
        user_id: user.id,
        target_role: targetJob,
        data: aiReport 
      });

      if (error) throw error;

      setToastMessage("Roadmap saved to My Progress!");
      setTimeout(() => setToastMessage(""), 3000);
      
      logActivity('Saved roadmap', { targetJob });
      
      setAiReport(null);
      setTargetJob("");
      await fetchProgressData();
      setActiveTab("progress");

    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save. Please try again later.");
    }
  };

  const discardRoadmapDraft = () => {
    if(window.confirm("Are you sure you want to discard this roadmap and try a different job title?")) {
      setAiReport(null);
      setTargetJob("");
    }
  };

  const getInitials = () => {
    if (!user?.email) return "??";
    return user.email.charAt(0).toUpperCase();
  };

  // --- UI COMPONENTS ---
  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={32} className="theme-primary" />
          <span className="text-xl font-bold theme-text">Skills Catch</span>
        </div>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        <NavItem icon={<Home size={20} />} label="Home" active={activeTab === "home"} onClick={() => setActiveTab("home")} />
        <NavItem icon={<Target size={20} />} label="My Progress" active={activeTab === "progress"} onClick={() => setActiveTab("progress")} />
        <NavItem icon={<Briefcase size={20} />} label="Real-Time Jobs" active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} />
        <NavItem icon={<Newspaper size={20} />} label="Industry News" active={activeTab === "news"} onClick={() => setActiveTab("news")} />
        <NavItem icon={<User size={20} />} label="My Profile" active={activeTab === "profile"} onClick={() => setActiveTab("profile")} />
        <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        {userProfile?.role === 'admin' && (
          <button 
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-red-500 hover:bg-red-500/10 font-medium mt-2"
          >
            <Shield size={20} />
            <span>Admin Panel</span>
          </button>
        )}
      </nav>
      
      <div className="p-4 border-t space-y-2 mt-auto theme-border">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-red-50 group transition-all">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover border-2 group-hover:border-red-200" style={{ borderColor: theme.primaryHex }} />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white group-hover:bg-red-100 group-hover:text-red-700 theme-primary-bg">{getInitials()}</div>
          )}
          <div className="text-left">
            <p className="text-sm font-medium truncate theme-text">{user?.email?.split('@')[0] || 'Sign Out'}</p>
            <p className="text-xs theme-text-secondary">Log Out</p>
          </div>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen font-sans relative overflow-hidden" style={{ backgroundColor: theme.pageBg }}>
      <aside className="w-64 border-r flex flex-col hidden md:flex theme-sidebar theme-border"><SidebarContent /></aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-72 shadow-2xl flex flex-col transition-transform duration-300 h-full theme-sidebar"><SidebarContent /></aside>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="glass border-b h-16 flex items-center justify-between px-4 md:px-8 shrink-0 theme-border">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 theme-text-secondary hover:bg-black/5 rounded-lg"><Bot size={24} /></button>
            <h2 className="text-lg md:text-xl font-semibold capitalize theme-text">{activeTab.replace('-', ' ')}</h2>
          </div>
          
          <button 
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2 p-1 pr-3 rounded-full hover:shadow-md transition-all group theme-surface border"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs theme-primary-bg">
                {user?.email?.[0].toUpperCase()}
              </div>
            )}
            <span className="hidden sm:block text-sm font-bold theme-text">Account</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "home" && (
            <div className="rounded-2xl p-6 md:p-8 text-white mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-lg theme-glow" style={{ backgroundColor: theme.primaryHex }}>
              <div className="max-w-xl">
                <h3 className="text-xl md:text-2xl font-bold mb-2">Ready to find your path?</h3>
                <p className="text-white/70 text-sm md:text-base">Upload your latest resume. We'll extract your skills and map them to your dream job.</p>
              </div>
              <button onClick={() => setShowUploadModal(true)} className="w-full lg:w-auto bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all shrink-0">
                <Upload size={20} /> Upload Resume
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            <div className="p-6 rounded-2xl border shadow-sm col-span-1 lg:col-span-2 min-h-[400px] theme-surface glow-hover">
              
              {/* TAB 1: HOME */}
              {activeTab === "home" && (
                <>
                  {isAnalyzing ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                      <h4 className="text-lg font-bold theme-text">AI is Processing...</h4>
                      <p className="theme-text-secondary text-sm mt-2">{loadingText}</p>
                    </div>
                  ) : aiReport ? (
                    <div className="animate-in fade-in duration-500">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="text-xl font-bold theme-text flex items-center gap-2">
                          <Target className="theme-primary" /> Draft: {aiReport.recommendedRole}
                        </h4>
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Unsaved Draft</span>
                      </div>

                      <div className="p-4 rounded-xl border mb-8 theme-surface" style={{ borderColor: 'var(--color-accent-hex)', backgroundColor: 'rgba(var(--color-primary), 0.08)' }}><p className="text-sm theme-text leading-relaxed italic">"{aiReport.justification}"</p></div>
                      
                      <div className="mb-10">
                        <div className="flex justify-between text-sm mb-2 font-bold">
                          <span className="theme-text-secondary uppercase tracking-tight">Market Readiness</span>
                          <span className="theme-primary">{100 - aiReport.skillGapPercentage}% Match</span>
                        </div>
                        <div className="w-full rounded-full h-3" style={{ backgroundColor: 'var(--color-surface-border)' }}>
                          <div className="bg-indigo-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${100 - aiReport.skillGapPercentage}%` }}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-8">
                        <p className="text-sm font-bold theme-text mb-4 border-b pb-2 uppercase theme-border">Your 4-Week Learning Plan:</p>
                        {aiReport.roadmap?.map((weekData, index) => (
                          <div key={index} className="flex gap-4 opacity-70">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold z-10 shrink-0">{weekData.week}</div>
                              {index !== aiReport.roadmap.length - 1 && <div className="w-0.5 h-full bg-slate-200 -mt-1"></div>}
                            </div>
                            <div className="rounded-xl p-5 shadow-sm w-full mb-4 border theme-surface">
                              <h5 className="font-bold theme-text mb-3">{weekData.focus}</h5>
                              <ul className="space-y-2 mb-4">
                                {weekData.tasks?.map((task, i) => (
                                  <li key={i} className="text-xs theme-text-secondary flex items-start gap-2"><CheckCircle size={14} className="theme-text-secondary mt-0.5 shrink-0 opacity-40" />{task}</li>
                                ))}
                              </ul>
                              {weekData.resources && weekData.resources.length > 0 && (
                                <div className="border-t pt-3 mt-2 theme-border">
                                  <p className="text-[10px] font-bold theme-text-secondary uppercase tracking-widest mb-2 flex items-center gap-1"><BookOpen size={10} /> Free Resources</p>
                                  <div className="space-y-2">
                                    {weekData.resources.map((res, rIdx) => (
                                      <a key={rIdx} href={getSafeResourceUrl(res.url, res.label)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded-lg border transition-all group theme-surface glow-hover">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {res.type === "Video" ? <Play size={12} className="text-red-500 shrink-0" /> : res.type === "Course" ? <BookOpen size={12} className="text-blue-500 shrink-0" /> : <FileText size={12} className="text-green-500 shrink-0" />}
                                          <span className="text-xs font-medium theme-text-secondary truncate">{res.label}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${res.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' : res.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{res.difficulty}</span>
                                          <ExternalLink size={10} className="theme-text-secondary opacity-50" />
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-10 p-6 rounded-2xl border flex flex-col sm:flex-row gap-4 theme-surface">
                        <button onClick={saveRoadmapToProgress} className="flex-1 bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm">
                          <Save size={18} /> Save to My Progress
                        </button>
                        <button onClick={discardRoadmapDraft} className="flex-1 text-red-500 border border-red-200 font-bold py-3 px-4 rounded-xl hover:bg-red-50/10 transition-colors flex items-center justify-center gap-2 theme-surface">
                          <RefreshCw size={18} /> Discard & Try Another
                        </button>
                      </div>
                    </div>
                  ) : extractedSkills ? (
                    <div className="animate-in slide-in-from-bottom-4 duration-500">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-bold theme-text">Step 1: Verify Extracted Skills</h4>
                        <button type="button" onClick={() => setSelectedSkills(selectedSkills.length === extractedSkills.length ? [] : extractedSkills)} className="text-xs font-bold text-indigo-600 hover:underline">
                          {selectedSkills.length === extractedSkills.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-8">
                        {extractedSkills.map((skill, index) => (
                          <button key={index} onClick={() => toggleSkill(skill)} className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all uppercase tracking-tight ${selectedSkills.includes(skill) ? 'text-white border-transparent shadow-md theme-primary-bg' : 'theme-text-secondary border opacity-50 theme-border'}`}>{skill}</button>
                        ))}
                      </div>
                      <div className="p-6 rounded-2xl border border-dashed theme-surface theme-border">
                        <h4 className="text-lg font-bold theme-text mb-2">Step 2: Career Objective</h4>
                        <div className="relative mt-4">
                          <input type="text" value={targetJob} onChange={(e) => setTargetJob(e.target.value)} placeholder="e.g., Cybersecurity Analyst" className="w-full pl-4 pr-12 py-4 rounded-xl border outline-none focus:ring-2 theme-text theme-surface theme-border" style={{ '--tw-ring-color': 'var(--color-accent-hex)' }} />
                          <button onClick={handleFinalAnalysis} className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg"><Send size={20} /></button>
                        </div>
                        <p className={`text-xs mt-3 text-right font-medium ${savedRoadmaps.length >= 3 ? 'text-red-500' : 'theme-text-secondary'}`}>
                          You have {savedRoadmaps.length}/3 roadmaps saved.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-40">
                      <Bot size={64} className="theme-text-secondary mb-4" />
                      <h4 className="text-xl font-bold theme-text">Awaiting Resume</h4>
                      <p className="theme-text-secondary text-sm mt-2 max-w-xs">Upload your file to begin.</p>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: MY PROGRESS */}
              {activeTab === "progress" && (
                <div className="space-y-6 animate-in fade-in duration-500">
                  {savedRoadmaps.length === 0 ? (
                    <div className="text-center py-16 rounded-3xl border border-dashed theme-surface theme-border">
                      <Bot size={48} className="mx-auto theme-text-secondary opacity-30 mb-4" />
                      <p className="theme-text-secondary font-medium text-sm">No active roadmaps found.</p>
                      <button onClick={() => setActiveTab("home")} className="text-indigo-600 text-xs font-bold mt-2 hover:underline">Go to Home to generate one →</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2 overflow-x-auto pb-2 border-b theme-border">
                        {savedRoadmaps.map((r, i) => (
                          <button 
                            key={i} 
                            onClick={() => {
                              setActiveRoadmapIndex(i);
                              setTargetJob(r.target_role); 
                            }}
                            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-all whitespace-nowrap ${activeRoadmapIndex === i ? 'theme-primary border-b-2' : 'theme-text-secondary hover:bg-black/5'}`}
                            style={activeRoadmapIndex === i ? { borderColor: 'var(--color-primary-hex)' } : {}}
                          >
                            {r.target_role}
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const activeData = savedRoadmaps[activeRoadmapIndex];
                        if (!activeData) return null; 
                        const activeRole = activeData.target_role;
                        const totalTasks = activeData.data.roadmap?.reduce((acc, w) => acc + (w.tasks?.length || 0), 0) || 1;
                        
                        const roleCompletedTasks = completedTasks.filter(t => t.target_role === activeRole);
                        const progressPercent = Math.round((roleCompletedTasks.length / totalTasks) * 100);

                        return (
                          <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-6">
                              <div>
                                <h4 className="text-xl font-bold theme-text">{activeRole} Path</h4>
                                <div className="flex items-center gap-3 mt-1">
                                  <button onClick={() => deleteRoadmap(activeRole)} className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors">
                                    <Trash2 size={12}/> Delete
                                  </button>
                                  <ExportPdfButton roadmapData={activeData} userEmail={user?.email} completedTasks={completedTasks} />
                                </div>
                              </div>
                              <span className="font-bold text-sm font-mono px-3 py-1 rounded-full theme-primary" style={{ backgroundColor: 'rgba(var(--color-primary), 0.1)' }}>{progressPercent}% Complete</span>
                            </div>
                            
                            {activeData.data.roadmap?.map((week, wIdx) => (
                              <div key={wIdx} className="rounded-2xl p-5 border mb-6 transition-all theme-surface">
                                <h5 className="font-bold theme-text mb-4 flex items-center gap-2"><CheckCircle size={18} className="theme-primary" /> Week {week.week}: {week.focus}</h5>
                                <div className="grid gap-3">
                                  {week.tasks?.map((task, tIdx) => {
                                    const isDone = roleCompletedTasks.some(t => t.week_number === week.week && t.task_index === tIdx);
                                    return (
                                      <label key={tIdx} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isDone ? 'shadow-sm' : 'hover:opacity-80'} theme-surface`} style={isDone ? { borderColor: 'var(--color-accent-hex)', backgroundColor: 'rgba(var(--color-primary), 0.06)' } : {}}>
                                        <input type="checkbox" checked={isDone} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" onChange={() => toggleTask(week.week, tIdx, isDone, activeRole)} />
                                        <span className={`text-sm transition-all font-medium ${isDone ? 'line-through italic opacity-50' : ''} theme-text`}>{task}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                                {week.resources && week.resources.length > 0 && (
                                  <div className="border-t pt-3 mt-4 theme-border">
                                    <p className="text-[10px] font-bold theme-text-secondary uppercase tracking-widest mb-2 flex items-center gap-1"><BookOpen size={10} /> Free Resources</p>
                                    <div className="space-y-2">
                                      {week.resources.map((res, rIdx) => (
                                        <a key={rIdx} href={getSafeResourceUrl(res.url, res.label)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2.5 rounded-lg border transition-all group theme-surface glow-hover">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {res.type === "Video" ? <Play size={12} className="text-red-500 shrink-0" /> : res.type === "Course" ? <BookOpen size={12} className="text-blue-500 shrink-0" /> : <FileText size={12} className="text-green-500 shrink-0" />}
                                            <span className="text-xs font-medium theme-text-secondary truncate">{res.label}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${res.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' : res.difficulty === 'Intermediate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{res.difficulty}</span>
                                            <ExternalLink size={10} className="theme-text-secondary opacity-50" />
                                          </div>
                                        </a>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {activeTab === "jobs" && <JobBoard targetJob={targetJob} userSkills={extractedSkills || []} />}

              {activeTab === "news" && <IndustryNews targetJob={targetJob} savedRoadmaps={savedRoadmaps} />}

              {activeTab === "settings" && (
                <SettingsPage
                  user={user}
                  onOpenAvatarPicker={() => setShowAvatarPicker(true)}
                  savedRoadmaps={savedRoadmaps}
                  userProfile={userProfile}
                />
              )}

              {/* TAB 5: PROFILE DASHBOARD */}
              {activeTab === "profile" && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white theme-primary-bg">
                      <User size={32} />
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Security & Profile</h4>
                      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Manage your account protection and career preferences</p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Security Status Card */}
                    <div className="p-6 rounded-2xl border space-y-4 theme-surface">
                      <h5 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
                        <ShieldCheck size={18} className="text-green-500" /> Security Status
                      </h5>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-green-500/20 theme-surface">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="text-green-500" size={20} />
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Verified Account</p>
                            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Strong Password Enforced</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-2 border-t theme-border">
                        <p className="text-xs mb-2 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Advanced Protection</p>
                        <button 
                          onClick={enrollMFA}
                          className="w-full text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-sm theme-primary-bg glow-hover hover:opacity-90"
                        >
                          Enable Two-Factor Auth (MFA)
                        </button>
                      </div>
                    </div>

                    {/* Account Info Card */}
                    <div className="p-6 rounded-2xl border space-y-4 theme-surface">
                      <h5 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}><Mail size={18} style={{ color: 'var(--color-primary-hex)' }} /> Account Details</h5>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>Email Address</label>
                        <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{user?.email}</p>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-secondary)' }}>Target IT Role</label>
                        <p className="font-bold" style={{ color: 'var(--color-primary-hex)' }}>{targetJob || "Not set yet"}</p>
                      </div>
                    </div>
                    
                    {/* Professional Status */}
                    <div className="p-6 rounded-2xl border space-y-4 md:col-span-2 theme-surface">
                      <h5 className="font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}><BriefcaseBusiness size={18} style={{ color: 'var(--color-primary-hex)' }} /> Professional Status</h5>
                      <div className="flex flex-wrap gap-4">
                         <div className="px-4 py-2 rounded-lg border text-sm font-bold theme-surface theme-border" style={{ color: 'var(--color-primary-hex)' }}>IT Student (PUP)</div>
                         <div className="px-4 py-2 rounded-lg border text-sm font-bold theme-surface theme-border" style={{ color: 'var(--color-primary-hex)' }}>Professional Quality Analyst</div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div> 
            
            {/* Dynamic Market Demand Sidebar */}
            <div className="p-6 rounded-2xl border shadow-sm h-fit theme-surface">
              <h4 className="text-lg font-bold theme-text mb-6">Live Market Demand</h4>
              
              {!targetJob ? (
                <div className="text-center py-8">
                  <p className="text-sm theme-text-secondary">Select a roadmap to view market insights.</p>
                </div>
              ) : marketLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                  <p className="text-xs theme-text-secondary">Fetching live market data...</p>
                </div>
              ) : marketError ? (
                <div className="text-center py-6 space-y-3">
                  <AlertCircle size={24} className="text-red-400 mx-auto" />
                  <p className="text-sm text-red-600 font-medium">{marketError}</p>
                  <button onClick={() => setMarketError(null)} className="text-xs text-indigo-600 font-bold hover:underline">Retry</button>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="flex justify-between items-center pb-4 border-b theme-border">
                    <div>
                      <p className="text-xs uppercase font-bold tracking-wider mb-1 line-clamp-1 theme-primary">
                        {targetJob}
                      </p>
                      <p className="text-2xl font-bold font-mono theme-text">{marketStats.postings}</p>
                      <p className="text-xs theme-text-secondary font-medium mt-1">Active Postings (PH)</p>
                    </div>
                    <span className="bg-green-100 text-green-700 text-sm font-bold font-mono px-2 py-1 rounded-lg tracking-wider">
                      +{marketStats.growth}%
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold theme-text mb-3">Top Hiring Regions</p>
                    <ul className="space-y-3 text-sm theme-text-secondary">
                      {marketStats.locations.map((loc, index) => (
                        <li key={index} className="flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(var(--color-primary), 0.1)' }}>
                            <MapPin size={12} className="theme-primary" />
                          </div>
                          <span className="font-medium">{loc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      <ProfileSidebar 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        profile={userProfile}
        avatarUrl={avatarUrl}
      />

      <MfaEnrollModal
        isOpen={showMfaModal}
        onClose={() => setShowMfaModal(false)}
        onEnrolled={() => logActivity('MFA Enrollment Completed')}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          <div className="relative w-full max-w-xl">
            <ResumeUpload 
              onUploadComplete={async (filePath, extractedText) => {
                setShowUploadModal(false); 
                setTimeout(async () => {
                  setIsAnalyzing(true);      
                  try {
                    const result = await analyzeResumeWithAI(extractedText, "SKILLS_ONLY");
                    if (result && result.extractedSkills) {
                      setExtractedSkills(result.extractedSkills); 
                    }
                  } catch (error) {
                    if (error.message === "RATE_LIMIT_EXCEEDED") {
                      alert("The AI is a bit overwhelmed! Please wait 60 seconds and try again.");
                    } else {
                      alert("AI processing failed. Please check your internet connection and try again.");
                    }
                  } finally {
                    setIsAnalyzing(false);   
                  }
                }, 300);
              }}
            />
          </div>
        </div>
      )}

      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        userId={user?.id}
        currentAvatar={avatarUrl}
        onAvatarChange={(url) => setAvatarUrl(url)}
      />

      {/* Motivational Feedback Toast */}
      {toastMessage && (
        <div className={`fixed bottom-8 right-8 ${toastMessage.toLowerCase().includes('failed') || toastMessage.toLowerCase().includes('error') || toastMessage.toLowerCase().includes('limit') || toastMessage.toLowerCase().includes('wait') ? 'bg-red-900' : 'bg-gray-900'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50`}>
          {toastMessage.toLowerCase().includes('failed') || toastMessage.toLowerCase().includes('error') || toastMessage.toLowerCase().includes('limit') || toastMessage.toLowerCase().includes('wait') ? <AlertCircle className="text-red-300" size={24} /> : <CheckCircle className="text-green-400" size={24} />}
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
        ? 'font-semibold theme-primary-bg text-white shadow-md nav-active-glow' 
        : 'theme-text-secondary hover:bg-black/5 font-medium'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}