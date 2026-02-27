import React from 'react';
import { ChevronDown } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  className?: string;
}

export const TimePicker24h: React.FC<TimePickerProps> = ({ value, onChange, className }) => {
  const [hourStr, minuteStr] = (value || '00:00').split(':');
  
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // 1-minute steps for precise input
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  const handleChange = (type: 'h' | 'm', val: string) => {
    let newH = hourStr;
    let newM = minuteStr;
    if (type === 'h') newH = val;
    if (type === 'm') newM = val;
    onChange(`${newH}:${newM}`);
  };

  return (
    <div className={`flex gap-3 ${className}`}>
      <div className="relative flex-1 group">
        <select
          value={hourStr}
          onChange={(e) => handleChange('h', e.target.value)}
          className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 pr-8 font-mono font-bold text-gray-900 focus:border-black outline-none transition-all cursor-pointer text-center group-hover:border-gray-300"
        >
          {hours.map(h => <option key={h} value={h}>{h}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
        <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400">时</span>
      </div>
      <span className="self-center font-black text-gray-300 pb-1">:</span>
      <div className="relative flex-1 group">
        <select
          value={minuteStr}
          onChange={(e) => handleChange('m', e.target.value)}
          className="w-full appearance-none bg-gray-50 border-2 border-gray-100 rounded-xl px-4 py-3.5 pr-8 font-mono font-bold text-gray-900 focus:border-black outline-none transition-all cursor-pointer text-center group-hover:border-gray-300"
        >
          {minutes.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
        <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400">分</span>
      </div>
    </div>
  );
};