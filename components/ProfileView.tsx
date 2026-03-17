import React, { useState, useRef } from 'react';
import { User, Tag, UserModule } from '../types';
import { LogOut, Sparkles, RefreshCcw, Settings, FileText, ChevronRight, UserCircle, Crown, Shield, ChevronLeft, Camera, Lock, Edit3, Share2, Eye, EyeOff, UserPlus, FileVideo, Plus, Layout, Type, Trash2, ArrowRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ProfileViewProps {
  user: User;
  tags: Tag[];
  onLogout: () => void;
  onGenerateSummary: () => void;
  summary: string | null;
  isSummaryLoading: boolean;
  onTriggerTagging: () => void;
  isTaggingLoading: boolean;
}

type SubView = 'main' | 'account' | 'edit_profile' | 'privacy';

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  tags,
  onLogout,
  onGenerateSummary,
  summary,
  isSummaryLoading,
  onTriggerTagging,
  isTaggingLoading
}) => {
  const [currentView, setCurrentView] = useState<SubView>('main');
  
  // Local state for editing (mocking persistence)
  const [profileData, setProfileData] = useState<User>(user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize default data structure if missing
  if (!profileData.privacy) {
      profileData.privacy = { publicSchedule: true, buddyRec: true };
  }
  if (!profileData.social) {
      profileData.social = { douyin: '', xiaohongshu: '' };
  }
  if (!profileData.modules) {
      profileData.modules = [];
  }

  const handleAvatarClick = () => {
      fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const url = URL.createObjectURL(file);
          setProfileData({ ...profileData, avatar: url });
      }
  };

  const handleSave = () => {
      Object.assign(user, profileData); // quick local sync
      alert("保存成功！");
      setCurrentView('main');
  };

  const handleResetPassword = () => {
      if (confirm("确定要重置密码吗？系统将发送重置链接到您的绑定手机。")) {
          alert("重置链接已发送！");
      }
  };

  // --- SUB-VIEW: ACCOUNT & SECURITY ---
  const AccountView = () => (
      <div className="h-full flex flex-col bg-gray-50">
          <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
              <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24}/></button>
              <h2 className="text-lg font-bold text-gray-900">账号与安全</h2>
          </div>
          
          <div className="p-6 space-y-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                      <div className="w-28 h-28 rounded-full bg-gray-200 border-4 border-white shadow-xl overflow-hidden">
                          <img 
                              src={profileData.avatar || `https://ui-avatars.com/api/?name=${profileData.name}&background=000&color=fff&size=128`} 
                              className="w-full h-full object-cover" 
                          />
                      </div>
                      <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera className="text-white" size={28} />
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  </div>
                  <p className="text-xs text-gray-400 font-medium">点击更换头像</p>
              </div>

              {/* Form */}
              <div className="space-y-6">
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase ml-1">用户名</label>
                      <div className="relative">
                          <UserCircle className="absolute left-4 top-4 text-gray-400" size={20} />
                          <input 
                              type="text" 
                              value={profileData.name}
                              onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                              className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-sm font-bold focus:border-black outline-none transition-all"
                          />
                      </div>
                  </div>
                  
                  <div className="bg-white border border-gray-100 rounded-xl p-5 flex justify-between items-center shadow-sm">
                      <div className="flex items-center gap-4">
                          <div className="p-3 bg-gray-100 rounded-full"><Lock size={18} className="text-gray-600"/></div>
                          <div>
                              <div className="text-sm font-bold text-gray-900">登录密码</div>
                              <div className="text-xs text-gray-400 mt-0.5">定期修改密码可保护账号安全</div>
                          </div>
                      </div>
                      <button onClick={handleResetPassword} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-lg transition-colors text-gray-600">
                          重置
                      </button>
                  </div>
              </div>
          </div>

          <div className="mt-auto p-6">
              <button onClick={handleSave} className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-lg shadow-black/10 active:scale-95 transition-transform">
                  保存修改
              </button>
          </div>
      </div>
  );

  // --- SUB-VIEW: PROFILE EDIT (Bio, Social, Modules) ---
  const ProfileEditView = () => {
      const [editingModule, setEditingModule] = useState<UserModule | null>(null);

      const addModule = (type: 'tags' | 'text') => {
          const newModule: UserModule = {
              id: crypto.randomUUID(),
              type,
              title: type === 'tags' ? '我的性格标签' : '我的文本模块',
              content: type === 'tags' ? '' : ''
          };
          setEditingModule(newModule);
      };

      const saveModule = () => {
          if (!editingModule) return;
          
          const newModules = [...(profileData.modules || [])];
          const index = newModules.findIndex(m => m.id === editingModule.id);
          
          if (index >= 0) {
              newModules[index] = editingModule;
          } else {
              newModules.push(editingModule);
          }
          
          setProfileData({ ...profileData, modules: newModules });
          setEditingModule(null);
      };

      const deleteModule = (id: string) => {
           const newModules = (profileData.modules || []).filter(m => m.id !== id);
           setProfileData({ ...profileData, modules: newModules });
           setEditingModule(null);
      };

      return (
      <div className="h-full flex flex-col bg-gray-50">
          <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
              <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24}/></button>
              <h2 className="text-lg font-bold text-gray-900">个人主页展示</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Bio Section */}
              <div className="space-y-2">
                   <label className="text-xs font-bold text-gray-500 uppercase ml-1">个人简介 (Bio)</label>
                   <textarea 
                        value={profileData.bio || ''}
                        onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                        placeholder="介绍一下你自己..."
                        className="w-full h-32 bg-white border border-gray-200 rounded-xl p-4 text-sm leading-relaxed focus:border-black outline-none resize-none shadow-sm"
                   />
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase ml-1">社交账号</h3>
                  
                  <div className="space-y-1">
                      <div className="relative">
                          <div className="absolute left-4 top-4 w-6 h-6 bg-black text-white rounded-md flex items-center justify-center text-[10px] font-bold">♪</div>
                          <input 
                              type="text" 
                              placeholder="抖音号 / 链接"
                              value={profileData.social?.douyin}
                              onChange={(e) => setProfileData({...profileData, social: { ...profileData.social, douyin: e.target.value }})}
                              className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-14 pr-4 text-sm focus:border-black outline-none transition-all"
                          />
                      </div>
                  </div>

                  <div className="space-y-1">
                      <div className="relative">
                          <div className="absolute left-4 top-4 w-6 h-6 bg-red-500 text-white rounded-md flex items-center justify-center text-[10px] font-bold">R</div>
                          <input 
                              type="text" 
                              placeholder="小红书号 / 链接"
                              value={profileData.social?.xiaohongshu}
                              onChange={(e) => setProfileData({...profileData, social: { ...profileData.social, xiaohongshu: e.target.value }})}
                              className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-14 pr-4 text-sm focus:border-red-500 outline-none transition-all"
                          />
                      </div>
                  </div>
              </div>

              {/* Modules (Extensible) */}
              <div className="space-y-4">
                   <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase">展示模块</h3>
                        <span className="text-[10px] text-gray-400">自定义你的主页</span>
                   </div>
                   
                   {/* Existing Modules */}
                   {profileData.modules?.map((mod) => (
                       <div 
                            key={mod.id} 
                            onClick={() => setEditingModule(mod)}
                            className="bg-white border border-gray-200 rounded-xl p-5 flex justify-between items-center group cursor-pointer hover:border-black hover:shadow-md transition-all"
                        >
                           <div>
                               <div className="text-sm font-bold text-gray-900 mb-1">{mod.title}</div>
                               <div className="text-xs text-gray-500 truncate max-w-[200px]">{mod.content || '暂无内容'}</div>
                           </div>
                           <ArrowRight size={18} className="text-gray-300 group-hover:text-black transition-colors" />
                       </div>
                   ))}

                   {/* Add Button */}
                   <div className="grid grid-cols-2 gap-4">
                       <button onClick={() => addModule('tags')} className="py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-400">
                            <Layout size={24} />
                            <span className="text-xs font-bold">添加标签模块</span>
                       </button>
                       <button onClick={() => addModule('text')} className="py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all text-gray-400">
                            <Type size={24} />
                            <span className="text-xs font-bold">添加文本模块</span>
                       </button>
                   </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-800 text-xs leading-relaxed">
                  💡 提示：更多个性化模块（如“喜欢的老师”、“常用装备”）正在开发中...
              </div>
          </div>

          <div className="p-6 border-t border-gray-100 bg-white">
              <button onClick={handleSave} className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-lg shadow-black/10 active:scale-95 transition-transform">
                  保存并展示
              </button>
          </div>

          {/* Module Editor Modal */}
          {editingModule && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                   <div className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
                       <div className="text-center">
                           <h3 className="font-bold text-lg text-gray-900">
                               {profileData.modules?.find(m => m.id === editingModule.id) ? '编辑模块' : '添加模块'}
                           </h3>
                       </div>
                       
                       <div className="space-y-5">
                           <div>
                               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1 block">模块标题</label>
                               <input 
                                   value={editingModule.title} 
                                   onChange={e => setEditingModule({...editingModule, title: e.target.value})}
                                   className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3.5 px-4 text-sm font-bold text-gray-900 focus:border-black focus:bg-white outline-none transition-all"
                                   placeholder="例如：我的性格标签"
                               />
                           </div>

                           <div>
                               <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mb-1 block">内容</label>
                               <textarea 
                                   value={editingModule.content} 
                                   onChange={e => setEditingModule({...editingModule, content: e.target.value})}
                                   className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl p-4 h-32 text-sm text-gray-900 resize-none outline-none focus:border-black focus:bg-white transition-all leading-relaxed"
                                   placeholder={editingModule.type === 'tags' ? "例如：E人, 熬夜冠军" : "输入你想展示的文本..."}
                               />
                           </div>
                       </div>

                       <div className="flex gap-3 pt-2">
                           {profileData.modules?.find(m => m.id === editingModule.id) && (
                               <button 
                                    onClick={() => deleteModule(editingModule.id)} 
                                    className="p-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                               >
                                   <Trash2 size={20}/>
                               </button>
                           )}
                           <button 
                                onClick={() => setEditingModule(null)} 
                                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-colors"
                           >
                               取消
                           </button>
                           <button 
                                onClick={saveModule} 
                                className="flex-[2] py-4 bg-black hover:bg-gray-800 text-white font-bold rounded-xl text-sm shadow-lg shadow-black/20 transition-all"
                           >
                               保存
                           </button>
                       </div>
                   </div>
               </div>
           )}
      </div>
  )};

  // --- SUB-VIEW: PRIVACY ---
  const PrivacyView = () => (
      <div className="h-full flex flex-col bg-gray-50">
          <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
              <button onClick={() => setCurrentView('main')} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={24}/></button>
              <h2 className="text-lg font-bold text-gray-900">隐私设置</h2>
          </div>

          <div className="p-4 space-y-4">
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex gap-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full h-fit"><Eye size={22}/></div>
                      <div>
                          <div className="text-sm font-bold text-gray-900">公开展示课表</div>
                          <div className="text-xs text-gray-400 mt-1">允许其他用户查看您的排课计划</div>
                      </div>
                  </div>
                  <div 
                    onClick={() => setProfileData({...profileData, privacy: {...profileData.privacy!, publicSchedule: !profileData.privacy?.publicSchedule}})}
                    className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${profileData.privacy?.publicSchedule ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${profileData.privacy?.publicSchedule ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex gap-4">
                      <div className="p-3 bg-pink-50 text-pink-600 rounded-full h-fit"><UserPlus size={22}/></div>
                      <div>
                          <div className="text-sm font-bold text-gray-900">开启舞搭子推荐</div>
                          <div className="text-xs text-gray-400 mt-1">基于您的上课风格推荐合适的练舞伙伴</div>
                      </div>
                  </div>
                  <div 
                    onClick={() => setProfileData({...profileData, privacy: {...profileData.privacy!, buddyRec: !profileData.privacy?.buddyRec}})}
                    className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${profileData.privacy?.buddyRec ? 'bg-green-500' : 'bg-gray-200'}`}
                  >
                      <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-300 ${profileData.privacy?.buddyRec ? 'translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
              </div>
          </div>
          
          <div className="mt-auto p-6">
              <button onClick={handleSave} className="w-full py-4 bg-black text-white font-bold rounded-2xl shadow-lg shadow-black/10 active:scale-95 transition-transform">
                  应用设置
              </button>
          </div>
      </div>
  );

  // --- MAIN VIEW ---
  if (currentView === 'account') return <AccountView />;
  /*
    “个人主页展示”与“隐私设置”页面临时隐藏（后续需要重新开发时恢复）
    if (currentView === 'edit_profile') return <ProfileEditView />;
    if (currentView === 'privacy') return <PrivacyView />;
  */

  return (
    <div className="h-full bg-gray-50 flex flex-col overflow-y-auto pb-24 animate-in fade-in duration-300">
      
      {/* Header / User Card */}
      <div className="bg-white p-6 border-b border-gray-100">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden shrink-0">
             <img 
                src={profileData.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=000&color=fff&size=128`} 
                alt={user.name} 
                className="w-full h-full object-cover"
             />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start">
                <h1 className="text-2xl font-black text-gray-900 truncate">{profileData.name}</h1>
                {/*
                  个人主页展示入口临时隐藏（后续需要重新开发时恢复）
                */}
            </div>
            {profileData.bio && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{profileData.bio}</p>
            )}
            <div className="flex items-center gap-2 mt-3">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                    user.role === 'teacher' ? 'bg-red-50 text-red-600' : 
                    user.role === 'studio' ? 'bg-blue-50 text-blue-600' : 'bg-black text-white'
                }`}>
                    {user.role === 'teacher' && <Crown size={12} />}
                    {user.role === 'studio' && <Shield size={12} />}
                    {user.role === 'student' && <UserCircle size={12} />}
                    {user.role === 'teacher' ? '老师' : user.role === 'studio' ? '舞室' : '学员'}
                </span>
            </div>
            
            {/* Social Icons */}
            {(profileData.social?.douyin || profileData.social?.xiaohongshu) && (
                <div className="flex gap-2 mt-3">
                    {profileData.social?.douyin && (
                        <div className="w-6 h-6 bg-black text-white rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm">♪</div>
                    )}
                    {profileData.social?.xiaohongshu && (
                        <div className="w-6 h-6 bg-red-500 text-white rounded-md flex items-center justify-center text-[10px] font-bold shadow-sm">R</div>
                    )}
                </div>
            )}
          </div>
        </div>

        {/* Stats Row (Mock) */}
        <div className="flex justify-between items-center text-center pt-2">
             <div className="flex-1 border-r border-gray-100 px-2">
                 <div className="text-2xl font-black text-gray-900">12</div>
                 <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">本月课程</div>
             </div>
             <div className="flex-1 border-r border-gray-100 px-2">
                 <div className="text-2xl font-black text-gray-900">48h</div>
                 <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">练习时长</div>
             </div>
             <div className="flex-1 px-2">
                 <div className="text-2xl font-black text-gray-900">3</div>
                 <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">舞迹记录</div>
             </div>
        </div>
      </div>

      {/* AI Insights Section */}
      <div className="p-4">
        <div className="bg-black rounded-3xl p-6 text-white shadow-xl shadow-black/10 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-600 rounded-full blur-[70px] opacity-30 group-hover:opacity-50 transition-opacity"></div>
            
            <div className="flex justify-between items-center mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/20">
                        <Sparkles size={16} className="text-white fill-white" />
                    </div>
                    <h3 className="font-bold text-sm tracking-wide">AI 舞蹈画像</h3>
                </div>
                <button 
                    onClick={onTriggerTagging} 
                    disabled={isTaggingLoading}
                    className="text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-white transition-all disabled:opacity-50 font-bold"
                >
                    <RefreshCcw size={12} className={isTaggingLoading ? 'animate-spin' : ''}/> 
                    {isTaggingLoading ? '分析中...' : '刷新'}
                </button>
            </div>

            {tags.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs bg-white/5 rounded-2xl border border-dashed border-white/10">
                    添加更多课程或舞迹后，AI 将自动分析您的舞蹈风格
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 relative z-10">
                    {tags.map((tag, i) => (
                        <div key={i} className="bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 flex flex-col gap-1 min-w-[90px] backdrop-blur-sm">
                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{tag.category}</span>
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-sm text-white">{tag.tag_value}</span>
                                <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                            </div>
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden mt-1.5">
                                    <div className="h-full bg-gradient-to-r from-red-900 to-red-500" style={{ width: `${tag.confidence * 100}%`}}></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Summary Section */}
      <div className="px-4">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
             <div className="flex justify-between items-center mb-5">
                 <div className="flex items-center gap-3">
                    <FileText size={20} className="text-gray-900" />
                    <h3 className="font-bold text-sm text-gray-900">个人总结</h3>
                 </div>
                 <button 
                    onClick={onGenerateSummary}
                    disabled={isSummaryLoading}
                    className="text-xs font-bold text-red-600 hover:bg-red-50 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                 >
                    {isSummaryLoading ? '生成中...' : '生成周报'}
                 </button>
             </div>

             {summary ? (
                 <div className="bg-gray-50 p-5 rounded-2xl text-xs text-gray-600 leading-relaxed border border-gray-100 overflow-hidden">
                     <ReactMarkdown
                        components={{
                            h3: ({node, ...props}) => <h3 className="text-sm font-black text-gray-900 mt-5 mb-3 flex items-center gap-2 first:mt-0" {...props} />,
                            strong: ({node, ...props}) => <span className="font-bold text-gray-900 bg-red-50 text-red-600 px-1 mx-0.5 rounded-md" {...props} />,
                            ul: ({node, ...props}) => <ul className="space-y-2 mb-4" {...props} />,
                            li: ({node, ...props}) => (
                                <li className="flex items-start gap-2.5 text-xs text-gray-600 pl-1" {...props}>
                                    <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                    <span className="flex-1 leading-relaxed">{props.children}</span>
                                </li>
                            ),
                            p: ({node, ...props}) => <p className="mb-3 text-xs text-gray-600 leading-relaxed" {...props} />,
                        }}
                     >
                        {summary}
                     </ReactMarkdown>
                 </div>
             ) : (
                 <div className="py-10 text-center text-gray-300 text-xs font-medium bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                     点击生成，获取您的专属舞蹈周报
                 </div>
             )}
          </div>
      </div>

      {/* Menu List */}
      <div className="p-4 mt-2 space-y-4">
          <div className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
               <button 
                    onClick={() => setCurrentView('account')}
                    className="w-full p-5 flex justify-between items-center hover:bg-gray-50 transition-colors border-b border-gray-50"
                >
                   <div className="flex items-center gap-4">
                        <Settings size={20} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-900">账号与安全</span>
                   </div>
                   <ChevronRight size={18} className="text-gray-300" />
               </button>
               
               {/*
                 个人主页展示与隐私设置入口临时隐藏（后续需要重新开发时恢复）
               */}

               <button className="w-full p-5 flex justify-between items-center hover:bg-gray-50 transition-colors">
                   <div className="flex items-center gap-4">
                        <Share2 size={20} className="text-gray-500" />
                        <span className="text-sm font-bold text-gray-900">推荐给朋友</span>
                   </div>
                   <ChevronRight size={18} className="text-gray-300" />
               </button>
          </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-4">
          <button 
            onClick={onLogout}
            className="w-full py-4 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-500 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2 mb-4"
          >
              <LogOut size={20} /> 退出登录
          </button>
      </div>

    </div>
  );
};
