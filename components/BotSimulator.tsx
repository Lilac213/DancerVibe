import React, { useState } from 'react';
import { Bot, Sparkles, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { parseClassInfo } from '../services/geminiService';
import { ClassSession, UserRole } from '../types';

interface BotSimulatorProps {
  onAiParsed: (data: Partial<ClassSession>) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  userRole?: UserRole;
}

const BotSimulator: React.FC<BotSimulatorProps> = ({ onAiParsed, isOpen, setIsOpen, userRole = 'student' }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'invite' | 'active'>('invite');

  const handleParse = async () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    try {
      const results = await parseClassInfo(inputText, userRole as UserRole);
      if (results && results.length > 0) {
        const result = results[0];
        onAiParsed({
            startTime: result.startTime,
            endTime: result.endTime,
            studio: result.studio,
            teacher: result.teacher,
            song: result.song,
            dayOfWeek: result.dayOfWeek,
            type: result.type === 'flow' ? 'flow' : 'fixed',
            date: result.date,
        });
        setInputText('');
      }
    } catch (e) {
      console.error(e);
      alert("无法提取信息，请尝试更具体的描述。");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <button 
            onClick={() => setIsOpen(false)} 
            className="absolute top-4 right-4 text-zinc-500 hover:text-white"
        >
            ✕
        </button>

        <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Bot className="text-white w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white">群消息助手 Bot</h3>
                    <p className="text-xs text-zinc-400">自动监听群公告并同步课表</p>
                </div>
            </div>

            {step === 'invite' ? (
                <div className="text-center py-4 space-y-4">
                    <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 text-sm text-zinc-400">
                        "嘿！把我拉进你的舞室或学生群。我会自动监听代课信息和课程变动，帮你更新课表。"
                    </div>
                    <button 
                        onClick={() => setStep('active')}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        连接到群聊 <ArrowRight size={16} />
                    </button>
                    <p className="text-xs text-zinc-500 mt-2">此功能为模拟演示</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-green-400 bg-green-900/20 p-2 rounded-md border border-green-900/50">
                        <CheckCircle2 size={16} />
                        <span>Bot 已在 "进阶编舞群" 中激活</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">模拟接收消息</label>
                        <textarea 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                            placeholder="粘贴一条消息，例如：'这周五晚上7点在 Millennium 代课，教 Get Up'"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleParse}
                        disabled={!inputText.trim() || isProcessing}
                        className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2 border border-zinc-700"
                    >
                        {isProcessing ? (
                            <><Loader2 className="animate-spin" size={16} /> 处理中...</>
                        ) : (
                            <><Sparkles className="text-amber-400" size={16} /> 智能添加到课表</>
                        )}
                    </button>
                    <p className="text-xs text-center text-zinc-500">
                        Powered by Gemini 3 Flash
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default BotSimulator;