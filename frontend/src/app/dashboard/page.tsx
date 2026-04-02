'use client';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: meetings, isLoading, isError } = useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      const res = await api.get('/meetings');
      return res.data;
    }
  });

  return (
    <div className="min-h-screen bg-[#FAFAFA] p-8 font-sans antialiased text-gray-900">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 bg-white p-8 rounded-3xl shadow-sm border border-gray-100/80 ring-1 ring-black/[0.02]">
          <div className="mb-4 sm:mb-0">
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-sm">Dashboard</h1>
            <p className="text-gray-500 mt-1.5 font-medium text-base">Your centralized meeting intelligence hub.</p>
          </div>
          <button className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-300 ring-1 ring-white/20">
            + Upload Recording
          </button>
        </div>

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
            <p className="text-gray-500 font-medium">Upload your first audio or video transcript to get started.</p>
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
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${m.status === 'processed' ? 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200' : 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200'}`}>
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
    </div>
  );
}
