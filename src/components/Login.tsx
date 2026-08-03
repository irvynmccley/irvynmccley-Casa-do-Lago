import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { AlertCircle, ArrowRight, User, KeyRound, Building2 } from 'lucide-react';

export function Login() {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Add a timeout to prevent hanging forever
      const authPromise = supabase.auth.signInWithPassword({ email, password });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tempo limite de conexão excedido. O banco de dados (Supabase) pode estar pausado por inatividade, ou sua internet está instável. Acesse o painel do Supabase para reativá-lo se necessário.')), 20000)
      );
      
      const { data, error } = await Promise.race([authPromise, timeoutPromise]) as any;
      
      if (error) throw error;
      
      // If successful, force a reload to ensure the app state updates correctly
      // This is a fallback in case onAuthStateChange is delayed or blocked
      if (data?.session) {
        window.location.href = '/';
      }
    } catch (err: any) {
      console.error("Login error:", err);
      
      let errorMessage = err.message || 'Ocorreu um erro. Tente novamente.';
      
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Erro de conexão com o servidor. Verifique sua internet ou se o projeto no Supabase está ativo.';
      }
      
      setError(errorMessage);
      setIsLoading(false); // Only set to false on error, on success we reload
    }
  };

  return (
    <div className="min-h-screen bg-[#020817] flex items-center justify-center p-4 relative overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Elementos de fundo dinâmicos */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[40%] left-[60%] w-72 h-72 bg-emerald-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-pulse" style={{ animationDelay: '4s' }}></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-6 transform hover:scale-105 transition-transform duration-300 ring-1 ring-white/10">
            <Building2 className="text-white" size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            Casa do Lago
          </h2>
          <p className="mt-3 text-slate-400 font-medium text-sm tracking-wide uppercase">
            Sistema de Gestão Financeira
          </p>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-800/60 relative overflow-hidden">
          {/* Brilho sutil no topo do card */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 backdrop-blur-md">
                <AlertCircle className="text-red-400 mt-0.5 shrink-0" size={18} />
                <p className="text-sm text-red-200/90 leading-relaxed">{error}</p>
              </div>
            )}
            
            <div className="space-y-5">
              <div className="group">
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider group-focus-within:text-blue-400 transition-colors">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <User size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                    placeholder="admin@projeto.com"
                    required
                  />
                </div>
              </div>

              <div className="group">
                <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider group-focus-within:text-blue-400 transition-colors">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-blue-400 transition-colors">
                    <KeyRound size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 text-slate-200 placeholder-slate-600 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none transition-all shadow-inner"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 px-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#020817] focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 flex justify-center items-center gap-2 group mt-4 border border-blue-500/20"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Acessar Painel</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800/60">
            <a 
              href="?shared=true" 
              className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-slate-700/50 rounded-2xl text-sm font-medium text-slate-400 bg-slate-900/30 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-700 transition-all group"
            >
              <span>Acesso Restrito: <strong className="font-semibold text-slate-300 group-hover:text-white">Mestre de Obras</strong></span>
              <ArrowRight size={16} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
