import React, { useState, useEffect, useRef } from 'react';
import { Newspaper, Briefcase, ExternalLink, RefreshCw, AlertCircle, Zap, Heart } from 'lucide-react';

const NEWS_CACHE = {};
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

const SkeletonArticle = () => (
  <div className="p-4 rounded-xl border theme-surface animate-pulse">
    <div className="flex gap-4">
      <div className="w-24 h-20 rounded-lg shrink-0" style={{ backgroundColor: 'var(--color-surface-border)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-4 rounded w-3/4" style={{ backgroundColor: 'var(--color-surface-border)' }} />
        <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--color-surface-border)' }} />
        <div className="h-3 rounded w-full" style={{ backgroundColor: 'var(--color-surface-border)' }} />
      </div>
    </div>
  </div>
);

// Map career keywords to Dev.to tags
const keywordToTags = (keywords) => {
  const tagMap = {
    'cybersecurity': 'security',
    'web developer': 'webdev',
    'web development': 'webdev',
    'frontend': 'javascript',
    'front-end': 'javascript',
    'backend': 'backend',
    'back-end': 'backend',
    'data scientist': 'datascience',
    'data analyst': 'datascience',
    'machine learning': 'machinelearning',
    'devops': 'devops',
    'cloud': 'cloud',
    'mobile': 'mobile',
    'react': 'react',
    'python': 'python',
    'java': 'java',
    'ai': 'ai',
    'software engineer': 'programming',
    'full stack': 'fullstack',
    'quality assurance': 'testing',
    'qa': 'testing',
    'network': 'networking',
    'database': 'database',
  };
  
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    for (const [key, tag] of Object.entries(tagMap)) {
      if (lower.includes(key)) return tag;
    }
  }
  return 'career';
};

export default function IndustryNews({ targetJob, savedRoadmaps = [] }) {
  const [activeTab, setActiveTab] = useState('tech');
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchIdRef = useRef(0);

  const careerKeywords = [...new Set([
    targetJob,
    ...savedRoadmaps.map(r => r.target_role)
  ].filter(Boolean))];

  useEffect(() => {
    const fetchNews = async () => {
      const tag = activeTab === 'tech'
        ? 'technology'
        : keywordToTags(careerKeywords);

      const cacheKey = `devto-${activeTab}-${tag}`;
      const cached = NEWS_CACHE[cacheKey];
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setArticles(cached.data);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const currentFetchId = ++fetchIdRef.current;

      try {
        const url = `https://dev.to/api/articles?tag=${tag}&per_page=12&top=7`;
        const response = await fetch(url);

        if (currentFetchId !== fetchIdRef.current) return;

        if (!response.ok) throw new Error('NETWORK_ERROR');

        const data = await response.json();
        const items = data.map(a => ({
          title: a.title,
          description: a.description,
          url: a.url,
          image: a.cover_image || a.social_image,
          source: a.user?.name || 'Dev.to',
          publishedAt: a.published_at,
          reactions: a.positive_reactions_count,
          readTime: a.reading_time_minutes,
          tags: a.tag_list || [],
        }));

        NEWS_CACHE[cacheKey] = { data: items, timestamp: Date.now() };
        setArticles(items);
      } catch (err) {
        if (currentFetchId !== fetchIdRef.current) return;
        console.error('News fetch error:', err);
        setError(err.message);
      } finally {
        if (currentFetchId === fetchIdRef.current) setLoading(false);
      }
    };

    fetchNews();
  }, [activeTab, careerKeywords.join(',')]);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h4 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>Industry News</h4>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Trending articles from the dev community — no API key needed</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-black/5">
        <button
          onClick={() => setActiveTab('tech')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'tech' ? 'theme-primary-bg text-white shadow-md' : 'theme-text-secondary hover:bg-black/5'
          }`}
        >
          <Newspaper size={16} /> Tech Pulse
        </button>
        <button
          onClick={() => setActiveTab('career')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'career' ? 'theme-primary-bg text-white shadow-md' : 'theme-text-secondary hover:bg-black/5'
          }`}
        >
          <Briefcase size={16} /> My Career Feed
        </button>
      </div>

      {activeTab === 'career' && careerKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {careerKeywords.map((kw, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full theme-primary-bg text-white">
              <Zap size={10} /> {kw}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <SkeletonArticle />
          <SkeletonArticle />
          <SkeletonArticle />
          <SkeletonArticle />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50/50 flex items-start gap-4">
          <AlertCircle size={24} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <h5 className="font-bold text-red-800">Connection Error</h5>
            <p className="text-sm text-red-600 mt-1">Could not load articles. Check your internet connection.</p>
            <button onClick={() => { setError(null); setLoading(true); }} className="mt-3 flex items-center gap-1 text-sm font-bold hover:underline theme-primary">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed theme-border">
          <Newspaper size={48} className="mx-auto theme-text-secondary opacity-30 mb-4" />
          <p className="theme-text-secondary text-sm">No articles found. Try refreshing later.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {articles.map((article, i) => (
            <a
              key={i}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-4 p-4 rounded-xl border transition-all hover:shadow-md group theme-surface glow-hover"
            >
              {article.image && (
                <img
                  src={article.image}
                  alt=""
                  className="w-24 h-20 sm:w-32 sm:h-24 object-cover rounded-lg shrink-0"
                  style={{ backgroundColor: 'var(--color-surface-border)' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-sm transition-colors line-clamp-2" style={{ color: 'var(--color-text-primary)' }}>
                  {article.title}
                </h5>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] flex-wrap" style={{ color: 'var(--color-text-secondary)' }}>
                  <span className="font-bold">{article.source}</span>
                  <span>•</span>
                  <span>{formatDate(article.publishedAt)}</span>
                  {article.readTime > 0 && <><span>•</span><span>{article.readTime} min read</span></>}
                  {article.reactions > 0 && (
                    <span className="flex items-center gap-0.5"><Heart size={10} className="text-red-400" /> {article.reactions}</span>
                  )}
                </div>
                <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>{article.description}</p>
                {article.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {article.tags.slice(0, 3).map((tag, ti) => (
                      <span key={ti} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: 'var(--color-primary-hex)', backgroundColor: 'rgba(var(--color-primary), 0.1)' }}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <ExternalLink size={16} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-1" style={{ color: 'var(--color-text-secondary)' }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
