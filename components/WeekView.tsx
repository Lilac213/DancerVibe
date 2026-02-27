import React from 'react';
import { format, isSameDay } from 'date-fns';
import { MapPin, Clock } from 'lucide-react';
import { ClassSession } from '../types';
import { getClassesForDate } from '../utils/dateUtils';

interface WeekViewProps {
  weekDays: Date[];
  classes: ClassSession[];
  onAddClass: (date: Date, startTime?: string) => void;
  onEditClass: (cls: ClassSession, date: Date) => void;
}

const START_HOUR = 9; 
const END_HOUR = 25;  
const HOUR_HEIGHT = 64; // Taller for better visibility
const WEEK_DAYS_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export const WeekView: React.FC<WeekViewProps> = ({ weekDays = [], classes = [], onAddClass, onEditClass }) => {
  if (!weekDays || weekDays.length === 0) {
      return <div className="p-4 text-center text-gray-500">正在加载课表...</div>;
  }

  const hours = Array.from({ length: Math.max(0, END_HOUR - START_HOUR + 1) }, (_, i) => i + START_HOUR);

  const getPositionStyle = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return { top: '0px', height: '0px', display: 'none' };
    
    let [startH, startM] = startTime.split(':').map(n => parseInt(n) || 0);
    let [endH, endM] = endTime.split(':').map(n => parseInt(n) || 0);
    
    if (startH < START_HOUR) startH += 24;
    if (endH < START_HOUR) endH += 24;
    if (endH < startH) endH += 24;

    const startTotalMinutes = startH * 60 + startM;
    const endTotalMinutes = endH * 60 + endM;
    const dayStartMinutes = START_HOUR * 60;
    
    const top = ((startTotalMinutes - dayStartMinutes) / 60) * HOUR_HEIGHT;
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    const height = (durationMinutes / 60) * HOUR_HEIGHT;

    return { 
        top: `${Math.max(0, top)}px`, 
        height: `${Math.max(32, height)}px` 
    };
  };

  const formatDisplayHour = (hour: number) => {
    if (hour === 24) return '00:00';
    if (hour > 24) return `${(hour - 24).toString().padStart(2, '0')}:00`;
    return `${hour}:00`;
  };

  const handleSlotClick = (day: Date, hour: number) => {
    let timeStr = `${hour}:00`;
    if (hour === 24) timeStr = '00:00';
    if (hour > 24) timeStr = `${(hour - 24).toString().padStart(2, '0')}:00`;
    onAddClass(day, timeStr);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm relative">
      
      <div className="overflow-y-auto h-full scrollbar-thin scrollbar-thumb-gray-300 bg-white relative">
        
        {/* Sticky Header Row */}
        <div className="flex border-b border-gray-100 bg-white/95 backdrop-blur z-30 sticky top-0">
            <div className="w-14 sm:w-16 shrink-0 border-r border-gray-100 bg-gray-50/50"></div>
            <div className="flex flex-1">
            {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                const dayIndex = day.getDay();
                const dayName = WEEK_DAYS_CN[dayIndex] || '';

                return (
                <div key={day.toString()} className={`flex-1 text-center py-3 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-red-50/50' : ''}`}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isToday ? 'text-red-600' : 'text-gray-400'}`}>
                    {dayName}
                    </div>
                    <div className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm font-bold shadow-sm ${isToday ? 'bg-red-600 text-white' : 'bg-white border border-gray-100 text-gray-900'}`}>
                    {format(day, 'd')}
                    </div>
                </div>
                );
            })}
            </div>
        </div>

        {/* Grid Body */}
        <div className="flex relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
            
            {/* Time Axis (Left) */}
            <div className="w-14 sm:w-16 shrink-0 border-r border-gray-100 bg-gray-50/30 sticky left-0 z-20 select-none">
                {hours.map((hour) => {
                if (hour === END_HOUR) return null;
                return (
                    <div key={hour} className="relative border-b border-gray-100/50 box-border text-[10px] text-gray-400 font-bold text-right pr-3 -mt-2" style={{ height: `${HOUR_HEIGHT}px` }}>
                    {formatDisplayHour(hour)}
                    </div>
                );
                })}
            </div>

            {/* Days Columns */}
            <div className="flex flex-1 relative z-10">
                {/* Background Horizontal Lines */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    {hours.map((hour) => (
                        <div key={`line-${hour}`} className="border-b border-gray-100 w-full" style={{ height: `${HOUR_HEIGHT}px`, transform: 'translateY(-1px)' }}></div>
                    ))}
                </div>

                {/* Day Columns */}
                {weekDays.map((day, dayIndex) => {
                    const dayClasses = getClassesForDate(day, classes);
                    const isToday = isSameDay(day, new Date());

                    return (
                    <div 
                        key={day.toString()} 
                        className={`flex-1 relative border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-red-50/30' : ''}`}
                    >
                        {/* Interactive Time Slots */}
                        {hours.map((hour) => {
                            if (hour === END_HOUR) return null;
                            return (
                            <div 
                                key={`slot-${dayIndex}-${hour}`}
                                className="absolute w-full hover:bg-gray-50 transition-colors cursor-pointer z-0"
                                style={{ 
                                    top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, 
                                    height: `${HOUR_HEIGHT}px` 
                                }}
                                onClick={() => handleSlotClick(day, hour)}
                            />
                            )
                        })}

                        {/* Class Blocks */}
                        {dayClasses.map((cls) => {
                            const style = getPositionStyle(cls.startTime, cls.endTime);
                            const isFlow = cls.type === 'flow';
                            
                            return (
                                <div
                                    key={cls.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditClass(cls, day);
                                    }}
                                    style={style}
                                    className={`absolute inset-x-1 p-2 rounded-xl border overflow-hidden z-20 cursor-pointer transition-all hover:scale-[1.02] hover:z-30 hover:shadow-xl flex flex-col group ${
                                        isFlow 
                                        ? 'bg-black border-black text-white shadow-lg shadow-black/20' 
                                        : 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20'
                                    }`}
                                >
                                    <div className="font-bold leading-tight truncate text-xs sm:text-sm mb-0.5">
                                        {cls.song || '常规课'}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] opacity-80 font-medium">
                                        <Clock size={10} /> {cls.startTime}
                                    </div>
                                    {parseInt(style.height) > 40 && (
                                        <div className="flex items-center gap-1.5 mt-auto text-[10px] opacity-90 truncate">
                                            <MapPin size={10} className="shrink-0" /> {cls.studio}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    );
                })}
            </div>
        </div>
      </div>
    </div>
  );
};