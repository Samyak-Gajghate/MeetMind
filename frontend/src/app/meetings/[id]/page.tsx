'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MeetingDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const { data: meeting, isLoading, isError } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const res = await api.get(`/meetings/${id}`);
      return res.data;
    }
  });

  if (isLoading) return <div className="p-8 text-center text-gray-500 font-medium">Loading intelligence...</div>;
  if (isError) return <div className="p-8 text-center text-red-500 font-medium">Failed to load meeting intelligence.</div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <Link href="/dashboard" className="inline-flex items-center text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          Back to Dashboard
        </Link>
        
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <h1 className="text-3xl font-extrabold text-gray-900">{meeting.title}</h1>
          <p className="text-gray-500 mt-2 font-medium">Recorded on {new Date(meeting.meeting_date).toLocaleDateString()} • {meeting.duration_minutes} minutes</p>
          
          <div className="mt-8">
             <h2 className="text-xl font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">Executive Summary</h2>
             <p className="text-gray-700 leading-relaxed max-w-prose whitespace-pre-wrap">{meeting.summary || 'Summary is actively being processed...'}</p>
          </div>

          <div className="mt-10">
             <h2 className="text-xl font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">Key Decisions</h2>
             {meeting.decisions && meeting.decisions.length > 0 ? (
               <ul className="space-y-3">
                 {meeting.decisions.map((d: any) => (
                   <li key={d.id} className="flex items-start bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                     <span className="text-blue-500 mr-3 mt-0.5">
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                     </span>
                     <span className="text-gray-800 font-medium">{d.description}</span>
                   </li>
                 ))}
               </ul>
             ) : (
               <p className="text-gray-500 italic">No decisions logged.</p>
             )}
          </div>

          <div className="mt-10">
             <h2 className="text-xl font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">Action Items</h2>
             {meeting.action_items && meeting.action_items.length > 0 ? (
               <div className="grid gap-3">
                 {meeting.action_items.map((ai: any) => (
                   <div key={ai.id} className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-100 shadow-sm">
                      <div className="flex items-center space-x-4">
                         <div className={`h-3 w-3 rounded-full ${ai.status === 'open' ? 'bg-amber-400' : ai.status === 'in_progress' ? 'bg-blue-400' : 'bg-emerald-400'}`}></div>
                         <p className="text-gray-800 font-semibold">{ai.description}</p>
                      </div>
                      <div className="text-sm">
                         {ai.owner_name && <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-bold">{ai.owner_name}</span>}
                      </div>
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-gray-500 italic">No pending action items.</p>
             )}
          </div>

        </div>
      </div>
    </div>
  );
}
