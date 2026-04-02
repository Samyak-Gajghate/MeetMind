'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [workspaceId, setWorkspaceId] = useState('00000000-0000-0000-0000-000000000001'); // default test workspace
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', { 
        email, 
        password, 
        display_name: displayName, 
        workspace_id: workspaceId 
      });
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#FAFAFA] to-[#E5E7EB] py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white/90 backdrop-blur-xl p-10 rounded-3xl shadow-2xl shadow-indigo-100/50 border border-white/60">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900 tracking-tight">Create your account</h2>
          <p className="mt-2 text-center text-sm text-gray-600 font-medium">Join MeetMind and transform your meetings</p>
        </div>
        
        {error && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-100 flex shadow-sm">
             <div className="text-sm text-red-700 font-medium">{error}</div>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Display Name</label>
              <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all" placeholder="John Doe" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all" placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 focus:z-10 sm:text-sm transition-all" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Workspace ID (Optional/Admin)</label>
              <input type="text" value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} className="appearance-none rounded-xl relative block w-full px-4 py-3 border border-gray-300 bg-gray-50 placeholder-gray-400 text-gray-500 focus:outline-none sm:text-sm" />
            </div>
          </div>
          <div>
            <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-lg shadow-indigo-500/30">
              {loading ? 'Creating Account...' : 'Sign up'}
            </button>
          </div>
          <div className="text-center text-sm font-medium text-gray-600">
            Already have an account? <Link href="/login" className="text-indigo-600 hover:text-indigo-500 transition-colors">Sign in here</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
