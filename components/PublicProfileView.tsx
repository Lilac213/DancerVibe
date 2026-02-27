import React from 'react';
import { User, Tag } from '../types';
import { ChevronLeft, UserCircle, Crown, Shield, Lock, MessageCircle, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface PublicProfileViewProps {
  user: User;
  onBack: () => void;
}

// Mock Schedule for Public View (Simulating fetching another user's schedule)
const PUBLIC_MOCK_SCHEDULE = [
    { day: '周一', time: '19:00 - 20:30', studio: 'Millennium', song: 'Hype Boy' },
    { day: '周三', time: '20:30 - 22:00', studio: 'En Dance', song: 'Ditto' },
    { day: '周五', time: '18:00 - 19:30', studio: 'Sinostage', song: 'OMG' },
];

export const PublicProfileView: React.FC<PublicProfileViewProps> = ({ user, onBack }) => {
  const isSchedulePublic = user.privacy?.publicSchedule !== false; // Default true if undefined

  return (
    <div className="h-full bg-white flex flex-col overflow-y-auto pb-24 animate-in slide-in-from-right duration-300 fixed inset-0 z-[60]">
      
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24}/></button>
        <span className="font-bold text-gray-900">@{user.name}</span>
      </div>

      {/* User Info Card */}
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-xl overflow-hidden">
             <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=000&color=fff&size=128`} 
                alt={user.name} 
                className="w-full h-full object-cover"
             />
          </div>
          <div className="flex-1">
             <h1 className="text-2xl font-black text-gray-900 mb-1">{user.name}</h1>
             
             {/* Bio */}
             {user.bio ? (
                 <p className="text-xs text-gray-600 mb-2 line-clamp-2">{user.bio}</p>
             ) : (
                 <p className="text-xs text-gray-400 mb-2 italic">这个人很懒，什么都没写~</p>
             )}

             <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    user.role === 'teacher' ? 'bg-red-50 text-red-600' : 
                    user.role === 'studio' ? 'bg-blue-50 text-blue-600' : 'bg-black text-white'
                }`}>
                    {user.role === 'teacher' && <Crown size={10} />}
                    {user.role === 'studio' && <Shield size={10} />}
                    {user.role === 'student' && <UserCircle size={10} />}
                    {user.role === 'teacher' ? '老师' : user.role === 'studio' ? '舞室' : '学员'}
                </span>
                {user.social?.douyin && (
                    <div className="w-5 h-5 bg-black text-white rounded flex items-center justify-center text-[8px] font-bold">♪</div>
                )}
                {user.social?.xiaohongshu && (
                    <div className="w-5 h-5 bg-red-500 text-white rounded flex items-center justify-center text-[8px] font-bold">R</div>
                )}
             </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
            <button className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-red-600/20">
                关注
            </button>
            <button className="flex-1 py-2.5 bg-gray-100 text-gray-900 font-bold rounded-xl text-sm flex items-center justify-center gap-2">
                <MessageCircle size={16} /> 私信
            </button>
        </div>

        {/* Modules Render */}
        <div className="space-y-4 mb-8">
            {user.modules?.map((mod, idx) => (
                <div key={idx} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{mod.title}</h3>
                    <p className="text-sm font-medium text-gray-900">{mod.content}</p>
                </div>
            ))}
        </div>

        {/* Public Schedule */}
        <div>
            <div className="flex items-center gap-2 mb-4">
                <Calendar size={18} className="text-gray-900"/>
                <h3 className="font-bold text-gray-900">近期课表</h3>
                {!isSchedulePublic && <Lock size={14} className="text-gray-400" />}
            </div>

            {isSchedulePublic ? (
                <div className="space-y-3">
                    {PUBLIC_MOCK_SCHEDULE.map((cls, idx) => (
                        <div key={idx} className="bg-white border border-gray-100 rounded-xl p-3 flex justify-between items-center shadow-sm">
                             <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-black text-white text-[10px] font-bold px-1.5 rounded">{cls.day}</span>
                                    <span className="text-xs font-bold text-gray-500">{cls.time}</span>
                                 </div>
                                 <div className="text-sm font-bold text-gray-900">{cls.song}</div>
                             </div>
                             <div className="text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded">
                                 {cls.studio}
                             </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-gray-50 rounded-xl p-8 flex flex-col items-center justify-center text-gray-400 gap-2 border border-dashed border-gray-200">
                    <Lock size={24} />
                    <p className="text-xs font-medium">该用户未公开课表</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
