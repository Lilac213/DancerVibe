import React from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { X, Plus, MapPin, Users, Clock, CalendarDays, ArrowRight } from 'lucide-react';
import { ClassSession } from '../types';

interface DayScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  classes: ClassSession[];
  onAddClass: () => void;
  onEditClass: (cls: ClassSession) => void;
}

const DayScheduleModal: React.FC<DayScheduleModalProps> = ({
  isOpen, onClose, date, classes, onAddClass, onEditClass
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
           <div>
             <h2 className="text-2xl font-black text-gray-900">{format(date, 'M月d日', {locale: zhCN})}</h2>
             <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{format(date, 'EEEE', {locale: zhCN})}</p>
           </div>
          <button onClick={onClose} className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-black transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3 min-h-[300px] scrollbar-thin scrollbar-thumb-gray-200 bg-gray-50/50">
            {classes.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4 py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <CalendarDays size={24} />
                    </div>
                    <p className="font-medium text-sm">暂无课程安排</p>
                </div>
            ) : (
                classes.map(cls => (
                    <div 
                        key={cls.id}
                        onClick={() => onEditClass(cls)}
                        className={`cursor-pointer p-5 rounded-2xl border flex flex-col gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md group ${
                            cls.type === 'flow' 
                            ? 'bg-black border-black text-white' 
                            : 'bg-white border-gray-100 hover:border-red-100'
                        }`}
                    >
                        <div className="flex justify-between items-start">
                            <div className={`flex items-center gap-2 font-mono text-xs font-bold px-2 py-1 rounded-md ${
                                cls.type === 'flow' ? 'bg-gray-800 text-gray-200' : 'bg-red-50 text-red-600'
                            }`}>
                                <Clock size={12} />
                                <span>{cls.startTime} - {cls.endTime}</span>
                            </div>
                            {cls.type === 'flow' && (
                                <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded-full font-black tracking-wider uppercase">临时</span>
                            )}
                        </div>
                        
                        <div>
                            <div className={`font-black text-xl leading-tight mb-2 ${cls.type === 'flow' ? 'text-white' : 'text-gray-900 group-hover:text-red-600 transition-colors'}`}>
                                {cls.song || '常规课'}
                            </div>
                            <div className={`flex items-center gap-4 text-xs font-medium ${cls.type === 'flow' ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span className="flex items-center gap-1.5"><MapPin size={14} /> {cls.studio}</span>
                                <span className="flex items-center gap-1.5"><Users size={14} /> {cls.teacher}</span>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
            <button 
                onClick={onAddClass}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 group"
            >
                <Plus size={20} /> 
                <span>添加课程</span>
                <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default DayScheduleModal;