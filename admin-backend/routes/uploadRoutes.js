const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { supabase } = require('../supabaseClient');

const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

router.post('/', requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    if (req.body.studio) formData.append('studio', req.body.studio);
    if (req.body.branch) formData.append('branch', req.body.branch);
    if (req.body.config_id) formData.append('config_id', req.body.config_id);

    const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/ocr/upload`, formData, {
      headers: {
        ...formData.getHeaders(),
        'x-admin-token': process.env.ADMIN_TOKEN
      }
    });

    // Cleanup
    fs.unlinkSync(req.file.path);
    res.json(response.data);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

router.post('/confirm', requireAdmin, async (req, res) => {
  const { studio, branch, month, schedules } = req.body;
  
  if (!studio || !schedules || !Array.isArray(schedules)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    // 1. Get or Create Studio
    let studioId;
    const { data: existingStudio } = await supabase
      .from('studios')
      .select('id')
      .eq('name', studio)
      .eq('branch', branch || 'Main')
      .single();
      
    if (existingStudio) {
      studioId = existingStudio.id;
    } else {
      const { data: newStudio, error: studioError } = await supabase
        .from('studios')
        .insert([{ name: studio, branch: branch || 'Main' }])
        .select()
        .single();
      if (studioError) throw studioError;
      studioId = newStudio.id;
    }

    // 2. Process Schedules & Update Dictionaries
    const newSchedules = [];
    const now = new Date();
    
    // Batch upsert dictionaries logic
    // For simplicity, we process sequentially, but batching is better for performance
    
    for (const item of schedules) {
      // 2.1 Update Teacher Dict & Get ID
      let teacherId = null;
      if (item.teacher) {
        // Upsert to teachers table (Entity)
        const { data: tData } = await supabase
          .from('teachers')
          .upsert({ name: item.teacher }, { onConflict: 'name' })
          .select('id')
          .single();
        teacherId = tData.id;
        
        // Upsert to sys_dicts (category='teacher')
        await supabase
          .from('sys_dicts')
          .upsert({
            category: 'teacher',
            key: item.teacher,
            value: { label: item.teacher, alias: '', main_styles: item.style },
            update_time: now,
            update_person: 'admin'
          }, { onConflict: 'category,key' });
      }
      
      // 2.2 Update Course/Style Dict
      if (item.course) {
        await supabase
          .from('sys_dicts')
          .upsert({
            category: 'course',
            key: item.course,
            value: { label: item.course, difficulty_level: item.level || 1, description: '' },
            update_time: now,
            update_person: 'admin'
          }, { onConflict: 'category,key' });
      }
      
      if (item.style) {
        await supabase
          .from('sys_dicts')
          .upsert({
            category: 'style',
            key: item.style,
            value: { label: item.style, category: 'Other' },
            update_time: now,
            update_person: 'admin'
          }, { onConflict: 'category,key' });
      }

      // 2.3 Prepare Schedule Record
      // Calculate date from month + weekday if needed, or just store raw for now
      // Assuming month is "2026-03" and weekday is int (1-7)
      // For now, we'll create a dummy date or require specific date logic
      // Since manual upload might not have exact date, we might need a 'course_date' calculation
      // For this MVP, let's assume we are saving template schedules or need to calculate exact dates
      
      // WARNING: 'schedules' table requires 'course_date'. 
      // If we don't have exact date, we can't insert into 'schedules' directly without logic.
      // Let's calculate a dummy date for the first occurrence in that month?
      // Or just loop through the month to generate all dates?
      
      // Let's implement a simple date generator:
      if (month && item.weekday) {
        const [y, m] = month.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
          const date = new Date(y, m - 1, d);
          // getDay(): 0=Sun, 1=Mon...6=Sat. 
          // item.weekday: 1=Mon...7=Sun
          let jsDay = date.getDay();
          if (jsDay === 0) jsDay = 7;
          
          if (jsDay === item.weekday) {
             const timeParts = item.time_range ? item.time_range.split('-') : ['00:00', '00:00'];
             newSchedules.push({
               studio_id: studioId,
               teacher_id: teacherId,
               course_date: date.toISOString().split('T')[0],
               start_time: timeParts[0],
               end_time: timeParts[1],
               style: item.style,
               level: item.level ? item.level.toString() : '0',
               raw_text: item.raw_text
             });
          }
        }
      }
    }

    if (newSchedules.length > 0) {
      const { error } = await supabase.from('schedules').insert(newSchedules);
      if (error) throw error;
    }

    res.json({ success: true, count: newSchedules.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;