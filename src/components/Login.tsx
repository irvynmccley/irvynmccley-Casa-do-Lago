import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Lock, AlertCircle, ArrowRight } from 'lucide-react';

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
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      
      let errorMessage = err.message || 'Ocorreu um erro. Tente novamente.';
      
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Erro de conexão com o servidor. Verifique se as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão corretas no Vercel, ou se o seu projeto no Supabase não está pausado (projetos gratuitos pausam após 7 dias de inatividade).';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#0a192f] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#0a192f] rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Lock className="text-white" size={32} />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-[#0a192f]">
          Casa do Lago
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          Faça login para acessar o painel financeiro
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3">
                <AlertCircle className="text-red-500 mt-0.5" size={18} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#f8f9fc] border-none focus:ring-2 focus:ring-[#0a192f] outline-none transition-all text-gray-800"
                placeholder="admin@projeto.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[#f8f9fc] border-none focus:ring-2 focus:ring-[#0a192f] outline-none transition-all text-gray-800"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-3 py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-[#0a192f] hover:bg-[#112a4a] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0a192f] disabled:opacity-70 transition-colors"
              >
                {isLoading ? 'Aguarde...' : 'Entrar no Painel'}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <a 
              href="?shared=true" 
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-200 transition-colors"
            >
              Acesso Restrito: Mestre de Obras <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
