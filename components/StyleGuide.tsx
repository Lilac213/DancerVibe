
import React from 'react';
import { X, MapPin, Users, Clock, Plus, Zap, AlertTriangle, CheckCircle2, LayoutGrid, Calendar, Palette } from 'lucide-react';

interface StyleGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const StyleGuide: React.FC<StyleGuideProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <Palette className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">UI 设计系统</h1>
              <p className="text-xs text-gray-500 font-mono uppercase tracking-wider">Red / Black / White</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-white hover:bg-gray-100 text-gray-400 hover:text-black rounded-lg transition-colors border border-gray-200"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-12 pb-20">
        
        {/* 1. Brand & Colors */}
        <section className="space-y-4">
          <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">01. 品牌与配色</h2>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-red-600 shadow-xl shadow-red-600/30"></div>
              <div>
                <span className="block text-gray-900 font-bold text-sm">主色红</span>
                <span className="text-gray-400 text-xs font-mono">red-600</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-black shadow-xl shadow-black/30"></div>
              <div>
                <span className="block text-gray-900 font-bold text-sm">强调黑</span>
                <span className="text-gray-400 text-xs font-mono">gray-900 / black</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-white border border-gray-200 shadow-sm"></div>
              <div>
                <span className="block text-gray-900 font-bold text-sm">背景白</span>
                <span className="text-gray-400 text-xs font-mono">white</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-24 rounded-2xl bg-gray-50 border border-gray-100"></div>
              <div>
                <span className="block text-gray-900 font-bold text-sm">页面背景</span>
                <span className="text-gray-400 text-xs font-mono">gray-50</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Typography */}
        <section className="space-y-4">
          <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">02. 排版</h2>
          
          <div className="space-y-8 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div>
              <h1 className="text-5xl font-black italic tracking-tighter text-gray-900">GROOVE<span className="text-red-600">GRID</span></h1>
              <p className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-widest">标题 / Logo</p>
            </div>
            
            <div className="flex items-end gap-8">
               <div>
                 <span className="text-3xl font-bold text-gray-900">October 24</span>
                 <p className="text-xs text-gray-400 mt-1">页面标题</p>
               </div>
               <div>
                 <span className="text-xl font-bold text-gray-900">Class Details</span>
                 <p className="text-xs text-gray-400 mt-1">章节标题</p>
               </div>
            </div>

            <div className="space-y-2">
               <p className="text-sm text-gray-600 leading-relaxed">这是用于描述的标准正文文本。白底黑字的高对比度确保了最大的可读性，同时保持了干净、现代的美感。</p>
               <p className="text-xs text-gray-400 font-medium">次要文本、时间戳或说明。</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">微标签</p>
            </div>
          </div>
        </section>

        {/* 3. Buttons & Interactives */}
        <section className="space-y-4">
          <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">03. 交互元素</h2>
          
          <div className="flex flex-wrap gap-6 items-center bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            {/* Primary */}
            <button className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center gap-2">
               <Plus size={18} /> 主要按钮 (红)
            </button>

            {/* Secondary Black */}
            <button className="px-6 py-3 bg-black hover:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-black/20">
               操作按钮 (黑)
            </button>

            {/* Ghost / Surface */}
            <button className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-600 font-bold rounded-xl transition-colors border-2 border-gray-100">
               次要按钮
            </button>

             {/* Toggles */}
             <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                <button className="py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-lg bg-white text-black shadow-sm ring-1 ring-black/5 flex items-center gap-2">
                    <LayoutGrid size={14} /> 周视图
                </button>
                <button className="py-2 px-4 text-xs font-bold uppercase tracking-wider rounded-lg text-gray-500 hover:text-black flex items-center gap-2">
                    <Calendar size={14} /> 月视图
                </button>
            </div>
          </div>
        </section>

        {/* 4. Domain Components */}
        <section className="space-y-4">
          <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest border-b border-gray-200 pb-2">04. 课程卡片</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            
            {/* Fixed Class Card */}
            <div className="space-y-2">
               <span className="text-xs text-gray-400 font-bold uppercase tracking-wider ml-1">固定课 (红)</span>
               <div className="cursor-pointer p-5 rounded-2xl border bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/20 flex flex-col gap-2 relative overflow-hidden transition-transform hover:scale-[1.02]">
                    <div className="flex justify-between items-center text-xs font-mono opacity-80">
                        <span className="flex items-center gap-1.5"><Clock size={12}/> 19:00</span>
                        <span className="flex items-center gap-1.5"><MapPin size={12} /> Millennium</span>
                    </div>
                    <div className="font-bold text-xl truncate">
                        New Jeans - OMG
                    </div>
                    <div className="text-xs opacity-90 flex items-center gap-1.5 font-medium">
                        <Users size={12} /> Me (Regular)
                    </div>
                </div>
            </div>

            {/* Flow Class Card */}
            <div className="space-y-2">
               <span className="text-xs text-gray-400 font-bold uppercase tracking-wider ml-1">临时课 (黑)</span>
               <div className="cursor-pointer p-5 rounded-2xl border flex flex-col gap-2 relative overflow-hidden bg-black border-black text-white shadow-xl shadow-black/20 transition-transform hover:scale-[1.02]">
                    <div className="absolute top-0 right-0 bg-white text-[10px] text-black font-black px-2 py-1 rounded-bl-xl uppercase tracking-wider">
                        临时
                    </div>
                    <div className="flex justify-between items-center text-xs font-mono opacity-70">
                        <span className="flex items-center gap-1.5"><Clock size={12}/> 21:00</span>
                        <span className="flex items-center gap-1.5"><MapPin size={12} /> En Dance</span>
                    </div>
                    <div className="font-bold text-xl truncate">
                        Tyla - Water
                    </div>
                    <div className="text-xs opacity-80 flex items-center gap-1.5 font-medium">
                        <Users size={12} /> 代课 Mark
                    </div>
                </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};

export default StyleGuide;
