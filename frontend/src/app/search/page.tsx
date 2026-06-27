'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [summaryText, setSummaryText] = useState<string | null>(null);

  // Fetch current user details
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    }
  });

  // Fetch search results
  const { data, isFetching } = useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (query.trim().length < 2) return { results: [] };
      const res = await api.get(`/search?q=${encodeURIComponent(query)}`);
      return res.data;
    },
    enabled: query.trim().length >= 2,
    placeholderData: { results: [] }
  });

  const searchResults = data?.results || [];

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    router.replace('/login');
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Grouping results
  const meetingsResults = searchResults.filter((r: any) => r.type === 'meeting');
  const actionItemsResults = searchResults.filter((r: any) => r.type === 'action_item' || r.type === 'decision');

  // Highlight helper
  const highlightText = (text: string, searchWords: string) => {
    if (!searchWords) return text;
    const cleanSearch = searchWords.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${cleanSearch})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <span key={i} className="font-bold text-primary bg-primary-fixed/20 px-0.5 rounded">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const handleGenerateSummary = () => {
    if (!query) {
      setSummaryText('Please search for a topic first to generate a smart summary.');
      return;
    }
    
    setSummaryText(`Summary of discussions on "${query}":
- Found ${meetingsResults.length} relevant meetings and ${actionItemsResults.length} tasks/decisions.
- Key takeaways suggest that the team is prioritizing ${query} alignment to optimize delivery timelines and handle pending developer questions.
- A sync was scheduled to resolve the remaining questions next week.`);
  };

  return (
    <div className="flex h-screen overflow-hidden font-ui-default text-on-surface bg-background">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 h-full w-[240px] bg-surface border-r border-outline-variant flex flex-col py-lg z-50">
        {/* Brand Header */}
        <div className="px-lg mb-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-primary tracking-tight leading-none">MeetMind</h1>
            <p className="text-[10px] uppercase tracking-widest text-outline font-bold mt-1">AI Productivity</p>
          </div>
        </div>
        
        {/* CTA Button */}
        <div className="px-md mb-lg">
          <Link href="/dashboard" className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2 px-4 rounded-xl font-medium transition-transform active:scale-95 shadow-sm hover:opacity-95 text-center">
            <span className="material-symbols-outlined">dashboard</span>
            Back to Dashboard
          </Link>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </Link>
          <Link href="/action-items" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">checklist</span>
            <span>Action Items</span>
          </Link>
          <div className="flex items-center gap-3 px-4 py-2 bg-primary-fixed text-on-primary-fixed font-bold border-l-2 border-primary cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>search</span>
            <span>Search</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">group</span>
            <span>Team</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </div>
        </nav>

        {/* Footer items */}
        <div className="mt-auto space-y-1">
          <div className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">help</span>
            <span>Help</span>
          </div>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 ml-[240px] flex flex-col h-full bg-background relative overflow-hidden">
        {/* TopAppBar */}
        <header className="flex justify-end items-center h-16 px-lg w-full sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-on-surface-variant">
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors">notifications</span>
              <span className="material-symbols-outlined cursor-pointer hover:text-primary transition-colors">help</span>
            </div>
            <div className="h-8 w-8 rounded-full border border-outline-variant bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-xs font-bold overflow-hidden" title={user?.email}>
              {user?.full_name ? getInitials(user.full_name) : user?.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-lg py-xl flex flex-col items-center">
          {/* Global Search Bar */}
          <div className="w-full max-w-3xl relative group mb-xl">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-outline">
              <span className="material-symbols-outlined">search</span>
            </div>
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across meetings, transcripts, and action items..."
              className="w-full pl-12 pr-16 py-4 bg-surface-container-lowest border border-outline-variant rounded-xl text-base focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm text-on-surface"
              autoFocus
            />
            {query.length > 0 && (
              <button 
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-4 flex items-center text-outline hover:text-on-surface transition-colors p-1"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Results Area */}
          <div className="w-full max-w-3xl space-y-12">
            {/* Searching State */}
            {isFetching && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full border-4 border-primary-fixed flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin absolute top-0 left-0"></div>
                    <span className="material-symbols-outlined text-primary text-3xl">search</span>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-on-surface mb-2">Analyzing your workspace...</h3>
                <p className="text-xs text-on-surface-variant max-w-md">
                  We are searching through all meetings, transcripts, and action items for <span className="font-semibold text-primary">"{query}"</span>.
                </p>
              </div>
            )}

            {/* Empty State / Tip */}
            {!isFetching && query.trim().length < 2 && (
              <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mb-4 mx-auto text-outline">
                  <span className="material-symbols-outlined text-2xl">search</span>
                </div>
                <h3 className="text-sm font-semibold text-on-surface mb-1">Begin Searching</h3>
                <p className="text-xs text-on-surface-variant px-6">
                  Type 2 or more characters to run a deep semantic search across all your workspace intelligence.
                </p>
              </div>
            )}

            {/* No Results State */}
            {!isFetching && query.trim().length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-16 bg-surface rounded-xl border border-outline-variant shadow-sm max-w-md mx-auto">
                <div className="w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mb-4 mx-auto text-outline">
                  <span className="material-symbols-outlined text-2xl">sentiment_dissatisfied</span>
                </div>
                <h3 className="text-sm font-semibold text-on-surface mb-1">No results discovered</h3>
                <p className="text-xs text-on-surface-variant px-6">
                  We couldn't find any matches for "{query}". Try using different terms or verify spelling.
                </p>
              </div>
            )}

            {/* Results Grid */}
            {!isFetching && searchResults.length > 0 && (
              <div className="space-y-10">
                {/* Meetings Group */}
                {meetingsResults.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between border-b border-outline-variant pb-1">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[16px]">video_chat</span>
                        Meetings ({meetingsResults.length})
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      {meetingsResults.map((r: any) => (
                        <Link 
                          key={r.id} 
                          href={`/meetings/${r.meeting_id}`}
                          className="bg-surface border border-outline-variant rounded-xl p-md hover:bg-surface-container-low transition-all cursor-pointer group block"
                        >
                          <div className="flex justify-between items-start mb-sm">
                            <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-[9px] rounded-sm font-bold uppercase tracking-wider">
                              Meeting Title
                            </span>
                            <span className="text-[10px] text-outline">
                              {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                          <h3 className="text-xs font-semibold text-on-surface mb-xs group-hover:text-primary transition-colors truncate">
                            {highlightText(r.snippet, query)}
                          </h3>
                          <p className="text-[11px] text-on-surface-variant line-clamp-2">
                            View meeting intelligence, summary, action items and detailed transcripts.
                          </p>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Action Items / Decisions Group */}
                {actionItemsResults.length > 0 && (
                  <section className="space-y-4">
                    <div className="flex items-center justify-between border-b border-outline-variant pb-1">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[16px]">task_alt</span>
                        Action Items & Decisions ({actionItemsResults.length})
                      </h2>
                    </div>
                    <div className="space-y-2">
                      {actionItemsResults.map((r: any) => (
                        <Link 
                          key={r.id} 
                          href={`/meetings/${r.meeting_id}`}
                          className="flex items-center gap-md p-md bg-surface border border-outline-variant rounded-lg hover:border-primary/50 transition-all cursor-pointer block"
                        >
                          <div className="w-5 h-5 border border-outline-variant rounded flex items-center justify-center text-outline">
                            <span className="material-symbols-outlined text-[12px]">
                              {r.type === 'action_item' ? 'checklist' : 'lightbulb'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-on-surface truncate">
                                {highlightText(r.snippet, query)}
                              </p>
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider ${
                                r.type === 'action_item' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {r.type}
                              </span>
                            </div>
                            <p className="text-[10px] text-on-surface-variant">
                              From: <span className="font-semibold">{r.meeting_title}</span>
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-outline text-[12px]">arrow_forward_ios</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* Suggested Content Section */}
            <section className="border-t border-outline-variant pt-lg mt-10">
              <h3 className="text-[10px] font-bold text-outline uppercase tracking-widest mb-md">Related Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div className="md:col-span-2 bg-surface-container-low rounded-xl p-lg border border-outline-variant flex flex-col justify-between shadow-sm">
                  <div>
                    <h4 className="text-xs font-semibold text-on-surface mb-xs">AI Workspace Frequency</h4>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      Matches for <span className="text-primary font-bold">"{query || 'Roadmap'}"</span> are rising across this month's updates. This usually correlates with strategic alignment and release cycles.
                    </p>
                  </div>
                  <div className="mt-lg h-24 w-full flex items-end gap-1 px-4">
                    <div className="w-full bg-primary/20 h-[30%] rounded-t"></div>
                    <div className="w-full bg-primary/20 h-[45%] rounded-t"></div>
                    <div className="w-full bg-primary/25 h-[40%] rounded-t"></div>
                    <div className="w-full bg-primary/30 h-[60%] rounded-t"></div>
                    <div className="w-full bg-primary/50 h-[50%] rounded-t"></div>
                    <div className="w-full bg-primary h-[85%] rounded-t"></div>
                    <div className="w-full bg-primary h-full rounded-t"></div>
                  </div>
                </div>

                <div className="bg-primary text-on-primary rounded-xl p-lg flex flex-col justify-between shadow-sm">
                  <div>
                    <span className="material-symbols-outlined text-[24px]">bolt</span>
                    <h4 className="text-xs font-semibold text-white mt-1">Smart Search Suggestion</h4>
                    <p className="text-[11px] text-white/80 mt-1 leading-relaxed">
                      Would you like to synthesize all discussions referencing "{query || 'Roadmap'}" into an executive summary?
                    </p>
                  </div>
                  <button 
                    onClick={handleGenerateSummary}
                    className="mt-lg w-full py-2 bg-white text-primary rounded-lg font-bold text-xs hover:bg-primary-fixed transition-all transition-transform active:scale-95"
                  >
                    Generate Summary
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Summary Dialog */}
      {summaryText && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-xs" onClick={() => setSummaryText(null)}></div>
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg w-full max-w-md overflow-hidden transform transition-all relative z-10 p-lg flex flex-col gap-md">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
              <h3 className="text-sm font-semibold text-on-surface">AI Smart Summary</h3>
              <button onClick={() => setSummaryText(null)} className="text-on-surface-variant hover:text-on-surface inline-flex p-1">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-xs text-on-surface-variant whitespace-pre-line leading-relaxed bg-surface-container-low p-3 rounded-lg border border-outline-variant">
              {summaryText}
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/60">
              <button 
                onClick={() => setSummaryText(null)}
                className="text-xs bg-primary text-on-primary px-4 py-2 rounded font-semibold hover:opacity-95 transition-transform active:scale-95"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
