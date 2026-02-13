import React, { useState, useEffect } from 'react';
import { ClassSession } from '../types';
import { checkConflict } from '../utils/dateUtils';
import { format, addMinutes, parse } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X, AlertTriangle, Calendar, Clock, MapPin, Music, User, Video } from 'lucide-react';
import { TimePicker24h } from './TimePicker';

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (classData: ClassSession | ClassSession[]) => void;
  onDelete?: (id: string) => void;
  onGoToRecord?: (classData: ClassSession, targetDate: Date) => void;
  initialData?: Partial<ClassSession>;
  allClasses: ClassSession[];
  targetDate: Date;
  isAiLoading?: boolean;
}

const generateId = () => {
  return crypto.randomUUID();
};

const DURATIONS = [
    { label: '1h', value: 60 },
    { label: '1.5h', value: 90 },
    { label: '2h', value: 120 },
    { label: '2.5h', value: 150 },
];

const ClassModal: React.FC<ClassModalProps> = ({ isOpen, onClose, onSave, onDelete, onGoToRecord, initialData, allClasses, targetDate, isAiLoading }) => {
  const [formData, setFormData] = useState<Partial<ClassSession>>({
    startTime: '19:00',
    endTime: '20:30', // Default 1.5h
    studio: '',
    teacher: '',
    song: '',
    type: 'fixed',
    dayOfWeek: 1,
  });

  const [duration, setDuration] = useState(90); // Default duration in minutes
  const [conflict, setConflict] = useState<{ hasConflict: boolean; message?: string }>({ hasConflict: false });
  const [confirmConflict, setConfirmConflict] = useState(false);

  // Initialize Data
  useEffect(() => {
    if (isOpen) {
      const defaultDay = targetDate.getDay();
      
      const defaults = {
        startTime: '19:00',
        endTime: '20:30',
        studio: '',
        teacher: '',
        song: '',
        type: 'fixed' as const,
        dayOfWeek: defaultDay,
        date: format(targetDate, 'yyyy-MM-dd')
      };

      const mergedData = initialData ? { ...defaults, ...initialData } : defaults;
      setFormData(mergedData);

      // Calculate initial duration from start/end time if editing
      if (mergedData.startTime && mergedData.endTime) {
          const start = parse(mergedData.startTime, 'HH:mm', new Date());
          let end = parse(mergedData.endTime, 'HH:mm', new Date());
          // Handle Next Day case roughly (if end < start, assume next day)
          if (end < start) {
             end = addMinutes(end, 24 * 60);
          }
          const diffDiff = (end.getTime() - start.getTime()) / 1000 / 60;
          // Snap to closest duration or set custom? For now, we set it if it matches, else default to 90
          const match = DURATIONS.find(d => Math.abs(d.value - diffDiff) < 5);
          if (match) {
              setDuration(match.value);
          } else {
              setDuration(90); 
          }
      }

      setConflict({ hasConflict: false });
      setConfirmConflict(false);
    }
  }, [isOpen, initialData, targetDate]);

  // Auto Calculate End Time and Check Conflict
  useEffect(() => {
    if (!formData.startTime) return;

    // 1. Calculate End Time based on Start Time + Duration
    const baseDate = new Date(); // Reference date only for time calc
    const startObj = parse(formData.startTime, 'HH:mm', baseDate);
    const endObj = addMinutes(startObj, duration);
    const calculatedEndTime = format(endObj, 'HH:mm');

    // Update formData locally without triggering infinite loop if value is same
    if (calculatedEndTime !== formData.endTime) {
        setFormData(prev => ({ ...prev, endTime: calculatedEndTime }));
        return; // Return here, let the next render run conflict check with updated state
    }

    // 2. Check Conflict using the calculated times
    const tempClass: ClassSession = {
      id: initialData?.id || 'temp',
      dayOfWeek: formData.dayOfWeek || 0,
      startTime: formData.startTime,
      endTime: calculatedEndTime,
      studio: formData.studio || '',
      teacher: formData.teacher || '',
      song: formData.song || '',
      type: formData.type || 'fixed',
      date: formData.type === 'flow' ? format(targetDate, 'yyyy-MM-dd') : undefined,
    };

    const checkDate = targetDate;
    const result = checkConflict(tempClass, allClasses, checkDate);
    
    if (result.hasConflict && result.conflictingClass) {
      setConflict({
        hasConflict: true,
        message: `冲突: ${result.conflictingClass.studio} (${result.conflictingClass.startTime} - ${result.conflictingClass.endTime})`
      });
    } else {
      setConflict({ hasConflict: false });
    }

  }, [formData.startTime, duration, formData.endTime, formData.dayOfWeek, formData.type, allClasses, initialData, targetDate]);


  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (conflict.hasConflict && !confirmConflict) {
      setConfirmConflict(true);
      return;
    }

    const baseClass = {
      id: initialData?.id || generateId(),
      dayOfWeek: formData.dayOfWeek!,
      startTime: formData.startTime!,
      endTime: formData.endTime!,
      studio: formData.studio!,
      teacher: formData.teacher!,
      song: formData.song!,
      type: formData.type!,
      date: formData.type === 'flow' ? format(targetDate, 'yyyy-MM-dd') : undefined,
    } as ClassSession;

    onSave(baseClass);
  };

  const handleRecordClick = () => {
      if (onGoToRecord && formData) {
          onGoToRecord(formData as ClassSession, targetDate);
      }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                {initialData?.id ? '编辑课程' : '添加课程'}
            </h2>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                <Calendar size={12} /> {format(targetDate, 'MMMM d, EEEE', {locale: zhCN})}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          
          {/* Type Toggle */}
          <div className="bg-gray-50 p-1.5 rounded-2xl border border-gray-100 flex gap-1">
            <button
              type="button"
              className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                formData.type === 'fixed' 
                  ? 'bg-red-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-gray-900 hover:bg-white'
              }`}
              onClick={() => setFormData({ ...formData, type: 'fixed' })}
            >
              固定课
            </button>
            <button
              type="button"
              className={`flex-1 py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                formData.type === 'flow' 
                  ? 'bg-black text-white shadow-md' 
                  : 'text-gray-400 hover:text-gray-900 hover:bg-white'
              }`}
              onClick={() => setFormData({ ...formData, type: 'flow' })}
            >
              临时课
            </button>
          </div>

          {/* Time & Duration Logic */}
          <div className="space-y-3">
             <div className="flex justify-between items-baseline px-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">开始时间 & 时长</label>
                <span className="text-xs font-mono font-medium text-gray-500">
                    预计结束: <span className="text-black font-bold font-mono">{formData.endTime}</span>
                </span>
             </div>
             
             {/* 24h Time Picker */}
             <div className="flex flex-col gap-4">
                <TimePicker24h 
                    value={formData.startTime || '19:00'} 
                    onChange={(val) => setFormData({ ...formData, startTime: val })}
                />

                {/* Duration Selectors */}
                <div className="grid grid-cols-4 gap-2">
                    {DURATIONS.map((d) => (
                        <button
                            key={d.value}
                            type="button"
                            onClick={() => setDuration(d.value)}
                            className={`text-xs font-bold rounded-xl border-2 transition-all py-2.5 ${
                                duration === d.value 
                                ? 'bg-black text-white border-black' 
                                : 'bg-white text-gray-500 border-gray-100 hover:border-gray-300'
                            }`}
                        >
                            {d.label}
                        </button>
                    ))}
                </div>
             </div>
          </div>

          {/* Info Inputs */}
          <div className="space-y-5">
            <div className="relative group">
               <MapPin className="absolute left-3.5 top-4 text-gray-400 group-focus-within:text-red-600 transition-colors" size={18} />
               <input
                type="text"
                required
                placeholder="教室 / 舞室"
                className="w-full bg-white border-2 border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 placeholder-gray-400 focus:border-red-600 outline-none transition-all"
                value={formData.studio}
                onChange={(e) => setFormData({ ...formData, studio: e.target.value })}
              />
            </div>
            <div className="relative group">
               <User className="absolute left-3.5 top-4 text-gray-400 group-focus-within:text-red-600 transition-colors" size={18} />
               <input
                type="text"
                required
                placeholder="导师姓名"
                className="w-full bg-white border-2 border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 placeholder-gray-400 focus:border-red-600 outline-none transition-all"
                value={formData.teacher}
                onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
              />
            </div>
             <div className="relative group">
               <Music className="absolute left-3.5 top-4 text-gray-400 group-focus-within:text-red-600 transition-colors" size={18} />
               <input
                type="text"
                placeholder={formData.type === 'fixed' ? "本周舞曲内容" : "舞曲 / 编舞内容"}
                className="w-full bg-white border-2 border-gray-100 rounded-xl py-3.5 pl-11 pr-4 text-gray-900 placeholder-gray-400 focus:border-red-600 outline-none transition-all"
                value={formData.song}
                onChange={(e) => setFormData({ ...formData, song: e.target.value })}
              />
            </div>
             {formData.type === 'fixed' && (
                <div className="text-[10px] text-gray-400 px-2 -mt-3">
                    * 修改固定课的歌曲内容不会改变课程性质。
                </div>
            )}
          </div>

          {/* Conflict Warning */}
          {conflict.hasConflict && !confirmConflict && (
             <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
               <div className="bg-red-100 p-1.5 rounded-full shrink-0">
                  <AlertTriangle className="text-red-600 w-4 h-4" />
               </div>
               <div className="text-sm">
                 <p className="font-bold text-red-900">时间冲突</p>
                 <p className="text-red-700 mt-0.5 text-xs">{conflict.message}</p>
                 <button 
                  type="button"
                  onClick={() => setConfirmConflict(true)}
                  className="mt-2 text-xs font-bold text-red-600 bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                 >
                   忽略并继续
                 </button>
               </div>
             </div>
          )}

           {/* Conflict Confirmation */}
           {confirmConflict && (
             <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-center">
               <p className="text-orange-800 text-xs font-bold">⚠️ 忽略冲突强制添加</p>
             </div>
          )}

          <div className="pt-2 flex gap-3">
            {initialData?.id && onDelete && (
                <button
                type="button"
                onClick={() => onDelete(initialData.id!)}
                className="flex-1 py-4 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                >
                删除
                </button>
            )}
            
            {/* Go to Record Button (Only in Edit Mode and if provided) */}
            {initialData?.id && onGoToRecord && (
                <button
                    type="button"
                    onClick={handleRecordClick}
                    className="flex-1 py-4 text-sm font-bold text-black bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center justify-center gap-1"
                >
                    <Video size={16} /> 去记录
                </button>
            )}

            <button
              type="submit"
              className={`flex-1 py-4 text-sm font-bold text-white rounded-xl transition-all shadow-xl shadow-red-600/20 ${
                  conflict.hasConflict && !confirmConflict 
                  ? 'bg-gray-300 cursor-not-allowed shadow-none'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              disabled={conflict.hasConflict && !confirmConflict}
            >
              {initialData?.id ? '保存修改' : (confirmConflict ? '确认添加' : '添加课程')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassModal;