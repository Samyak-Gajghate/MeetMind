'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api, { getErrorMessage } from '@/lib/api';
import Link from 'next/link';

export default function ActionItemsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [draftedEmail, setDraftedEmail] = useState<string | null>(null);

  // Fetch current user details
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    }
  });

  // Fetch action items
  const { data: actionItems, isLoading, isError } = useQuery({
    queryKey: ['action_items'],
    queryFn: async () => {
      const res = await api.get('/action_items');
      return res.data;
    }
  });

  // Mutation to toggle or update action item status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/action_items/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action_items'] });
    }
  });

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'done' ? 'open' : currentStatus === 'open' ? 'in_progress' : 'done';
    updateStatusMutation.mutate({ id, status: nextStatus });
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

  const handleDraftFollowup = () => {
    const overdue = filteredItems.filter((item: any) => item.status !== 'done');
    if (overdue.length === 0) {
      setDraftedEmail("Subject: Sync on Action Items\n\nHi Team,\n\nAll action items are currently up-to-date or completed! Thanks for the great work.\n\nBest,\nMeetMind AI");
      return;
    }

    const tasksList = overdue.map((item: any) => `- ${item.description} (Owner: ${item.owner_name || 'Unassigned'})`).join('\n');
    const emailText = `Subject: Quick Follow-up: Outstanding Action Items

Hi Team,

I wanted to send a quick reminder about the outstanding action items from our recent syncs:

${tasksList}

Please let us know if there are any blockers or if you need assistance to get these wrapped up.

Best regards,
${user?.full_name || 'Product Team'}`;

    setDraftedEmail(emailText);
  };

  // Filter items
  const filteredItems = (actionItems || []).filter((item: any) => {
    const matchesSearch = 
      item.description.toLowerCase().includes(search.toLowerCase()) || 
      (item.owner_name && item.owner_name.toLowerCase().includes(search.toLowerCase())) ||
      (item.meeting_title && item.meeting_title.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchesPriority = selectedPriority === 'all' || item.priority === selectedPriority;

    return matchesSearch && matchesStatus && matchesPriority;
  });

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
          <div className="flex items-center gap-3 px-4 py-2 bg-primary-fixed text-on-primary-fixed font-bold border-l-2 border-primary cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
            <span>Action Items</span>
          </div>
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
            {/* Header Section */}
            <div className="flex flex-col gap-md">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-on-surface">Action Items</h2>
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <span className="font-semibold text-primary">{filteredItems.filter((i: any) => i.status !== 'done').length}</span> Open Tasks
                </div>
              </div>

              {/* Filter Row */}
              <div className="flex flex-wrap items-center gap-sm bg-surface p-1.5 border border-outline-variant rounded-lg shadow-sm">
                {/* Search Box */}
                <div className="relative flex-1 min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                  <input 
                    type="text" 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by owner, description, or meeting..."
                    className="w-full pl-8 pr-3 py-1 bg-transparent border-none text-xs focus:ring-0 placeholder:text-outline text-on-surface outline-none"
                  />
                </div>
                
                <div className="h-6 w-[1px] bg-outline-variant"></div>

                {/* Status Dropdown */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-transparent border-none text-xs font-medium text-on-surface-variant hover:bg-surface-container-low rounded px-2 py-1 cursor-pointer outline-none"
                >
                  <option value="all">Status: All</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>

                {/* Priority Dropdown */}
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-transparent border-none text-xs font-medium text-on-surface-variant hover:bg-surface-container-low rounded px-2 py-1 cursor-pointer outline-none"
                >
                  <option value="all">Priority: All</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Table Container */}
            {isLoading ? (
              <div className="flex justify-center items-center py-20 bg-surface rounded-xl border border-outline-variant">
                 <div className="animate-pulse flex flex-col items-center">
                     <div className="h-10 w-10 bg-primary-fixed-dim rounded-full mb-3 flex items-center justify-center">
                       <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                     </div>
                     <div className="text-on-surface-variant text-sm font-medium">Loading action items...</div>
                 </div>
              </div>
            ) : isError ? (
              <div className="text-error bg-error-container/20 p-5 rounded-xl border border-error-container font-medium flex items-center shadow-sm">
                 <span className="material-symbols-outlined mr-3 text-error">warning</span>
                 Failed to load action items.
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="bg-surface p-16 text-center rounded-xl border border-outline-variant shadow-sm flex flex-col items-center justify-center">
                <div className="mx-auto w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mb-4 text-outline">
                  <span className="material-symbols-outlined text-2xl">checklist</span>
                </div>
                <h3 className="text-lg font-medium text-on-surface mb-1">No action items found</h3>
                <p className="text-xs text-on-surface-variant">Adjust your filters or add a new meeting to extract action items.</p>
              </div>
            ) : (
              <div className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                        <th className="py-3 px-md w-[48px]">#</th>
                        <th className="py-3 px-md">Description</th>
                        <th className="py-3 px-md">Owner</th>
                        <th className="py-3 px-md">Meeting</th>
                        <th className="py-3 px-md">Due Date</th>
                        <th className="py-3 px-md">Priority</th>
                        <th className="py-3 px-md">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {filteredItems.map((item: any, idx: number) => (
                        <tr 
                          key={item.id} 
                          className="hover:bg-surface-container-low/40 transition-colors group cursor-pointer"
                          onClick={() => handleToggleStatus(item.id, item.status)}
                        >
                          <td className="py-3 px-md text-xs text-outline font-mono">
                            AI-{idx + 1}
                          </td>
                          <td className="py-3 px-md">
                            <div className="flex flex-col">
                              <span className={`text-xs font-medium text-on-surface transition-all ${
                                item.status === 'done' ? 'line-through opacity-50' : ''
                              }`}>
                                {item.description}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-md" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${getAvatarColor(item.owner_name || 'Unassigned')}`}>
                                {getInitials(item.owner_name || 'Unassigned')}
                              </div>
                              <span className="text-xs text-on-surface-variant">{item.owner_name || 'Unassigned'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-md" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/meetings/${item.meeting_id}`} className="text-primary hover:underline text-xs">
                              {item.meeting_title || 'Meeting Link'}
                            </Link>
                          </td>
                          <td className="py-3 px-md text-xs text-on-surface-variant">
                            {item.due_date ? new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date'}
                          </td>
                          <td className="py-3 px-md">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                              item.priority === 'high' 
                                ? 'bg-error-container/20 text-error' 
                                : item.priority === 'medium'
                                ? 'bg-surface-container-highest text-on-surface-variant'
                                : 'bg-surface-container-low text-outline'
                            }`}>
                              {item.priority}
                            </span>
                          </td>
                          <td className="py-3 px-md" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleToggleStatus(item.id, item.status)}
                              className="flex items-center gap-1.5 hover:text-primary transition-colors text-left"
                            >
                              {item.status === 'done' ? (
                                <>
                                  <span className="material-symbols-outlined text-[16px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                                  <span className="text-xs text-on-surface-variant font-medium">Done</span>
                                </>
                              ) : item.status === 'in_progress' ? (
                                <>
                                  <span className="material-symbols-outlined text-[16px] text-amber-500">pending</span>
                                  <span className="text-xs text-on-surface-variant font-medium">In Progress</span>
                                </>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined text-[16px] text-outline">radio_button_unchecked</span>
                                  <span className="text-xs text-on-surface-variant font-medium">Open</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="py-3 px-md flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest text-xs text-on-surface-variant">
                  <div>
                    Showing <span className="font-semibold text-on-surface">{filteredItems.length}</span> of <span className="font-semibold text-on-surface">{filteredItems.length}</span> tasks
                  </div>
                </div>
              </div>
            )}

            {/* Asymmetric / Bento-lite Insights Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
              {/* Velocity chart */}
              <div className="md:col-span-2 bg-surface border border-outline-variant rounded-xl p-lg flex flex-col gap-md relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.02] pointer-events-none">
                  <span className="material-symbols-outlined text-[120px] rotate-12 text-primary">monitoring</span>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-on-surface">Velocity Over Time</h3>
                  <span className="text-[10px] text-primary font-bold bg-primary-fixed px-2 py-0.5 rounded">Last 30 Days</span>
                </div>
                <div className="flex-1 flex items-end gap-3 min-h-[120px] pt-4">
                  <div className="flex-1 bg-surface-container h-[40%] rounded-t"></div>
                  <div className="flex-1 bg-surface-container h-[60%] rounded-t"></div>
                  <div className="flex-1 bg-primary h-[85%] rounded-t"></div>
                  <div className="flex-1 bg-surface-container h-[35%] rounded-t"></div>
                  <div className="flex-1 bg-surface-container h-[55%] rounded-t"></div>
                  <div className="flex-1 bg-primary h-[95%] rounded-t"></div>
                  <div className="flex-1 bg-surface-container h-[45%] rounded-t"></div>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Your team's completion rate is up <span className="text-primary font-bold">14%</span> since last week. Keep it up!
                </p>
              </div>

              {/* AI Assistant card */}
              <div className="bg-primary text-on-primary rounded-xl p-lg flex flex-col justify-between shadow-md">
                <div className="flex flex-col gap-xs">
                  <span className="material-symbols-outlined text-[28px]">bolt</span>
                  <h3 className="text-sm font-semibold text-white mt-1">AI Assistant</h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    I've aggregated your outstanding action items. Would you like me to draft a follow-up email to notify the team?
                  </p>
                </div>
                <button 
                  onClick={handleDraftFollowup}
                  className="mt-lg w-full py-2 bg-white text-primary rounded font-bold text-xs hover:bg-primary-fixed transition-colors transition-transform active:scale-95"
                >
                  Draft Follow-up
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Follow-up email dialog */}
      {draftedEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-xs" onClick={() => setDraftedEmail(null)}></div>
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg w-full max-w-lg overflow-hidden transform transition-all relative z-10 p-lg flex flex-col gap-md">
            <div className="flex justify-between items-center border-b border-outline-variant/60 pb-2">
              <h3 className="text-sm font-semibold text-on-surface">AI-Generated Email Draft</h3>
              <button onClick={() => setDraftedEmail(null)} className="text-on-surface-variant hover:text-on-surface inline-flex p-1">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <textarea 
              readOnly 
              value={draftedEmail}
              className="w-full h-64 text-xs font-mono p-3 bg-surface-container-low border border-outline-variant rounded-md focus:outline-none resize-none text-on-surface"
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(draftedEmail);
                  alert('Email copied to clipboard!');
                }}
                className="text-xs bg-primary text-on-primary px-3 py-1.5 rounded font-semibold hover:opacity-95"
              >
                Copy to Clipboard
              </button>
              <button 
                onClick={() => setDraftedEmail(null)}
                className="text-xs border border-outline-variant hover:bg-surface-container-low px-3 py-1.5 rounded font-semibold text-on-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
