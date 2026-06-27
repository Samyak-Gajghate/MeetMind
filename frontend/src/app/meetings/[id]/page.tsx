'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch current user details
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    }
  });

  // Fetch meeting intelligence
  const { data: meeting, isLoading, isError } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const res = await api.get(`/meetings/${id}`);
      return res.data;
    }
  });

  // Mutation to update action item status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await api.patch(`/action_items/${itemId}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    }
  });

  const handleStatusChange = (itemId: string, nextStatus: string) => {
    updateStatusMutation.mutate({ itemId, status: nextStatus });
  };

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    router.replace('/login');
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-purple-100 text-purple-700',
    'bg-rose-100 text-rose-700',
    'bg-indigo-100 text-indigo-700'
  ];

  const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-ui-default text-on-surface">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-10 w-10 bg-primary-fixed-dim rounded-full mb-3 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary animate-spin">sync</span>
          </div>
          <div className="text-on-surface-variant text-sm font-medium">Extracting meeting intelligence...</div>
        </div>
      </div>
    );
  }

  if (isError || !meeting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-ui-default text-on-surface p-4">
        <div className="text-error bg-error-container/20 p-5 rounded-xl border border-error-container font-medium flex items-center shadow-sm max-w-md">
          <span className="material-symbols-outlined mr-3 text-error">warning</span>
          Failed to load meeting details. Please return to the dashboard.
        </div>
      </div>
    );
  }

  const showExpandButton = meeting.summary && meeting.summary.length > 300;
  const displayedSummary = showExpandButton && !isExpanded 
    ? `${meeting.summary.slice(0, 300)}...` 
    : meeting.summary;

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
          <Link href="/search" className="flex items-center gap-3 px-4 py-2 text-on-surface-variant hover:bg-surface-container-low cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined">search</span>
            <span>Search</span>
          </Link>
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
        <div className="flex-1 overflow-y-auto px-lg py-xl">
          <div className="max-w-[1000px] mx-auto space-y-lg">
            
            {/* Breadcrumb & Header */}
            <div>
              <nav className="flex items-center gap-2 text-[11px] text-on-surface-variant mb-2">
                <Link className="hover:text-primary hover:underline" href="/dashboard">Dashboard</Link>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span className="text-on-surface font-medium">{meeting.title}</span>
              </nav>

              <div className="flex flex-col md:flex-row md:items-end justify-between gap-md">
                <div>
                  <div className="flex items-center gap-sm mb-2">
                    <h2 className="text-2xl font-semibold text-on-surface tracking-tight">{meeting.title}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      meeting.status === 'processed' 
                        ? 'bg-green-100 text-green-700 border-green-200' 
                        : meeting.status === 'failed'
                        ? 'bg-error-container text-on-error-container border-error/20'
                        : 'bg-secondary-container text-on-secondary-container border-outline-variant'
                    }`}>
                      {meeting.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-sm">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {new Date(meeting.meeting_date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[14px]">schedule</span>
                      {meeting.duration_minutes} mins
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-on-surface-variant text-[11px] font-medium">
                      <span className="material-symbols-outlined text-[14px]">group</span>
                      {meeting.participant_names.length} Participants
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95">
                    <span className="material-symbols-outlined text-xs">share</span>
                    Share
                  </button>
                  <button className="flex items-center gap-1.5 px-4 py-2 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors active:scale-95">
                    <span className="material-symbols-outlined text-xs">download</span>
                    Export
                  </button>
                </div>
              </div>
            </div>

            {/* Bento Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-lg items-stretch">
              
              {/* Left Column: Summary & Decisions */}
              <div className="lg:col-span-7 space-y-lg flex flex-col">
                
                {/* Summary Card */}
                <section className="bg-surface border border-outline-variant rounded-xl p-lg shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-md">
                      <h3 className="text-sm font-semibold text-on-surface">Executive Summary</h3>
                      <button className="text-primary text-xs font-semibold hover:underline">Edit</button>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">
                      {displayedSummary || 'Summary is actively being generated by MeetMind AI...'}
                    </p>
                  </div>
                  {showExpandButton && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="flex items-center gap-1 text-primary font-bold text-xs mt-4 hover:opacity-80 transition-opacity w-fit"
                    >
                      <span>{isExpanded ? 'Show less' : 'Show more'}</span>
                      <span className={`material-symbols-outlined transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                  )}
                </section>

                {/* Key Decisions Card */}
                <section className="bg-surface border border-outline-variant rounded-xl p-lg shadow-sm flex-1">
                  <h3 className="text-sm font-semibold text-on-surface mb-lg">Key Decisions</h3>
                  {meeting.decisions && meeting.decisions.length > 0 ? (
                    <div className="space-y-md">
                      {meeting.decisions.map((d: any, index: number) => (
                        <div key={d.id} className="flex gap-md group">
                          <div className="flex-none w-[4px] bg-primary rounded-full transition-all group-hover:w-[6px]"></div>
                          <div className="py-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-primary uppercase">Decision {String(index + 1).padStart(2, '0')}</span>
                            </div>
                            <p className="text-xs font-medium text-on-surface">{d.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-outline italic">No decisions extracted from this discussion.</div>
                  )}
                </section>
              </div>

              {/* Right Column: Action Items */}
              <div className="lg:col-span-5 flex flex-col">
                <section className="bg-surface border border-outline-variant rounded-xl shadow-sm h-full flex flex-col justify-between">
                  <div>
                    <div className="p-lg border-b border-outline-variant flex items-center justify-between bg-surface-container-low rounded-t-xl">
                      <div>
                        <h3 className="text-sm font-semibold text-on-surface">Action Items</h3>
                        <p className="text-[10px] text-on-surface-variant font-medium">
                          {meeting.action_items?.length || 0} Tasks Assigned
                        </p>
                      </div>
                      <button className="p-1.5 bg-surface border border-outline-variant rounded-lg hover:bg-surface-container transition-colors">
                        <span className="material-symbols-outlined text-[16px]">filter_list</span>
                      </button>
                    </div>

                    {/* Action List */}
                    <div className="divide-y divide-outline-variant">
                      {meeting.action_items && meeting.action_items.length > 0 ? (
                        meeting.action_items.map((ai: any) => (
                          <div key={ai.id} className="p-md hover:bg-surface-container-lowest transition-colors flex flex-col gap-xs group">
                            <div className="flex items-start justify-between gap-md">
                              <div className="flex items-center gap-2">
                                <span className={`px-1.5 py-0.2 text-[8px] font-bold rounded uppercase ${
                                  ai.priority === 'high' 
                                    ? 'bg-error-container/20 text-error' 
                                    : ai.priority === 'medium'
                                    ? 'bg-surface-container-highest text-on-surface-variant'
                                    : 'bg-surface-container-low text-outline'
                                }`}>
                                  {ai.priority.slice(0, 3)}
                                </span>
                                <h4 className={`text-xs font-semibold text-on-surface group-hover:text-primary transition-colors ${
                                  ai.status === 'done' ? 'line-through opacity-50' : ''
                                }`}>
                                  {ai.description}
                                </h4>
                              </div>
                              
                              {/* Inline Editable Status Dropdown */}
                              <div className="relative shrink-0 select-none">
                                <select 
                                  value={ai.status}
                                  onChange={(e) => handleStatusChange(ai.id, e.target.value)}
                                  className="appearance-none bg-transparent text-[10px] font-bold text-primary-fixed-variant pr-5 outline-none cursor-pointer border-none py-0 focus:ring-0"
                                >
                                  <option value="open">Open</option>
                                  <option value="in_progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                                <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-xs pointer-events-none text-outline">expand_more</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(ai.owner_name || 'Unassigned')}`}>
                                  {getInitials(ai.owner_name || 'Unassigned')}
                                </div>
                                <span className="text-[10px] text-on-surface-variant">{ai.owner_name || 'Unassigned'}</span>
                              </div>
                              <div className={`flex items-center gap-1 text-[10px] ${
                                ai.status === 'done' ? 'text-green-600 line-through' : 'text-on-surface-variant'
                              }`}>
                                <span className="material-symbols-outlined text-[12px]">{ai.status === 'done' ? 'check_circle' : 'event'}</span>
                                {ai.due_date ? new Date(ai.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center text-xs text-outline italic">No action items assigned.</div>
                      )}
                    </div>
                  </div>

                  {/* Add action item footer */}
                  <div className="p-md bg-surface-container-lowest rounded-b-xl border-t border-outline-variant mt-auto">
                    <button className="w-full py-1.5 flex items-center justify-center gap-2 text-primary font-bold text-xs hover:bg-primary-fixed rounded-lg transition-colors active:scale-95">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Add Action Item
                    </button>
                  </div>
                </section>
              </div>

            </div>

            {/* Footer Metadata */}
            <footer className="pt-lg border-t border-outline-variant flex flex-col md:flex-row items-center justify-between gap-md opacity-60 hover:opacity-100 transition-opacity">
              <div className="text-[10px] text-outline">
                Recorded and synthesized via MeetMind AI • Transcript ID: {meeting.id.slice(0, 8).toUpperCase()}
              </div>
              <div className="flex items-center gap-sm text-outline">
                <span className="text-[10px]">Connected Destinations:</span>
                <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-primary" title="Slack">chat</span>
                <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-primary" title="Jira">task_alt</span>
                <span className="material-symbols-outlined text-[16px] cursor-pointer hover:text-primary" title="Notion">note_stack</span>
              </div>
            </footer>

          </div>
        </div>
      </main>
    </div>
  );
}
