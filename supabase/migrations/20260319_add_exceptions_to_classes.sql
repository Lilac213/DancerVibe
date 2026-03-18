-- Add exceptions column to classes table for recurring class cancellations
ALTER TABLE classes 
ADD COLUMN IF NOT EXISTS exceptions TEXT[] DEFAULT '{}';

-- Refresh schema cache instruction (handled by Supabase automatically usually, but good to note)
NOTIFY pgrst, 'reload schema';
