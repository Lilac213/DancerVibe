
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Zap, UserCircle, Users, ArrowRight, Building2, Lock, Sparkles } from 'lucide-react';

interface AuthScreenProps {
  onLogin: (user: User, supabaseKey: string) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('teacher');

  useEffect(() => {
    // Only pre-fill if we are in login mode initially
    const storedName = localStorage.getItem('dancervibe_username');
    const storedRole = localStorage.getItem('dancervibe_role');

    if (storedName) setName(storedName);
    if (storedRole) setRole(storedRole as UserRole);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && password.trim()) {
      if (isRegistering) {
          // Simulation of registration logic
          // In a real app, this would create a user in Supabase Auth
          alert(`注册成功！欢迎, ${name}`);
      }
      
      localStorage.setItem('dancervibe_username', name);
      localStorage.setItem('dancervibe_role', role);
      onLogin({ name, role }, '');
    } else {
        alert("请输入账号和密码");
    }
  };

  const toggleMode = () => {
      setIsRegistering(!isRegistering);
      // Clear fields when switching to register to avoid confusion, 
      // or keep them if switching back to login. For smooth UX, keeping them is often fine.
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="mb-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-red-600/30 rotate-3 transition-transform hover:rotate-6">
            <Zap className="text-white fill-white w-8 h-8" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-gray-900 italic">Dancer<span className="text-red-600">Vibe</span></h1>
        <p className="text-gray-500 mt-2 font-medium tracking-wide text-xs uppercase">街舞人专属智能工具</p>
      </div>

      <div className="w-full max-w-sm bg-white border border-gray-100 rounded-3xl p-8 shadow-xl shadow-gray-200/50 animate-in zoom-in-95 duration-300 relative overflow-hidden">
        
        {/* Decorative background blob */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <h2 className="text-xl font-bold text-gray-900 mb-8 text-center relative z-10 flex items-center justify-center gap-2">
            {isRegistering ? (
                <>
                    <Sparkles className="text-red-500 w-5 h-5" /> 注册新账号
                </>
            ) : (
                '账号登录'
            )}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
          
          {/* Role Selection */}
          <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                  选择您的身份
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                    role === 'teacher' 
                        ? 'bg-red-50 border-red-600 text-red-700 ring-1 ring-red-100' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Zap size={24} className={role === 'teacher' ? 'fill-red-600 text-red-600' : 'text-gray-300'} />
                    <span className="font-bold text-xs">老师</span>
                </button>
                
                <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                    role === 'student' 
                        ? 'bg-black border-black text-white shadow-md' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Users size={24} className={role === 'student' ? 'fill-white' : 'text-gray-300'} />
                    <span className="font-bold text-xs">学员</span>
                </button>

                <button
                    type="button"
                    onClick={() => setRole('studio')}
                    className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all duration-200 ${
                    role === 'studio' 
                        ? 'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-100' 
                        : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                >
                    <Building2 size={24} className={role === 'studio' ? 'text-blue-600' : 'text-gray-300'} />
                    <span className="font-bold text-xs">舞室</span>
                </button>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div className="relative group">
                <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-black transition-colors">
                    <UserCircle size={20} />
                </div>
                <input
                    type="text"
                    required
                    placeholder="账号 / 手机号"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-sm text-gray-900 font-bold focus:border-black focus:bg-white focus:ring-0 outline-none transition-all placeholder-gray-400"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </div>
            <div className="relative group">
                <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-black transition-colors">
                    <Lock size={20} />
                </div>
                <input
                    type="password"
                    required
                    placeholder="密码"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-sm text-gray-900 font-bold focus:border-black focus:bg-white focus:ring-0 outline-none transition-all placeholder-gray-400"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
          </div>

          <button
            type="submit"
            className={`w-full py-4 font-bold rounded-xl transition-all shadow-lg text-sm flex items-center justify-center gap-2 group ${
                isRegistering 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20' 
                : 'bg-black hover:bg-gray-800 text-white shadow-black/10'
            }`}
          >
            <span>{isRegistering ? '立即注册' : '登录'}</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-8 text-center">
            <button
                type="button"
                onClick={toggleMode}
                className="text-xs text-gray-400 hover:text-black font-bold transition-colors border-b border-transparent hover:border-black pb-0.5"
            >
                {isRegistering ? '已有账号？返回登录' : '没有账号？注册新账号'}
            </button>
        </div>
      </div>
      
      <p className="mt-10 text-[10px] font-bold text-gray-300 uppercase tracking-widest">
        DancerVibe System v2.1
      </p>
    </div>
  );
};

export default AuthScreen;
