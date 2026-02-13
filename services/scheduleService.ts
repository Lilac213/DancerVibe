
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClassSession, User, Tag } from '../types';

const SUPABASE_URL = 'https://tpkruofcrdlcqzdsdmyq.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3J1b2ZjcmRsY3F6ZHNkbXlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzU4OTEsImV4cCI6MjA4NTk1MTg5MX0.MZUROE6Qb7xvfaTHNbgT0bJ3wrpGmOGrxI4Pihg3myg';

let supabase: SupabaseClient | null = null;

export const initSupabase = (key?: string) => {
    // Use provided key, or fallback to default key. 
    const finalKey = (key && key.trim().length > 0) ? key : DEFAULT_SUPABASE_KEY;
    
    if (!finalKey) return null;
    
    try {
        supabase = createClient(SUPABASE_URL, finalKey);
        return supabase;
    } catch (error) {
        console.error("Failed to initialize Supabase client:", error);
        return null;
    }
};

export const checkConnection = async (): Promise<boolean> => {
    if (!supabase) return false;
    try {
        // Just verify we can reach the server.
        // We select just 1 row (even if table is empty) to check connectivity
        const { count, error } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true });
        
        if (error) {
            console.warn("Connection check failed:", error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Connection check exception:", e);
        return false;
    }
};

// --- CLASSES ---

// Map App Type to DB Columns (snake_case)
const mapToDb = (cls: ClassSession, userName: string) => ({
    id: cls.id,
    user_name: userName,
    day_of_week: cls.dayOfWeek,
    start_time: cls.startTime,
    end_time: cls.endTime,
    studio: cls.studio,
    teacher: cls.teacher,
    song: cls.song,
    type: cls.type,
    date: cls.date || null
});

const normalizeTime = (t: string) => {
    if (!t) return t;
    // If DB returns "19:00:00", we need "19:00" for the input[type=time] to work nicely in some contexts
    const parts = t.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
    return t;
};

// Map DB Columns to App Type (camelCase)
const mapFromDb = (row: any): ClassSession => ({
    id: row.id,
    dayOfWeek: row.day_of_week,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    studio: row.studio,
    teacher: row.teacher,
    song: row.song,
    type: row.type as 'fixed' | 'flow',
    date: row.date || undefined,
});

export const fetchClasses = async (user: User): Promise<ClassSession[]> => {
    if (!supabase) throw new Error("Supabase not initialized");
    
    const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('user_name', user.name);

    if (error) {
        throw new Error(`Fetch error: ${error.message}`);
    }

    return (data || []).map(mapFromDb);
};

// NEW: Search for any teacher's classes (Public Query)
export const searchPublicClasses = async (teacherName: string): Promise<ClassSession[]> => {
    if (!supabase) return [];

    // Search where user_name matches or teacher column matches
    const { data, error } = await supabase
        .from('classes')
        .select('*')
        .ilike('user_name', `%${teacherName}%`); // Simple search on user_name for now

    if (error) {
        console.error("Search error:", error);
        return [];
    }

    return (data || []).map(mapFromDb);
};

export const upsertClass = async (cls: ClassSession, user: User) => {
    if (!supabase) throw new Error("Supabase not initialized");

    const payload = mapToDb(cls, user.name);
    
    const { error } = await supabase
        .from('classes')
        .upsert(payload);

    if (error) {
        throw new Error(`Upsert error: ${error.message}`);
    }
};

export const batchUpsertClasses = async (classes: ClassSession[], user: User) => {
    if (!supabase) throw new Error("Supabase not initialized");
    if (classes.length === 0) return;

    const payloads = classes.map(c => mapToDb(c, user.name));

    const { error } = await supabase
        .from('classes')
        .upsert(payloads);

    if (error) {
        throw new Error(`Batch upsert error: ${error.message}`);
    }
}

export const deleteClass = async (id: string) => {
    if (!supabase) throw new Error("Supabase not initialized");

    const { error } = await supabase
        .from('classes')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Delete error: ${error.message}`);
    }
};

export const batchDeleteClasses = async (ids: string[]) => {
    if (!supabase) throw new Error("Supabase not initialized");
    if (ids.length === 0) return;

    const { error } = await supabase
        .from('classes')
        .delete()
        .in('id', ids);
    
    if (error) {
        throw new Error(`Batch delete error: ${error.message}`);
    }
}

// --- TAGS (NEW) ---

export const fetchTags = async (user: User): Promise<Tag[]> => {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('entity_id', user.name)
        .eq('entity_type', user.role);
    
    if (error) {
        console.error("Fetch tags error", error);
        return [];
    }

    return data as Tag[];
};

export const batchUpsertTags = async (tags: Tag[]) => {
    if (!supabase) return;
    if (tags.length === 0) return;

    // We first delete old AI tags for this user to keep it fresh (simple strategy)
    const entityId = tags[0].entity_id;
    const entityType = tags[0].entity_type;

    await supabase.from('tags').delete().eq('entity_id', entityId).eq('entity_type', entityType);

    const { error } = await supabase
        .from('tags')
        .insert(tags);
    
    if (error) {
        console.error("Save tags error", error);
    }
};
