'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api, { getErrorMessage } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'processing' | 'processed' | 'failed'>('all');

  // Form fields for new meeting transcript upload
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('30');
  const [participants, setParticipants] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [uploadStep, setUploadStep] = useState(0); // 0: idle, 1: metadata, 2: uploading, 3: processing, 4: complete
  const [uploadError, setUploadError] = useState('');

  // Fetch current user details
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    }
  });

  // Fetch meetings
  const { data: meetings, isLoading, isError } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const res = await api.get('/meetings');
      return res.data;
    }
  });

  const resetForm = () => {
    setTitle('');
    setMeetingDate(new Date().toISOString().split('T')[0]);
    setDuration('30');
    setParticipants('');
    setFile(null);
    setUploadStep(0);
    setUploadError('');
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user?.workspace_id) {
      setUploadError('Missing file or user context.');
      return;
    }

    if (!file.name.endsWith('.txt')) {
      setUploadError('Only plain text (.txt) files are accepted.');
      return;
    }

    setUploadError('');
    setUploadStep(1); // Creating meeting record

    try {
      const participantNames = participants
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      // 1. Create meeting record in backend
      const createResponse = await api.post('/meetings', {
        workspace_id: user.workspace_id,
        title,
        meeting_date: meetingDate,
        duration_minutes: parseInt(duration, 10) || 0,
        participant_names: participantNames,
        filename: file.name
      });

      const { meeting, upload_url, upload_token } = createResponse.data;

      // 2. Upload file to Supabase storage URL
      setUploadStep(2); // Uploading file

      const uploadHeaders: Record<string, string> = {
        'Content-Type': 'text/plain',
      };
      if (upload_token) {
        uploadHeaders['Authorization'] = `Bearer ${upload_token}`;
      }

      const uploadResponse = await fetch(upload_url, {
        method: 'POST',
        headers: uploadHeaders,
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage bucket.');
      }

      // 3. Trigger processing
      setUploadStep(3); // Triggering AI processing

      await api.post(`/meetings/${meeting.id}/process`);

      setUploadStep(4); // Done
      
      // Refresh meetings list
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      
      // Close modal and reset form
      setTimeout(() => {
        setIsUploadOpen(false);
        resetForm();
      }, 1200);

    } catch (err: any) {
      setUploadStep(0);
      setUploadError(getErrorMessage(err, 'Failed to complete upload and processing.'));
    }
  };

  const handleRetryProcess = async (meetingId: string) => {
    try {
      await api.post(`/meetings/${meetingId}/process`);
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    } catch (err: any) {
      console.error('Failed to retry processing:', err);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('access_token');
    router.replace('/login');
  };

  const getInitials = (name: string) => {
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

  // Filter meetings
  const filteredMeetings = meetings?.filter((m: any) => {
    if (filter === 'all') return true;
    return m.status === filter;
  }) || [];

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
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-2 px-4 rounded-xl font-medium transition-transform active:scale-95 shadow-sm hover:opacity-95"
          >
            <span className="material-symbols-outlined">add</span>
            New Meeting
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 space-y-1">
          <div className="flex items-center gap-3 px-4 py-2 bg-primary-fixed text-on-primary-fixed font-bold border-l-2 border-primary cursor-pointer active:scale-95 transition-all">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
            <span>Dashboard</span>
          </div>
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
            <button 
              onClick={() => setIsUploadOpen(true)}
              className="bg-primary text-on-primary text-sm font-medium px-4 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
            >
              Upload Transcript
            </button>
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
          <div className="max-w-[1000px] mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-xl">
              <div>
                <h2 className="text-2xl font-semibold text-on-surface tracking-tight">Meetings</h2>
                <p className="text-xs text-on-surface-variant mt-1">Review and manage your team's discussion insights.</p>
              </div>
              
              {/* Filter Pill Bar */}
              <div className="flex flex-wrap items-center gap-2 p-1 bg-surface-container rounded-full w-fit">
                {(['all', 'pending', 'processing', 'processed', 'failed'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-4 py-1 rounded-full text-xs font-medium transition-colors ${
                      filter === t
                        ? 'bg-surface-container-lowest text-primary shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Meeting List / Table */}
            {isLoading ? (
              <div className="flex justify-center items-center py-20 bg-surface rounded-xl border border-outline-variant">
                 <div className="animate-pulse flex flex-col items-center">
                     <div className="h-10 w-10 bg-primary-fixed-dim rounded-full mb-3 flex items-center justify-center">
                       <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                     </div>
                     <div className="text-on-surface-variant text-sm font-medium">Loading intelligence...</div>
                 </div>
              </div>
            ) : isError ? (
              <div className="text-error bg-error-container/20 p-5 rounded-xl border border-error-container font-medium flex items-center shadow-sm">
                 <span className="material-symbols-outlined mr-3 text-error">warning</span>
                 Failed to load meetings. Please verify your authentication state.
              </div>
            ) : filteredMeetings.length === 0 ? (
              <div className="bg-surface p-16 text-center rounded-xl border border-outline-variant shadow-sm flex flex-col items-center justify-center">
                <div className="mx-auto w-12 h-12 bg-surface-container-low rounded-full flex items-center justify-center mb-4 text-outline">
                  <span className="material-symbols-outlined text-2xl">sentiment_dissatisfied</span>
                </div>
                <h3 className="text-lg font-medium text-on-surface mb-1">No insights discovered yet</h3>
                <p className="text-xs text-on-surface-variant mb-5">Upload your first audio or video transcript to get started.</p>
                <button
                  onClick={() => setIsUploadOpen(true)}
                  className="inline-flex items-center justify-center bg-primary-fixed hover:bg-primary-fixed-dim text-on-primary-fixed px-4 py-2 rounded-lg text-sm font-semibold transition-colors border border-outline-variant"
                >
                  Upload Transcript
                </button>
              </div>
            ) : (
              <div className="space-y-0 bg-surface rounded-xl border border-outline-variant overflow-hidden">
                {/* Header Row */}
                <div className="grid grid-cols-[100px_1fr_120px_180px_100px] gap-4 px-md py-sm bg-surface-container-low border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-outline">
                  <div>Status</div>
                  <div>Meeting Details</div>
                  <div>Participants</div>
                  <div>Activity</div>
                  <div className="text-right">Action</div>
                </div>

                {/* Rows */}
                {filteredMeetings.map((m: any) => (
                  <div 
                    key={m.id} 
                    className="grid grid-cols-[100px_1fr_120px_180px_100px] gap-4 px-md py-md border-b border-outline-variant items-center hover:bg-surface-container-low transition-colors"
                  >
                    {/* Status Pill */}
                    <div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                        m.status === 'processed' 
                          ? 'bg-green-100 text-green-700' 
                          : m.status === 'failed'
                          ? 'bg-error-container text-on-error-container'
                          : m.status === 'processing'
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    {/* Title & Info */}
                    <div className="flex flex-col min-w-0">
                      <Link 
                        href={`/meetings/${m.id}`} 
                        className="font-medium text-on-surface hover:text-primary hover:underline truncate"
                      >
                        {m.title}
                      </Link>
                      <span className="text-[11px] text-outline mt-0.5">
                        {new Date(m.meeting_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Participants Avatars */}
                    <div className="flex -space-x-2 overflow-hidden">
                      {m.participant_names.slice(0, 3).map((p: string) => (
                        <div 
                          key={p} 
                          className={`w-7 h-7 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold ${getAvatarColor(p)}`} 
                          title={p}
                        >
                          {getInitials(p)}
                        </div>
                      ))}
                      {m.participant_names.length > 3 && (
                        <div className="w-7 h-7 rounded-full border-2 border-surface bg-primary-fixed text-on-primary-fixed flex items-center justify-center text-[9px] font-bold">
                          +{m.participant_names.length - 3}
                        </div>
                      )}
                    </div>

                    {/* Activity Column */}
                    <div>
                      {m.status === 'processing' ? (
                        <div className="flex flex-col gap-1 w-full max-w-[150px]">
                          <div className="flex items-center gap-1 text-[11px] text-on-surface-variant">
                            <span className="material-symbols-outlined text-[12px] animate-spin">sync</span>
                            Analyzing audio...
                          </div>
                          <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
                            <div className="bg-primary h-full w-[65%] animate-pulse"></div>
                          </div>
                        </div>
                      ) : m.status === 'processed' ? (
                        <div className="flex flex-col text-[11px]">
                          <span className="text-on-surface-variant font-medium">
                            {m.action_item_count} open action items
                          </span>
                          <span className="text-outline">
                            {m.decision_count} decisions recorded
                          </span>
                        </div>
                      ) : m.status === 'failed' ? (
                        <span className="text-[11px] text-error font-medium truncate block max-w-[150px]" title={m.error_message}>
                          {m.error_message || 'Audio quality too low'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-outline">Queued for processing</span>
                      )}
                    </div>

                    {/* Action Column */}
                    <div className="text-right">
                      {m.status === 'failed' ? (
                        <button 
                          onClick={() => handleRetryProcess(m.id)}
                          className="text-on-surface-variant hover:text-primary transition-colors inline-flex p-1"
                          title="Retry Processing"
                        >
                          <span className="material-symbols-outlined">refresh</span>
                        </button>
                      ) : (
                        <Link 
                          href={`/meetings/${m.id}`} 
                          className="text-on-surface-variant hover:text-primary transition-colors inline-flex p-1"
                        >
                          <span className="material-symbols-outlined">chevron_right</span>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer / Pagination */}
            {filteredMeetings.length > 0 && (
              <footer className="mt-lg flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">
                  Showing 1-{filteredMeetings.length} of {filteredMeetings.length} meetings
                </span>
                <div className="flex items-center gap-2">
                  <button 
                    className="p-1.5 rounded-lg border border-outline-variant text-outline hover:bg-surface-container-low transition-colors disabled:opacity-30" 
                    disabled
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary-fixed text-on-primary-fixed font-bold text-xs">1</button>
                  </div>
                  <button 
                    className="p-1.5 rounded-lg border border-outline-variant text-outline hover:bg-surface-container-low transition-colors disabled:opacity-30" 
                    disabled
                  >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                  </button>
                </div>
              </footer>
            )}
          </div>
        </div>

        {/* Decorative Overlay */}
        <div className="absolute bottom-0 right-0 p-lg opacity-[0.03] pointer-events-none select-none">
          <span className="material-symbols-outlined text-[160px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
        </div>
      </main>

      {/* Upload Recording Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-on-surface/40 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
            onClick={() => uploadStep === 0 && setIsUploadOpen(false)}
          ></div>

          {/* Modal Container */}
          <div className="bg-surface rounded-xl border border-outline-variant shadow-lg w-full max-w-md overflow-hidden transform transition-all duration-300 relative z-10 animate-scaleUp">
            {/* Header */}
            <div className="px-lg pt-lg pb-sm flex justify-between items-center border-b border-outline-variant/60">
              <div>
                <h3 className="text-base font-semibold text-on-surface">Upload Meeting Record</h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Enter details and attach the meeting transcript.</p>
              </div>
              {uploadStep === 0 && (
                <button 
                  onClick={() => setIsUploadOpen(false)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded transition-colors inline-flex"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            {/* Error Display */}
            {uploadError && (
              <div className="mx-lg mt-md bg-error-container/20 text-error p-3 rounded-lg text-xs font-medium border border-error-container/60 flex items-start">
                <span className="material-symbols-outlined mr-2 text-error text-[16px] mt-0.5">warning</span>
                <span>{uploadError}</span>
              </div>
            )}

            {/* Upload Form */}
            {uploadStep === 0 ? (
              <form onSubmit={handleUploadSubmit} className="p-lg space-y-md">
                <div className="flex flex-col">
                  <label className="text-xs font-medium text-on-surface mb-1">Meeting Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q3 Roadmap Planning"
                    className="w-full text-sm p-2 border border-outline-variant rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-surface-container-lowest"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-md">
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-on-surface mb-1">Meeting Date</label>
                    <input 
                      type="date" 
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full text-sm p-2 border border-outline-variant rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-surface-container-lowest"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-xs font-medium text-on-surface mb-1">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="1"
                      className="w-full text-sm p-2 border border-outline-variant rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-surface-container-lowest"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-medium text-on-surface mb-1">Participants</label>
                  <input 
                    type="text" 
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="e.g. Maya Chen, Raj Patel (comma-separated)"
                    className="w-full text-sm p-2 border border-outline-variant rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-surface-container-lowest"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-medium text-on-surface mb-1">Transcript File (.txt)</label>
                  <div className="relative border border-dashed border-outline-variant hover:border-primary rounded-lg p-5 transition-colors flex flex-col items-center justify-center bg-surface-container-low hover:bg-surface-container/30">
                    <input 
                      type="file" 
                      accept=".txt"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <span className="material-symbols-outlined text-[24px] text-outline mb-1.5">upload_file</span>
                    {file ? (
                      <div className="text-center min-w-0 max-w-full">
                        <p className="text-xs font-semibold text-primary truncate px-2">{file.name}</p>
                        <p className="text-[10px] text-outline mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-medium text-on-surface">Click or drag transcript file to attach</p>
                        <p className="text-[10px] text-outline mt-0.5">Plain text formats (.txt) up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-sm border-t border-outline-variant flex gap-md">
                  <button 
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="flex-1 text-sm border border-outline-variant hover:bg-surface-container-low text-on-surface p-2 rounded-md font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 text-sm bg-primary text-on-primary hover:opacity-95 p-2 rounded-md font-medium shadow-sm transition-all"
                  >
                    Create & Upload
                  </button>
                </div>
              </form>
            ) : (
              /* Processing state */
              <div className="p-lg flex flex-col items-center justify-center space-y-md">
                <div className="relative flex items-center justify-center mt-md">
                  {uploadStep < 4 ? (
                    <span className="material-symbols-outlined text-[36px] text-primary animate-spin">sync</span>
                  ) : (
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 animate-scaleUp">
                      <span className="material-symbols-outlined text-[24px]">check</span>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-1">
                  <h4 className="text-sm font-semibold text-on-surface">
                    {uploadStep === 1 && 'Creating meeting record...'}
                    {uploadStep === 2 && 'Uploading transcript file...'}
                    {uploadStep === 3 && 'Starting AI-powered analysis...'}
                    {uploadStep === 4 && 'Meeting processed successfully!'}
                  </h4>
                  <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
                    {uploadStep === 1 && 'Saving metadata and requesting secure storage endpoint.'}
                    {uploadStep === 2 && `Transferring file content to storage bucket.`}
                    {uploadStep === 3 && 'Gemini is reading the transcript to extract decisions and actions.'}
                    {uploadStep === 4 && 'Your insights are ready. Refreshing dashboard...'}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full max-w-[240px] space-y-1.5 pt-sm border-t border-outline-variant/60">
                  <div className="flex items-center justify-between text-[10px] font-semibold">
                    <span className={uploadStep >= 1 ? 'text-primary' : 'text-outline'}>1. Info</span>
                    <span className={uploadStep >= 2 ? 'text-primary' : 'text-outline'}>2. Upload</span>
                    <span className={uploadStep >= 3 ? 'text-primary' : 'text-outline'}>3. Analyze</span>
                  </div>
                  <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-500 rounded-full" 
                      style={{ width: `${(uploadStep / 4) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
