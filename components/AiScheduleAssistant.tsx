import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User as UserIcon, Loader2, Check, ArrowRight, Calendar, Clock, Mic, Square, Image as ImageIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatWithAssistant, ChatMessage, transcribeAudio } from '../services/geminiService';
import { ClassSession, UserRole, User } from '../types';
import { searchPublicClasses } from '../services/scheduleService';
import PosterGenerator from './PosterGenerator';

interface ProposedClassSession extends Partial<ClassSession> {
    action?: 'add' | 'remove';
    originalId?: string;
}

interface AiScheduleAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onAddClasses: (newClasses: Partial<ClassSession>[]) => void;
  existingClasses: ClassSession[];
  userRole: UserRole;
  user?: User;
  autoStartRecording?: boolean;
}

interface ToolProposal {
    reason: string;
    events: ProposedClassSession[];
}

const AiScheduleAssistant: React.FC<AiScheduleAssistantProps> = ({ 
    isOpen, onClose, onAddClasses, existingClasses, userRole, user, autoStartRecording
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingTool, setPendingTool] = useState<ToolProposal | null>(null);
  const [isPosterOpen, setIsPosterOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingTool, isLoading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
        let welcomeText = '';
        if (userRole === 'teacher') {
            welcomeText = `你好 ${user?.name || ''} 老师! 我可以帮你整理排课计划、检查冲突，或者生成群公告。`;
        } else if (userRole === 'student') {
            welcomeText = `你好 ${user?.name || ''}! 想查哪位老师的课？或者让我帮你找找本周适合的课程。`;
        } else if (userRole === 'studio') {
             welcomeText = `你好 ${user?.name || ''} 主理人! 我可以协助管理教室排期、发布今日课表或处理临时调课。`;
        }

        setMessages([{
            role: 'model',
            text: welcomeText
        }]);
    }
  }, [isOpen, userRole, user, messages.length]);

  useEffect(() => {
      if (isOpen && autoStartRecording && !isRecording) {
          const timer = setTimeout(() => {
              startRecording();
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [isOpen, autoStartRecording]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setPendingTool(null);

    const currentUser = user || { name: 'User', role: userRole };
    let currentHistory = [...messages, userMsg];
    
    // First Turn
    let response = await chatWithAssistant(currentHistory, currentUser, existingClasses);

    // Loop for Tool Calls
    while (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls[0];
        
        if (toolCall.name === 'query_teacher_schedule') {
            const { teacherName } = toolCall.args as { teacherName: string };
            setMessages(prev => [...prev, { role: 'model', text: `🔍 正在查询 ${teacherName} 老师的课表...` }]);
            const searchResults = await searchPublicClasses(teacherName);
            
            // Add Model's tool call AND TEXT if present to history
            currentHistory.push({ role: 'model', toolCalls: [toolCall], text: response.text });
            
            const toolResponseMsg: ChatMessage = {
                role: 'user',
                toolResponse: {
                    name: 'query_teacher_schedule',
                    result: searchResults.length > 0 
                        ? `Found ${searchResults.length} classes: ${JSON.stringify(searchResults.map(c => ({
                            day: c.dayOfWeek, time: `${c.startTime}-${c.endTime}`, studio: c.studio, content: c.song, type: c.type
                          })))}`
                        : "No classes found for this teacher."
                }
            };
            currentHistory.push(toolResponseMsg);
            response = await chatWithAssistant(currentHistory, currentUser, existingClasses);
        } else if (toolCall.name === 'propose_schedule_update') {
            const args = toolCall.args as unknown as ToolProposal;
            setPendingTool(args);
            // We do not push to history here yet; waiting for user confirmation
            break;
        } else {
            break;
        }
    }

    setIsLoading(false);
    if (response.text) {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    }
  };

  const confirmToolAction = () => {
    if (pendingTool) {
        onAddClasses(pendingTool.events);
        setMessages(prev => [...prev, { role: 'model', text: `✅ 已成功更新。` }]);
        setPendingTool(null);
    }
  };

  const cancelToolAction = () => {
      setMessages(prev => [...prev, { role: 'model', text: "操作已取消。" }]);
      setPendingTool(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
  }

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                setIsLoading(true);
                const text = await transcribeAudio(base64String, mediaRecorder.mimeType);
                setIsLoading(false);
                if (text) {
                    setInput(prev => prev + (prev ? ' ' : '') + text);
                }
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("无法访问麦克风");
    }
  };

  const toggleRecording = () => {
      if (isRecording) {
          mediaRecorderRef.current?.stop();
          setIsRecording(false);
      } else {
          startRecording();
      }
  };

  const processText = (text: string) => {
      if (!text) return '';
      return text.replace(/\n/g, '  \n');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto transition-opacity" onClick={onClose}/>
      <div className="bg-white border border-gray-200 w-full sm:max-w-md sm:rounded-3xl shadow-2xl overflow-hidden relative pointer-events-auto flex flex-col h-[85vh] animate-in zoom-in-95 duration-200">
        
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white/90 backdrop-blur-md z-10">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-lg">
                  <Sparkles className="text-red-500 fill-red-500 w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">AI 助手</h2>
                <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold uppercase tracking-wide">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    在线 • {userRole === 'teacher' ? '老师版' : userRole === 'student' ? '学员版' : '舞室版'}
                </div>
              </div>
           </div>
           <div className="flex gap-2">
               <button 
                  onClick={() => setIsPosterOpen(true)}
                  className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-full transition-colors flex items-center gap-1 text-xs font-bold"
               >
                   <ImageIcon size={16} /> 海报
               </button>
               <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors"><X size={20} /></button>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-200">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${msg.role === 'user' ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-gray-100 text-black'}`}>
                        {msg.role === 'user' ? <UserIcon size={14} /> : <Bot size={16} />}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl p-4 text-sm shadow-sm ${msg.role === 'user' ? 'bg-black text-white rounded-tr-sm' : 'bg-white border border-gray-100 text-gray-700 rounded-tl-sm'}`}>
                        {msg.role === 'model' ? (
                            <div className="markdown-content">
                                <ReactMarkdown components={{
                                        strong: ({node, ...props}) => <span className="font-bold text-black" {...props} />,
                                        ul: ({node, ...props}) => <ul className="list-disc pl-4 space-y-1 my-2" {...props} />,
                                        ol: ({node, ...props}) => <ol className="list-decimal pl-4 space-y-1 my-2" {...props} />,
                                        li: ({node, ...props}) => <li className="text-gray-600" {...props} />,
                                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                    }}
                                >{processText(msg.text || '')}</ReactMarkdown>
                            </div>
                        ) : (
                            <div className="whitespace-pre-wrap">{msg.text}</div>
                        )}
                    </div>
                </div>
            ))}
            {pendingTool && (
                <div className="ml-11 mr-4 bg-white border-2 border-red-500 rounded-2xl overflow-hidden shadow-xl shadow-red-500/10">
                    <div className="bg-red-500 px-4 py-2 flex items-center gap-2">
                        <Sparkles size={14} className="text-white fill-white" />
                        <span className="text-xs font-black text-white uppercase tracking-widest">建议更新</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <p className="text-sm text-gray-600 italic font-medium">"{pendingTool.reason}"</p>
                        <div className="flex gap-3 pt-2">
                            <button onClick={cancelToolAction} className="flex-1 py-3 text-xs font-bold text-gray-500 bg-gray-100 rounded-xl">取消</button>
                            <button onClick={confirmToolAction} className="flex-[2] py-3 text-xs font-bold text-white bg-black rounded-xl flex items-center justify-center gap-2"><Check size={14} /> 确认</button>
                        </div>
                    </div>
                </div>
            )}
            {isLoading && (
                 <div className="flex gap-3 ml-1"><div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center"><Bot size={16} /></div><Loader2 size={16} className="animate-spin text-gray-400 mt-2" /></div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
            <div className="relative group flex items-end gap-2">
                <textarea
                    ref={inputRef}
                    rows={1}
                    className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl pl-4 pr-4 py-4 text-sm focus:border-red-600 outline-none resize-none"
                    placeholder="输入..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <div className="flex gap-2">
                    <button onClick={toggleRecording} className={`p-3.5 rounded-xl transition-all shadow-md ${isRecording ? 'bg-red-600 text-white animate-pulse' : 'bg-white border'}`}>
                        {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                    </button>
                    <button onClick={handleSend} disabled={(!input.trim() && !isRecording) || isLoading} className="p-3.5 bg-black text-white rounded-xl disabled:opacity-50 shadow-md">
                        {isLoading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {user && (
        <PosterGenerator 
            isOpen={isPosterOpen}
            onClose={() => setIsPosterOpen(false)}
            classes={existingClasses}
            user={user}
        />
      )}
    </div>
  );
};

export default AiScheduleAssistant;