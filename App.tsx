import React, { useState, useEffect, useMemo } from 'react';
import { addWeeks, format, isSameDay, addMonths, isSameMonth, endOfWeek, isWithinInterval, subWeeks, subMonths, startOfWeek, parseISO } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Share2, Plus, Users, MapPin, Zap, LayoutGrid, Calendar as CalendarIcon, Sparkles, LogOut, Loader2, Database, Mic, AlertCircle, Fingerprint, RefreshCcw, Calendar, PlayCircle, Footprints, Compass, UserCircle } from 'lucide-react';
import ClassModal from './components/ClassModal';
import AiScheduleAssistant from './components/AiScheduleAssistant';
import DayScheduleModal from './components/DayScheduleModal';
import AuthScreen from './components/AuthScreen';
import { WeekView } from './components/WeekView';
import { PracticeTool } from './components/PracticeTool';
import { DanceLogView } from './components/DanceLogView';
import { DiscoverView, Recommendation } from './components/DiscoverView';
import { ProfileView } from './components/ProfileView';
import { PublicProfileView } from './components/PublicProfileView';
import { ClassSession, User, Tag, DanceLog } from './types';
import { getClassesForDate, getWeekDays, getMonthDays } from './utils/dateUtils';
import { generateSummary, generateEntityTags } from './services/geminiService';
import { initSupabase, fetchClasses, upsertClass, deleteClass as deleteClassDb, batchUpsertClasses, batchDeleteClasses, checkConnection, fetchTags, batchUpsertTags } from './services/scheduleService';
import { saveVideo } from './services/videoStorage';

// Fallback Mock Data
const MOCK_TEACHER_CLASSES: ClassSession[] = [
  { id: '550e8400-e29b-41d4-a716-446655440000', dayOfWeek: 1, startTime: '19:00', endTime: '20:30', studio: 'Millennium', teacher: '我', song: 'New Jeans - OMG', type: 'fixed' },
  { id: '550e8400-e29b-41d4-a716-446655440001', dayOfWeek: 3, startTime: '20:00', endTime: '21:30', studio: 'En Dance', teacher: '我', song: 'Tyla - Water', type: 'fixed' },
];

