
export type ClassType = 'fixed' | 'flow';

export type UserRole = 'teacher' | 'student' | 'studio';

export interface UserModule {
    id: string;
    title: string;
    type: 'text' | 'tags' | 'teachers';
    content: any;
}

export interface User {
  name: string;
  role: UserRole;
  avatar?: string;
  bio?: string;
  social?: {
    douyin?: string;
    xiaohongshu?: string;
  };
  privacy?: {
    publicSchedule: boolean;
    buddyRec: boolean;
  };
  modules?: UserModule[];
}

export interface ClassSession {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // "18:00"
  endTime: string;   // "19:30"
  studio: string;
  teacher: string;   // Usually 'Me' or a sub name
  song: string;
  type: ClassType;
  date?: string;     // ISO Date string YYYY-MM-DD (Required if type is 'flow')
  notes?: string;
}

export interface Tag {
  id?: string;
  entity_type: 'teacher' | 'student' | 'studio' | 'song';
  entity_id: string;
  category: string; // 'style', 'level', 'vibe', 'skill'
  tag_value: string;
  confidence: number;
  reason?: string;
}

export interface DanceLog {
  id: string;
  date: string; // ISO String for the log entry
  videoBlob?: Blob; // Stored video file
  thumbnail?: string; // Data URL
  studio: string;
  teacher: string;
  song: string;
  styles: string[]; // e.g. ["HipHop", "Swag"]
  difficulty: number; // 1-5
  reflection?: string;
  mood?: 'fire' | 'happy' | 'neutral' | 'tired' | 'frustrated';
  durationSeconds?: number;
}

export const DAYS_OF_WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface ConflictResult {
  hasConflict: boolean;
  conflictingClass?: ClassSession;
}