import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, Calendar, MapPin, User, Music, Star, MoreVertical, Play, Flame, Smile, Meh, Frown, BatteryWarning, Check, Trash2, Video, ArrowRight, Share2, X, Search, Clock, PenLine } from 'lucide-react';
import { format, parseISO, getYear, getMonth, isSameMonth, addMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { DanceLog } from '../types';
import { getLogs, saveLog, deleteLog, generateThumbnail } from '../services/danceLogService';
import { TimePicker24h } from './TimePicker';

interface DanceLogViewProps {
    onGoPractice: (videoBlob: Blob) => void;
    prefillData?: Partial<DanceLog> | null;
    clearPrefill?: () => void;
}

const MOODS = [
    { key: 'fire', icon: Flame, color: 'text-orange-500', label: '炸场' },
    { key: 'happy', icon: Smile, color: 'text-green-500', label: '开心' },
    { key: 'neutral', icon: Meh, color: 'text-gray-400', label: '一般' },
    { key: 'tired', icon: BatteryWarning, color: 'text-blue-400', label: '累瘫' },
    { key: 'frustrated', icon: Frown, color: 'text-purple-500', label: '受挫' },
];

// --- SEPARATE COMPONENTS TO FIX FOCUS ISSUES ---

const LogCreator = ({ 
    formData, setFormData, isEditing, newLogVideo, setNewLogVideo, step, setStep, onSave, onCancel 
}: {
    formData: Partial<DanceLog>, 
    setFormData: any, 
    isEditing: boolean, 
    newLogVideo: File | null, 
    setNewLogVideo: any, 
    step: number, 
    setStep: any, 
    onSave: any, 
    onCancel: any 
}) => {
    // Local state for formatted date/time inputs which sync to formData
    const initialDate = formData.date ? parseISO(formData.date) : new Date();
    const [dayDate, setDayDate] = useState(format(initialDate, 'yyyy-MM-dd'));
    const [startTime, setStartTime] = useState(format(initialDate, 'HH:mm'));
    const [durationMins, setDurationMins] = useState(Math.floor((formData.durationSeconds || 5400) / 60));

    // Sync local changes to parent formData when leaving step 2 or saving
    useEffect(() => {
        const fullDate = `${dayDate}T${startTime}`;
        setFormData((prev: any) => ({
            ...prev,
            date: fullDate,
            durationSeconds: durationMins * 60
        }));
    }, [dayDate, startTime, durationMins, setFormData]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setNewLogVideo(e.target.files[0]);
        }
    };

    const steps = [
        // STEP 1: Video
        <div key="1" className="space-y-8 text-center pt-10 px-4">
            <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 animate-pulse shadow-xl shadow-red-100">
                <Video size={48} />
            </div>
            <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900">{isEditing ? '替换视频（可选）' : '选择练习视频'}</h3>
                <p className="text-sm text-gray-500 px-4 leading-relaxed">视频将保存在本地设备中，作为你的成长档案。</p>
            </div>
            
            <label className="block w-full max-w-xs mx-auto aspect-[4/5] bg-gray-50 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all relative overflow-hidden group">
                <input type="file" accept="video/*" className="hidden" onChange={(e) => { handleFileSelect(e); setStep(2); }} />
                {newLogVideo || (isEditing && formData.thumbnail) ? (
                    <>
                        <img src={isEditing && !newLogVideo ? formData.thumbnail : (newLogVideo ? URL.createObjectURL(newLogVideo) : '')} className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-105 transition-transform duration-500" />
                        <div className="relative z-10 bg-white/80 backdrop-blur-md p-3 rounded-full shadow-lg">
                            <Plus size={32} className="text-black" />
                        </div>
                        <span className="relative z-10 text-sm font-bold text-black mt-3 bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">点击替换</span>
                    </>
                ) : (
                    <>
                        <div className="w-20 h-20 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Plus size={36} className="text-gray-300 group-hover:text-red-500 transition-colors" />
                        </div>
                        <span className="text-sm font-bold text-gray-400 group-hover:text-red-500 transition-colors">点击上传</span>
                    </>
                )}
            </label>
            {isEditing && (
                <button onClick={() => setStep(2)} className="text-sm font-bold text-gray-400 hover:text-black underline underline-offset-4 decoration-2">跳过，保留原视频</button>
            )}
        </div>,

        // STEP 2: Info
        <div key="2" className="space-y-6 px-2">
            <div className="text-center mb-8">
                <h3 className="text-2xl font-black text-gray-900">{isEditing ? '编辑信息' : '轻量记录'}</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">CORE INFORMATION</p>
            </div>
            
            <div className="space-y-5">
                <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">舞曲 / 内容</label>
                    <input className="w-full bg-gray-50 px-4 py-3.5 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-black outline-none transition-all text-gray-900 text-lg" 
                        placeholder="例如: Tyla - Water"
                        value={formData.song} onChange={e => setFormData({...formData, song: e.target.value})} autoFocus
                    />
                </div>
                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">老师</label>
                        <div className="relative">
                            <User size={16} className="absolute left-3.5 top-4 text-gray-400" />
                            <input className="w-full bg-gray-50 pl-10 pr-4 py-3.5 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-black outline-none transition-all" 
                                placeholder="老师名"
                                value={formData.teacher} onChange={e => setFormData({...formData, teacher: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">舞室</label>
                        <div className="relative">
                            <MapPin size={16} className="absolute left-3.5 top-4 text-gray-400" />
                            <input className="w-full bg-gray-50 pl-10 pr-4 py-3.5 rounded-xl font-bold border-2 border-transparent focus:bg-white focus:border-black outline-none transition-all" 
                                placeholder="地点"
                                value={formData.studio} onChange={e => setFormData({...formData, studio: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
                
                {/* Updated Time Selection */}
                <div className="space-y-4 pt-2">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 block">时间安排</label>
                        <div className="space-y-4">
                            <input type="date" className="w-full bg-white px-4 py-3 rounded-xl font-bold border-2 border-transparent focus:border-black outline-none transition-all text-sm" 
                                value={dayDate} onChange={e => setDayDate(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <div className="flex-[2]">
                                    <TimePicker24h value={startTime} onChange={setStartTime} />
                                </div>
                                <div className="flex-1 relative">
                                    <input type="number" className="w-full bg-white px-3 py-3.5 rounded-xl font-bold border-2 border-transparent focus:border-black outline-none transition-all text-center" 
                                        value={durationMins} onChange={e => setDurationMins(parseInt(e.target.value) || 0)}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">min</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6">
                    <button onClick={() => setStep(3)} className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-black/10 hover:scale-[1.02] transition-transform">
                    下一步 <ArrowRight size={18} />
                    </button>
            </div>
        </div>,

        // STEP 3: Reflection
        <div key="3" className="space-y-8 px-2">
                <div className="text-center mb-2">
                <h3 className="text-2xl font-black text-gray-900">Feeling Check</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">记录当下感受</p>
            </div>

            {/* Mood */}
            <div className="flex justify-between px-4">
                {MOODS.map(m => (
                    <button key={m.key} 
                        onClick={() => setFormData({...formData, mood: m.key as any})}
                        className={`flex flex-col items-center gap-3 transition-all ${formData.mood === m.key ? 'scale-110' : 'opacity-40 grayscale hover:opacity-70 hover:grayscale-0'}`}
                    >
                        <div className={`w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center shadow-sm border-2 ${formData.mood === m.key ? 'border-black bg-white' : 'border-transparent'}`}>
                            <m.icon className={m.color} size={28} />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
                    </button>
                ))}
            </div>

            {/* Difficulty */}
            <div className="bg-gray-50 p-5 rounded-2xl flex items-center justify-between border border-gray-100">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">难度感知</span>
                <div className="flex gap-2">
                    {[1,2,3,4,5].map(v => (
                        <button key={v} onClick={() => setFormData({...formData, difficulty: v})} className="hover:scale-110 transition-transform">
                            <Star size={24} className={v <= (formData.difficulty || 0) ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-gray-200"} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Reflection */}
            <div>
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-2 block">课后反思 (选填)</label>
                    <textarea 
                    className="w-full h-36 bg-gray-50 p-4 rounded-2xl resize-none outline-none focus:bg-white focus:border-black border-2 border-transparent transition-all text-sm leading-relaxed"
                    placeholder="记录一下待改进的细节、老师强调的重点..."
                    value={formData.reflection}
                    onChange={e => setFormData({...formData, reflection: e.target.value})}
                    />
            </div>

            <div className="pt-4 flex gap-4">
                    <button onClick={() => setStep(2)} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-bold transition-colors">
                    返回
                    </button>
                    <button onClick={onSave} className="flex-[2] py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold shadow-xl shadow-red-600/20 transition-all hover:scale-[1.02]">
                    {isEditing ? '更新记录' : '完成并保存'}
                    </button>
            </div>
        </div>
    ];

    return (
        <div className="h-full bg-white flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="p-4 flex justify-between items-center border-b border-gray-50">
                <div className="text-xs font-black text-gray-300 uppercase tracking-widest">Step {step}/3</div>
                <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors"><X size={24}/></button>
            </div>
            <div className="flex-1 px-4 py-2 overflow-y-auto">
                {steps[step - 1]}
            </div>
            {/* Step Indicators */}
            <div className="p-6 flex justify-center gap-2 bg-white">
                {[1,2,3].map(i => (
                    <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-black' : 'w-2 bg-gray-200'}`} />
                ))}
            </div>
        </div>
    );
};

export const DanceLogView: React.FC<DanceLogViewProps> = ({ onGoPractice, prefillData, clearPrefill }) => {
    const [view, setView] = useState<'list' | 'detail' | 'create'>('list');
    const [logs, setLogs] = useState<DanceLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<DanceLog | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    
    // Creator State
    const [newLogVideo, setNewLogVideo] = useState<File | null>(null);
    const [creatorStep, setCreatorStep] = useState(1);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<DanceLog>>({
        song: '',
        teacher: '',
        studio: '',
        difficulty: 3,
        styles: [],
        mood: 'neutral',
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        durationSeconds: 90 * 60
    });

    useEffect(() => {
        loadLogs();
    }, []);

    // Handle Prefill Data from Schedule
    useEffect(() => {
        if (prefillData) {
            setFormData(prev => ({ ...prev, ...prefillData }));
            setIsEditing(false); // New log, just prefilled
            setNewLogVideo(null); // Wait for user to pick video
            setCreatorStep(1); // Start from video pick
            setView('create');
            if (clearPrefill) clearPrefill();
        }
    }, [prefillData]);

    const loadLogs = async () => {
        try {
            const data = await getLogs();
            setLogs(data);
        } catch (e) {
            console.error("Failed to load logs", e);
        }
    };

    const handleCreateStart = () => {
        setNewLogVideo(null);
        setCreatorStep(1);
        setIsEditing(false);
        setFormData({
            song: '',
            teacher: '',
            studio: '',
            difficulty: 3,
            styles: [],
            mood: 'neutral',
            date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
            durationSeconds: 90 * 60
        });
        setView('create');
    };

    const handleEditStart = (log: DanceLog) => {
        setNewLogVideo(null); // Keep existing video unless changed
        setFormData({ ...log });
        setIsEditing(true);
        setCreatorStep(2); // Skip video step for now
        setView('create');
    }

    const handleDelete = async (id: string) => {
        if (confirm("确定要删除这条舞迹吗？")) {
            await deleteLog(id);
            if (view === 'detail') setView('list');
            loadLogs();
        }
    };

    const handleSaveLog = async () => {
        const id = isEditing && formData.id ? formData.id : crypto.randomUUID();
        let thumb = formData.thumbnail;
        
        // Only generate new thumb if video changed
        if (newLogVideo) {
            thumb = await generateThumbnail(newLogVideo);
        }
        
        const log: DanceLog = {
            id,
            date: formData.date || new Date().toISOString(),
            videoBlob: newLogVideo || formData.videoBlob, 
            thumbnail: thumb,
            studio: formData.studio || '未知舞室',
            teacher: formData.teacher || 'Me',
            song: formData.song || 'Freestyle',
            styles: formData.styles || [],
            difficulty: formData.difficulty || 3,
            reflection: formData.reflection,
            mood: formData.mood as any,
            durationSeconds: formData.durationSeconds
        };

        await saveLog(log);
        loadLogs();
        if (isEditing) {
            setSelectedLog(log);
            setView('detail');
        } else {
            setView('list');
        }
    };

    // Inline Detail View Logic
    const renderDetailView = () => {
        if (!selectedLog) return null;
        const LogMoodIcon = MOODS.find(m => m.key === selectedLog.mood)?.icon || Smile;
        const logMoodColor = MOODS.find(m => m.key === selectedLog.mood)?.color || 'text-gray-400';
        // Need video URL logic here if inlining, or better: keep using state or memo
        // Simpler for now: just render what we had, but inside the main return or as a clean function *called* in render
        return (
             <div className="flex flex-col h-full bg-white animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center p-4 sticky top-0 bg-white/80 backdrop-blur z-10">
                    <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-full"><ChevronLeft /></button>
                    <div className="flex gap-2">
                        <button onClick={() => handleEditStart(selectedLog)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors"><PenLine size={20} /></button>
                        <button onClick={() => handleDelete(selectedLog.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-full"><Trash2 size={20}/></button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <div className="aspect-[4/5] bg-black w-full relative">
                        {selectedLog.videoBlob ? (
                            <video src={URL.createObjectURL(selectedLog.videoBlob)} controls className="w-full h-full object-contain" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">无视频源</div>
                        )}
                        <button 
                            onClick={() => selectedLog.videoBlob && onGoPractice(selectedLog.videoBlob)}
                            className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-black text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 backdrop-blur-sm"
                        >
                            <Play size={12} fill="currentColor"/> 去练舞
                        </button>
                    </div>
                    <div className="p-6 space-y-6 pb-24">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h1 className="text-2xl font-black text-gray-900">{selectedLog.song || '未命名舞曲'}</h1>
                                <LogMoodIcon className={`${logMoodColor} shrink-0`} size={24} />
                            </div>
                            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                    <Calendar size={14} className="text-red-500" /> 
                                    {format(parseISO(selectedLog.date), 'yyyy年MM月dd日 HH:mm')}
                                </div>
                                {selectedLog.durationSeconds && (
                                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                                        <Clock size={14} className="text-gray-400" /> 
                                        {Math.floor(selectedLog.durationSeconds / 60)} min
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">老师</div>
                                <div className="font-bold text-gray-900 flex items-center gap-2 truncate">
                                    <User size={14} className="shrink-0"/> {selectedLog.teacher || '未填写'}
                                </div>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">舞室</div>
                                <div className="font-bold text-gray-900 flex items-center gap-2 truncate">
                                    <MapPin size={14} className="shrink-0"/> {selectedLog.studio || '未填写'}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">难度系数</div>
                            <div className="flex gap-1">
                                {Array.from({length: 5}).map((_, i) => (
                                    <Star key={i} size={20} className={i < selectedLog.difficulty ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                                ))}
                            </div>
                        </div>
                        {selectedLog.reflection && (
                            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                                <div className="text-[10px] text-yellow-600 uppercase font-bold tracking-wider mb-2">课后反思</div>
                                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedLog.reflection}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    };

    // LIST VIEW Logic
    const filteredLogs = logs.filter(l => {
        const matchesMonth = isSameMonth(parseISO(l.date), selectedMonth);
        if (searchTerm.trim() !== '') {
            const term = searchTerm.toLowerCase();
            return (l.song?.toLowerCase().includes(term) ?? false) ||
                   (l.teacher?.toLowerCase().includes(term) ?? false) ||
                   (l.studio?.toLowerCase().includes(term) ?? false);
        }
        return matchesMonth;
    });

    const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return d;
    });

    return (
        <div className="h-full w-full bg-white relative">
            {view === 'list' && (
                <div className="flex flex-col h-full bg-gray-50 relative">
                    <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-20 px-4 py-4 border-b border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-2xl font-black italic text-gray-900">TRACKS<span className="text-red-600">.</span></h2>
                            <button 
                                onClick={handleCreateStart}
                                className="p-2 bg-black text-white rounded-full hover:scale-105 transition-transform shadow-lg shadow-black/20"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="搜索舞曲、老师、舞室..." 
                                className="w-full bg-gray-100 rounded-xl py-3 pl-10 pr-4 text-xs font-bold focus:bg-white focus:ring-2 focus:ring-black/5 outline-none transition-all placeholder-gray-400 text-gray-900"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3 text-gray-400 hover:text-black">
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        {!searchTerm && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                                {months.map(m => {
                                    const isSelected = isSameMonth(m, selectedMonth);
                                    return (
                                        <button
                                            key={m.toISOString()}
                                            onClick={() => setSelectedMonth(m)}
                                            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                                                isSelected 
                                                ? 'bg-red-600 text-white shadow-md' 
                                                : 'bg-white text-gray-500 border border-gray-100'
                                            }`}
                                        >
                                            {format(m, 'yyyy年 M月', { locale: zhCN })}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                        {filteredLogs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                                <Video size={48} className="opacity-20" />
                                <p className="text-xs font-bold">{searchTerm ? '未找到相关舞迹' : '本月暂无舞迹'}</p>
                            </div>
                        ) : (
                            filteredLogs.map(log => (
                                <div 
                                    key={log.id}
                                    onClick={() => { setSelectedLog(log); setView('detail'); }}
                                    className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex gap-3 cursor-pointer active:scale-[0.98] transition-transform group"
                                >
                                    <div className="w-24 h-32 bg-gray-900 rounded-xl shrink-0 overflow-hidden relative">
                                        {log.thumbnail ? (
                                            <img src={log.thumbnail} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-600"><Play size={20} /></div>
                                        )}
                                        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] text-white font-mono">
                                            {format(parseISO(log.date), 'MM.dd')}
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-1">
                                        <div>
                                            <h3 className="font-bold text-gray-900 line-clamp-1 text-lg leading-tight mb-1">{log.song || '未命名舞曲'}</h3>
                                            <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                                                <span className="flex items-center gap-1"><MapPin size={10} /> {log.studio || '未知地点'}</span>
                                                <span className="flex items-center gap-1"><User size={10} /> {log.teacher || '未知老师'}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {log.styles.slice(0, 3).map(s => (
                                                    <span key={s} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[9px] font-bold uppercase">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
                                            <div className="flex gap-0.5">
                                                {Array.from({length: log.difficulty}).map((_, i) => (
                                                    <Star key={i} size={10} className="fill-yellow-400 text-yellow-400" />
                                                ))}
                                            </div>
                                            {log.mood && (
                                                <div className="text-gray-400">
                                                    {React.createElement(
                                                        MOODS.find(m => m.key === log.mood)?.icon || Smile, 
                                                        { size: 14, className: MOODS.find(m => m.key === log.mood)?.color }
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {view === 'detail' && renderDetailView()}
            {view === 'create' && (
                <LogCreator 
                    formData={formData} 
                    setFormData={setFormData}
                    isEditing={isEditing}
                    newLogVideo={newLogVideo}
                    setNewLogVideo={setNewLogVideo}
                    step={creatorStep}
                    setStep={setCreatorStep}
                    onSave={handleSaveLog}
                    onCancel={() => isEditing ? setView('detail') : setView('list')}
                />
            )}
        </div>
    );
};