type Tab = 'log' | 'schedule' | 'discover' | 'practice' | 'profile';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('log');
  
  // Schedule State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [isTaggingLoading, setIsTaggingLoading] = useState(false);
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDayPreviewOpen, setIsDayPreviewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingClass, setEditingClass] = useState<Partial<ClassSession> | undefined>(undefined);
  
  // Bot/AI States
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [startVoiceImmediately, setStartVoiceImmediately] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Cross-Tab Data passing
  const [logPrefillData, setLogPrefillData] = useState<Partial<DanceLog> | null>(null);

  // Public Profile Viewing
  const [viewingProfile, setViewingProfile] = useState<User | null>(null);

  // Memoized dates
  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => getMonthDays(currentDate), [currentDate]);

  // Load classes from Supabase when user logs in
  useEffect(() => {
    const loadData = async () => {
        if (user && supabaseReady) {
            setIsLoadingClasses(true);
            setDbError(null);
            try {
                // Test connection
                const isConnected = await checkConnection();
                if (!isConnected) {
                    setDbError("无法连接到数据库，请检查网络或配置");
                    return;
                }

                const [clsData, tagsData] = await Promise.all([
                    fetchClasses(user),
                    fetchTags(user)
                ]);
                
                setClasses(clsData);
                setTags(tagsData);

            } catch (error: any) {
                console.error("Failed to load data", error);
                setDbError(error.message || "加载数据失败");
                if (classes.length === 0) setClasses([]); 
            } finally {
                setIsLoadingClasses(false);
            }
        } else if (user && !supabaseReady) {
            setClasses(MOCK_TEACHER_CLASSES);
        }
    };
    loadData();
  }, [user, supabaseReady]);

  // Trigger Tagging Agent
  const triggerTaggingAgent = async () => {
    if (!user || classes.length === 0) return;
    setIsTaggingLoading(true);
    try {
        const newTags = await generateEntityTags(user, classes);
        setTags(newTags);
        if (supabaseReady) {
            await batchUpsertTags(newTags);
        }
    } catch (e) {
        console.error("Tagging failed", e);
    } finally {
        setIsTaggingLoading(false);
    }
  };

  // Navigation
  const next = () => viewMode === 'week' ? setCurrentDate(addWeeks(currentDate, 1)) : setCurrentDate(addMonths(currentDate, 1));
  const prev = () => viewMode === 'week' ? setCurrentDate(subWeeks(currentDate, 1)) : setCurrentDate(subMonths(currentDate, 1));
  const resetToToday = () => setCurrentDate(new Date());

  // CRUD
  const handleAddClass = (date: Date, startTime: string = '19:00') => {
    setSelectedDate(date);
    setEditingClass({ startTime });
    setIsModalOpen(true);
    setIsDayPreviewOpen(false);
  };

  const handleEditClass = (cls: ClassSession, date: Date) => {
    setSelectedDate(date);
    setEditingClass(cls);
    setIsModalOpen(true);
    setIsDayPreviewOpen(false);
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsDayPreviewOpen(true);
  };

  // Bridge: Discover -> Schedule
  const handleRecAddToSchedule = (rec: any) => {
      // Assuming rec is a CourseRec
      // Convert Recommendation to ClassSession format for pre-filling
      const [start, end] = rec.time.split('-');
      
      const newClass: Partial<ClassSession> = {
          startTime: start,
          endTime: end,
          studio: rec.studio,
          teacher: rec.teacher,
          song: rec.title,
          type: 'fixed', // Default to fixed? or flow? Let's assume user wants to add as fixed weekly class from discover
          dayOfWeek: new Date().getDay() // Default to today or ask user? Defaulting to today's DOW
      };
      
      setEditingClass(newClass);
      setSelectedDate(new Date()); // Use today as base
      setIsModalOpen(true);
      setActiveTab('schedule'); // Switch tab
  };

  // Bridge: Discover -> Public Profile
  const handleViewProfile = (userId: string, userName: string) => {
      // Mock fetching user data based on ID
      const mockUser: User = {
          name: userName,
          role: 'student',
          bio: 'Hiphop 爱好者 | 周五 Millennium 见',
          privacy: { publicSchedule: true, buddyRec: true },
          modules: [
              { id: '1', title: '我的性格标签', type: 'tags', content: 'E人, 熬夜冠军' }
          ],
          social: { xiaohongshu: '123456' }
      };
      setViewingProfile(mockUser);
  };

  // Bridge: Schedule -> Log
  const handleGoToRecord = (classData: ClassSession, targetDate: Date) => {
      setIsModalOpen(false);
      setIsDayPreviewOpen(false);
      
      // Calculate duration in minutes if possible
      let duration = 90;
      if (classData.startTime && classData.endTime) {
          const [sh, sm] = classData.startTime.split(':').map(Number);
          const [eh, em] = classData.endTime.split(':').map(Number);
          duration = (eh * 60 + em) - (sh * 60 + sm);
          if (duration < 0) duration += 24 * 60; // Handle next day
      }

      setLogPrefillData({
          song: classData.song,
          teacher: classData.teacher,
          studio: classData.studio,
          date: format(targetDate, "yyyy-MM-dd") + 'T' + (classData.startTime || "19:00"),
          durationSeconds: duration * 60
      });
      setActiveTab('log');
  };

  const saveClass = async (classData: ClassSession | ClassSession[]) => {
    const newItems = Array.isArray(classData) ? classData : [classData];
    
    // Update local state
    setClasses(prev => {
        let updated = [...prev];
        // For each new item, update if exists, else add
        for (const newItem of newItems) {
            const exists = updated.find(c => c.id === newItem.id);
            if (exists) {
                updated = updated.map(c => c.id === newItem.id ? newItem : c);
            } else {
                updated.push(newItem);
            }
        }
        return updated;
    });

    setIsModalOpen(false);
    if (viewMode === 'month') setIsDayPreviewOpen(true);

    if (user && supabaseReady) {
        try {
            await batchUpsertClasses(newItems, user);
            setDbError(null);
        } catch (e: any) {
            console.error("Sync error", e);
            setDbError(`保存失败: ${e.message}`);
        }
    }
  };

  const deleteClass = async (id: string) => {
    const prevClasses = [...classes];
    setClasses(classes.filter(c => c.id !== id));
    setIsModalOpen(false);
    if (viewMode === 'month') setIsDayPreviewOpen(true);

    if (user && supabaseReady) {
        try {
            await deleteClassDb(id);
            setDbError(null);
        } catch (e: any) {
            console.error("Sync error", e);
            setDbError(`删除失败: ${e.message}`);
        }
    }
  };

  // AI & Export
  const handleAiBatchAdd = async (newClasses: Partial<ClassSession>[]) => {
    const adds: ClassSession[] = [];
    const removes: string[] = [];
    const removeIds: string[] = [];

    newClasses.forEach(c => {
        const action = (c as any).action;
        const originalId = (c as any).originalId;

        if (action === 'remove' && originalId) {
            removes.push(originalId);
            removeIds.push(originalId);
        } else if (action === 'add' || !action) {
             adds.push({
                ...c,
                id: crypto.randomUUID(),
                startTime: c.startTime || '12:00',
                endTime: c.endTime || '13:30',
                dayOfWeek: c.dayOfWeek ?? 0,
                type: c.type || 'fixed',
                teacher: c.teacher || (user?.role === 'teacher' ? '我' : '待定'),
                studio: c.studio || '未知地点',
                song: c.song || '',
            } as ClassSession);
        }
    });

    const prevClasses = [...classes];
    setClasses(prev => {
        let updated = [...prev];
        if (removes.length > 0) {
            updated = updated.filter(cls => !removes.includes(cls.id));
        }
        return [...updated, ...adds];
    });

    if (user && supabaseReady) {
        try {
            await Promise.all([
                batchUpsertClasses(adds, user),
                batchDeleteClasses(removeIds)
            ]);
            setDbError(null);
            setTimeout(() => triggerTaggingAgent(), 2000);
        } catch (e: any) {
            console.error("Batch sync error", e);
            setDbError(`批量同步失败: ${e.message}`);
        }
    }
  };

  const handleGenerateSummary = async () => {
    if (!user) return;
    setIsSummaryLoading(true);
    let classesToExport = classes;
    if (viewMode === 'week') {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        classesToExport = classes.filter(c => {
            if (c.type === 'fixed') return true;
            if (c.type === 'flow' && c.date) return isWithinInterval(parseISO(c.date), { start, end });
            return false;
        });
    }
    // CHANGED: Pass full user object, not just role
    const summary = await generateSummary(classesToExport, user, viewMode, currentDate);
    setGeneratedSummary(summary);
    setIsSummaryLoading(false);
  };

  // Bridge between DanceLog and Practice Tool
  const handleLogGoPractice = async (videoBlob: Blob) => {
      // 1. Switch Tab
      setActiveTab('practice');
      // 2. Save blob to practice storage (VideoStorage) automatically
      try {
          // Convert Blob to File to match signature
          const file = new File([videoBlob], `LogExport_${new Date().getTime()}.mp4`, { type: videoBlob.type });
          await saveVideo(file);
          // Note: The PracticeTool will auto-refresh on mount, so switching tab should show it in 'Recent'
          alert("视频已导入练习室！");
      } catch (e) {
          console.error("Failed to import to practice", e);
          alert("导入失败，请重试");
      }
  };

  const handleLogin = (userData: User, key: string) => {
    setUser(userData);
    const client = initSupabase(key);
    if (client) {
        setSupabaseReady(true);
    } else {
        setSupabaseReady(false);
    }
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen pb-24 bg-gray-50 text-gray-900 font-sans selection:bg-red-500/20 flex flex-col">
      
      {/* Header (Simplified) */}
      {activeTab !== 'log' && activeTab !== 'discover' && activeTab !== 'profile' && !viewingProfile && (
      <header className="relative bg-white border-b border-gray-100 shadow-sm z-30 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center shadow-lg shadow-red-600/20">
                   <Zap className="text-white fill-white w-4 h-4" />
                </div>
                <div>
                    <h1 className="text-lg font-black tracking-tight text-gray-900 italic leading-none">
                        Dancer<span className="text-red-600">Vibe</span>
                    </h1>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">街舞人专属智能工具</p>
                </div>
            </div>
            <div className="flex gap-2 items-center">
                {activeTab === 'schedule' && (
                    <span className="text-xs text-gray-500 hidden sm:inline flex items-center gap-1.5 font-medium">
                    {supabaseReady ? (
                            <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                <Database size={10} />
                                <span className="text-[10px] font-bold">在线</span>
                            </span>
                    ) : (
                            <span className="flex items-center gap-1 text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                <Database size={10} />
                                <span className="text-[10px]">本地</span>
                            </span>
                    )}
                    </span>
                )}
            </div>
          </div>
          
          {/* View Toggles (Only for Schedule Tab) */}
          {activeTab === 'schedule' && (
            <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200 w-full max-w-xs mx-auto animate-in fade-in slide-in-from-top-1">
                <button 
                    onClick={() => setViewMode('week')}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                        viewMode === 'week' ? 'bg-white text-black shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    <LayoutGrid size={14} /> 周视图
                </button>
                <button 
                    onClick={() => setViewMode('month')}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${
                        viewMode === 'month' ? 'bg-white text-black shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'
                    }`}
                >
                    <CalendarIcon size={14} /> 月视图
                </button>
            </div>
          )}
        </div>
      </header>
      )}
      
      {/* Tab 1: Schedule Content */}
      {activeTab === 'schedule' && (
          <div className="flex-1 max-w-4xl mx-auto px-4 py-4 w-full animate-in fade-in duration-300">
            {/* Error Banner */}
            {dbError && (
                <div className="bg-red-50 border-b border-red-100 px-4 py-2 flex items-center justify-center gap-2 text-xs font-bold text-red-600 animate-in slide-in-from-top-2 mb-4 rounded-xl">
                    <AlertCircle size={14} />
                    <span>{dbError}</span>
                </div>
            )}

            {/* Loading Indicator */}
            {isLoadingClasses && (
                <div className="flex justify-center py-2 mb-2">
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                        <Loader2 size={12} className="animate-spin" /> 
                        <span>正在同步云端数据...</span>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-6 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                <button onClick={prev} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-black transition-colors"><ChevronLeft /></button>
                <div className="flex flex-col items-center cursor-pointer" onClick={resetToToday}>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
                        {viewMode === 'week' ? '本周' : '本月'}
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                        {viewMode === 'week' 
                            ? `${format(weekDays[0], 'M月d日', {locale: zhCN})} - ${format(weekDays[6], 'M月d日', {locale: zhCN})}` 
                            : format(currentDate, 'yyyy年 MMMM', {locale: zhCN})
                        }
                    </span>
                </div>
                <button onClick={next} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-black transition-colors"><ChevronRight /></button>
            </div>

            {/* --- WEEK VIEW (TIME GRID) --- */}
            {viewMode === 'week' && (
                <WeekView 
                    weekDays={weekDays}
                    classes={classes}
                    onAddClass={handleAddClass}
                    onEditClass={handleEditClass}
                />
            )}

            {/* --- MONTH VIEW --- */}
            {viewMode === 'month' && (
                <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 mb-4">
                        {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
                            <div key={day} className="text-center text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-2">
                        {monthDays.map((day, idx) => {
                            const dayClasses = getClassesForDate(day, classes);
                            const isCurrentMonth = isSameMonth(day, currentDate);
                            const isToday = isSameDay(day, new Date());
                            const hasFlow = dayClasses.some(c => c.type === 'flow');

                            return (
                                <div 
                                    key={day.toString()} 
                                    onClick={() => handleDayClick(day)}
                                    className={`
                                        min-h-[80px] p-2 rounded-2xl border flex flex-col justify-between cursor-pointer transition-all hover:shadow-md
                                        ${isToday ? 'bg-red-50 border-red-200 ring-1 ring-red-100' : 'bg-white border-gray-100 hover:border-gray-200'}
                                        ${!isCurrentMonth ? 'opacity-40 grayscale' : ''}
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-bold ${isToday ? 'text-red-600' : 'text-gray-700'}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {hasFlow && <div className="w-2 h-2 rounded-full bg-black"></div>}
                                    </div>
                                    
                                    <div className="flex flex-wrap content-end gap-1.5 mt-2">
                                        {dayClasses.slice(0, 4).map((c, i) => (
                                            <div 
                                                key={i} 
                                                className={`w-2 h-2 rounded-full ${c.type === 'flow' ? 'bg-black' : 'bg-red-500'}`} 
                                            />
                                        ))}
                                        {dayClasses.length > 4 && <div className="text-[9px] text-gray-400 font-bold">+</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Tab 2: Practice Content */}
      {activeTab === 'practice' && (
          <div className="flex-1 w-full max-w-4xl mx-auto h-full">
              <PracticeTool />
          </div>
      )}

      {/* Tab 3: Dance Log Content */}
      {activeTab === 'log' && (
          <div className="flex-1 w-full h-full max-w-4xl mx-auto bg-gray-50">
              <DanceLogView 
                onGoPractice={handleLogGoPractice} 
                prefillData={logPrefillData}
                clearPrefill={() => setLogPrefillData(null)}
              />
          </div>
      )}

      {/* Tab 4: Discover Content */}
      {activeTab === 'discover' && (
          <div className="flex-1 w-full h-full max-w-4xl mx-auto bg-gray-50">
              <DiscoverView 
                onAddToSchedule={handleRecAddToSchedule} 
                onViewProfile={handleViewProfile}
              />
          </div>
      )}

      {/* Tab 5: Profile Content (NEW) */}
      {activeTab === 'profile' && (
          <div className="flex-1 w-full h-full max-w-4xl mx-auto bg-gray-50">
              <ProfileView 
                user={user}
                tags={tags}
                onLogout={() => { setUser(null); setClasses([]); setTags([]); setSupabaseReady(false); }}
                onGenerateSummary={handleGenerateSummary}
                summary={generatedSummary}
                isSummaryLoading={isSummaryLoading}
                onTriggerTagging={triggerTaggingAgent}
                isTaggingLoading={isTaggingLoading}
              />
          </div>
      )}

      {/* Viewing Other Profile (Overlay) */}
      {viewingProfile && (
          <PublicProfileView 
              user={viewingProfile} 
              onBack={() => setViewingProfile(null)} 
          />
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
          <div className="max-w-md mx-auto flex justify-between items-center h-16 px-6">
              <button 
                onClick={() => setActiveTab('log')}
                className={`flex flex-col items-center gap-1 flex-1 justify-center ${activeTab === 'log' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <Footprints size={22} strokeWidth={activeTab === 'log' ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">舞迹</span>
              </button>

              <button 
                onClick={() => setActiveTab('schedule')}
                className={`flex flex-col items-center gap-1 flex-1 justify-center ${activeTab === 'schedule' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <Calendar size={22} strokeWidth={activeTab === 'schedule' ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">课表</span>
              </button>

              <button 
                onClick={() => setActiveTab('discover')}
                className={`flex flex-col items-center gap-1 flex-1 justify-center ${activeTab === 'discover' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <Compass size={22} strokeWidth={activeTab === 'discover' ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">推荐</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('practice')}
                className={`flex flex-col items-center gap-1 flex-1 justify-center ${activeTab === 'practice' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <PlayCircle size={22} strokeWidth={activeTab === 'practice' ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">练舞</span>
              </button>

              <button 
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center gap-1 flex-1 justify-center ${activeTab === 'profile' ? 'text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <UserCircle size={22} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                  <span className="text-[10px] font-bold">我的</span>
              </button>
          </div>
      </div>

      {/* Floating Action Button (Only show on Schedule Tab) */}
      {activeTab === 'schedule' && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 items-center pointer-events-none">
                <button 
                    onClick={() => {
                        setStartVoiceImmediately(false);
                        setIsAiAssistantOpen(true);
                    }}
                    className="group relative w-14 h-14 flex items-center justify-center transition-all hover:scale-105 active:scale-95 mb-1 pointer-events-auto"
                >
                    <div className="absolute inset-0 bg-red-600 rounded-full blur-lg opacity-40 group-hover:opacity-60 animate-pulse transition-opacity duration-500"></div>
                    <div className="relative w-full h-full bg-black text-white rounded-full shadow-2xl shadow-black/30 border border-white/10 flex items-center justify-center overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-black opacity-100"></div>
                        <Sparkles size={22} strokeWidth={2.5} className="relative z-10 text-red-500 fill-red-500 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                </button>
          </div>
      )}

      {/* Summary / Share Modal is now handled inside ProfileView for generating, but the display logic might stay or move.
          The requirement was "Personal Summary also placed in this page".
          So I moved the summary display into ProfileView. I removed the modal display here.
      */}

      {/* Components */}
      <ClassModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={saveClass}
        onDelete={deleteClass}
        onGoToRecord={handleGoToRecord}
        initialData={editingClass || {}}
        targetDate={selectedDate}
        allClasses={classes}
        isAiLoading={false}
      />

      <DayScheduleModal 
        isOpen={isDayPreviewOpen}
        onClose={() => setIsDayPreviewOpen(false)}
        date={selectedDate}
        classes={getClassesForDate(selectedDate, classes)}
        onAddClass={() => handleAddClass(selectedDate)}
        onEditClass={(cls) => handleEditClass(cls, selectedDate)}
      />

      <AiScheduleAssistant 
        isOpen={isAiAssistantOpen}
        onClose={() => setIsAiAssistantOpen(false)}
        onAddClasses={handleAiBatchAdd}
        existingClasses={classes}
        userRole={user.role}
        user={user}
        autoStartRecording={startVoiceImmediately}
      />

    </div>
  );
};

export default App;