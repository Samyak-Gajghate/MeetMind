'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { getErrorMessage } from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [duration, setDuration] = useState('30');
  const [participants, setParticipants] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [uploadStep, setUploadStep] = useState(0); // 0: idle, 1: metadata, 2: uploading, 3: processing, 4: complete
  const [uploadError, setUploadError] = useState('');

  // Fetch current user / workspace details
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-8 font-sans antialiased text-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border border-gray-100/80 ring-1 ring-black/[0.02]">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">Dashboard</h1>
            <p className="text-gray-500 mt-1.5 font-medium text-base">Your centralized meeting intelligence hub.</p>
          </div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 ring-1 ring-white/20"
          >
            + Upload Recording
          </button>
        </div>

        {/* Meetings List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
             <div className="animate-pulse flex flex-col items-center">
                 <div className="h-12 w-12 bg-blue-100 rounded-full mb-4"></div>
                 <div className="text-gray-500 font-semibold tracking-wide">Loading intelligence...</div>
             </div>
          </div>
        ) : isError ? (
          <div className="text-red-500 bg-red-50 p-5 rounded-2xl border border-red-100 font-medium flex items-center shadow-sm">
             <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
             Failed to load meetings. Please verify your authentication state.
          </div>
        ) : meetings?.length === 0 ? (
          <div className="bg-white/60 backdrop-blur p-16 text-center rounded-3xl border border-gray-200 border-dashed shadow-inner">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">No insights discovered yet</h3>
            <p className="text-gray-500 font-medium mb-5">Upload your first audio or video transcript to get started.</p>
            <button
              onClick={() => setIsUploadOpen(true)}
              className="inline-flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 px-5 py-2.5 rounded-xl font-semibold transition-colors border border-blue-100"
            >
              Upload Transcript
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {meetings?.map((m: any) => (
              <Link href={`/meetings/${m.id}`} key={m.id} className="block group outline-none overflow-hidden rounded-3xl">
                <div className="bg-white p-7 rounded-3xl border border-gray-100/80 group-hover:border-blue-200 shadow-sm group-hover:shadow-2xl group-hover:shadow-blue-900/5 transition-all duration-300 h-full flex flex-col justify-between transform group-hover:-translate-y-1 relative overflow-hidden">
                  
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="text-xl font-extrabold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 pr-6 tracking-tight">{m.title}</h3>
                    <p className="text-sm font-medium text-gray-500 mt-1.5 flex items-center">
                       <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                       {new Date(m.meeting_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-5">
                      {m.participant_names.slice(0, 3).map((p: string) => (
                        <span key={p} className="text-xs font-semibold tracking-wide bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg border border-gray-200/50">{p}</span>
                      ))}
                      {m.participant_names.length > 3 && <span className="text-xs font-bold text-gray-400 py-1.5">+{m.participant_names.length - 3}</span>}
                    </div>
                  </div>
                  <div className="mt-6 pt-5 border-t border-gray-100 flex items-center justify-between relative z-10">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${
                      m.status === 'processed' 
                        ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200' 
                        : m.status === 'failed'
                        ? 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200'
                        : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200'
                    }`}>
                      {m.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400 font-bold bg-white px-2 py-1 rounded-md">{m.duration_minutes} min</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upload Recording Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn"
            onClick={() => uploadStep === 0 && setIsUploadOpen(false)}
          ></div>

          {/* Modal Content */}
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden transform transition-all duration-300 relative z-10 animate-scaleUp">
            {/* Header */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-center border-b border-gray-50">
              <div>
                <h3 className="text-2xl font-extrabold text-gray-900 tracking-tight">Upload Meeting Record</h3>
                <p className="text-gray-500 text-sm font-medium mt-0.5">Enter details and attach the meeting transcript.</p>
              </div>
              {uploadStep === 0 && (
                <button 
                  onClick={() => setIsUploadOpen(false)}
                  className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>

            {/* Error Message */}
            {uploadError && (
              <div className="mx-8 mt-4 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start">
                <svg className="w-5 h-5 mr-2.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>{uploadError}</span>
              </div>
            )}

            {/* Form */}
            {uploadStep === 0 ? (
              <form onSubmit={handleUploadSubmit} className="p-8 space-y-5">
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">Meeting Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Q3 Roadmap Planning"
                    className="w-full p-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 transition-all duration-200"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">Meeting Date</label>
                    <input 
                      type="date" 
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full p-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 transition-all duration-200"
                      required
                    />
                  </div>
                  <div className="group">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">Duration (Minutes)</label>
                    <input 
                      type="number" 
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      min="1"
                      className="w-full p-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5 transition-colors group-focus-within:text-blue-600">Participants</label>
                  <input 
                    type="text" 
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                    placeholder="e.g. Maya Chen, Raj Patel (comma-separated)"
                    className="w-full p-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-gray-800 transition-all duration-200"
                    required
                  />
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Transcript File (.txt)</label>
                  <div className="relative border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-6 transition-colors flex flex-col items-center justify-center bg-gray-50/30">
                    <input 
                      type="file" 
                      accept=".txt"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    {file ? (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-blue-600 line-clamp-1">{file.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-gray-700">Click or drag transcript file to attach</p>
                        <p className="text-xs text-gray-400 mt-0.5">Plain text formats (.txt) up to 5MB</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-50 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 p-3.5 rounded-xl font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-blue-600/40 text-white p-3.5 rounded-xl font-semibold shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                  >
                    Create & Upload
                  </button>
                </div>
              </form>
            ) : (
              /* Loading / Processing State */
              <div className="p-10 flex flex-col items-center justify-center space-y-6">
                <div className="relative flex items-center justify-center">
                  {/* Spinner */}
                  {uploadStep < 4 ? (
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  ) : (
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 animate-scaleUp">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                  )}
                </div>

                <div className="text-center space-y-2">
                  <h4 className="text-xl font-extrabold text-gray-900">
                    {uploadStep === 1 && 'Creating meeting record...'}
                    {uploadStep === 2 && 'Uploading transcript file...'}
                    {uploadStep === 3 && 'Starting AI-powered analysis...'}
                    {uploadStep === 4 && 'Meeting processed successfully!'}
                  </h4>
                  <p className="text-gray-500 font-medium text-sm max-w-xs mx-auto">
                    {uploadStep === 1 && 'Saving metadata and requesting secure storage endpoint.'}
                    {uploadStep === 2 && `Transferring file content to storage bucket.`}
                    {uploadStep === 3 && 'Gemini is reading the transcript to extract decisions and actions.'}
                    {uploadStep === 4 && 'Your insights are ready. Redirecting back to dashboard...'}
                  </p>
                </div>

                {/* Progress Indicators */}
                <div className="w-full max-w-xs space-y-2.5 pt-4 border-t border-gray-50">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className={uploadStep >= 1 ? 'text-blue-600' : 'text-gray-400'}>1. Metadata</span>
                    <span className={uploadStep >= 2 ? 'text-blue-600' : 'text-gray-400'}>2. Upload</span>
                    <span className={uploadStep >= 3 ? 'text-blue-600' : 'text-gray-400'}>3. Analyze</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full transition-all duration-500 rounded-full" 
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

