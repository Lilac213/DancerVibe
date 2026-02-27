const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

router.get('/summary', async (req, res) => {
  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6); // last 7 days window

    const { data, error } = await supabase
      .from('schedules')
      .select('course_date, teacher_id')
      .gte('course_date', isoDate(from))
      .lte('course_date', isoDate(today));
    if (error) throw error;

    const byDay = {};
    const teachers = new Set();
    for (const row of data || []) {
      const k = row.course_date;
      byDay[k] = (byDay[k] || 0) + 1;
      if (row.teacher_id) teachers.add(row.teacher_id);
    }
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = isoDate(d);
      days.push({ date: key, count: byDay[key] || 0 });
    }
    res.json({
      last7Days: days,
      totalSchedules7d: (data || []).length,
      distinctTeachers7d: teachers.size,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/schedules', async (req, res) => {
  try {
    const { studio, teacher, q, from, to } = req.query;
    let query = supabase
      .from('schedules_view')
      .select('*');
    if (from) {
      query = query.gte('course_date', from);
    }
    if (to) {
      query = query.lte('course_date', to);
    }
    if (studio) {
      query = query.ilike('studio_name', `%${studio}%`);
    }
    if (teacher) {
      query = query.ilike('teacher_name', `%${teacher}%`);
    }
    if (q) {
      query = query.or(`course_name.ilike.%${q}%,style.ilike.%${q}%,teacher_name.ilike.%${q}%`);
    }
    query = query.order('course_date', { ascending: false }).order('time_range', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const { data: configs, error: cfgErr } = await supabase
      .from('crawl_configs')
      .select('id, need_manual_upload, fail_count');
    if (cfgErr) throw cfgErr;
    const totalConfigs = configs?.length || 0;
    const needManual = (configs || []).filter(c => c.need_manual_upload).length;
    const failConfigs = (configs || []).filter(c => (c.fail_count || 0) > 0).length;

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);
    const { data: items, error: itemsErr } = await supabase
      .from('crawl_items')
      .select('created_at, ocr_status')
      .gte('created_at', from.toISOString())
      .lte('created_at', today.toISOString());
    if (itemsErr) throw itemsErr;
    const byDay = {};
    let failedItems = 0;
    for (const row of items || []) {
      const key = row.created_at.slice(0, 10);
      byDay[key] = (byDay[key] || 0) + 1;
      if (row.ocr_status === 'failed') failedItems += 1;
    }
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(from);
      d.setDate(from.getDate() + i);
      const key = isoDate(d);
      days.push({ date: key, count: byDay[key] || 0 });
    }
    res.json({
      totalConfigs,
      needManual,
      failConfigs,
      failedItems,
      last7Days: days,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
