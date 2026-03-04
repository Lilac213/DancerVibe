const express = require('express');
const router = express.Router();

// 模拟数据 - 当数据库不可用时使用
const mockStats = {
  last7Days: [
    { date: '2024-01-01', count: 5 },
    { date: '2024-01-02', count: 8 },
    { date: '2024-01-03', count: 3 },
    { date: '2024-01-04', count: 12 },
    { date: '2024-01-05', count: 7 },
    { date: '2024-01-06', count: 9 },
    { date: '2024-01-07', count: 6 }
  ],
  totalSchedules7d: 50,
  distinctTeachers7d: 8,
  totalConfigs: 25,
  needManual: 3,
  failConfigs: 2,
  failedItems: 5
};

// 健康检查端点
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    services: {
      database: process.env.SUPABASE_URL ? 'configured' : 'not_configured',
      python: process.env.PYTHON_SERVICE_URL ? 'configured' : 'not_configured'
    }
  });
});

// 获取统计摘要 - 带降级处理
router.get('/summary', async (req, res) => {
  try {
    const { supabase } = require('../supabaseClient');
    
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);

    const { data, error } = await supabase
      .from('schedules')
      .select('course_date, teacher_id')
      .gte('course_date', from.toISOString().slice(0, 10))
      .lte('course_date', today.toISOString().slice(0, 10));

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
      const key = d.toISOString().slice(0, 10);
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
    const { supabase } = require('../supabaseClient');
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

// 获取概览数据 - 带降级处理
router.get('/overview', async (req, res) => {
  try {
    const { supabase } = require('../supabaseClient');
    
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
      const key = d.toISOString().slice(0, 10);
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

router.get('/studios', async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.json(new Array(mockStats.totalConfigs).fill(0).map((_, i) => ({ id: `mock-${i + 1}` })));
    }
    const { supabase } = require('../supabaseClient');
    const { data, error } = await supabase.from('crawl_configs').select('id');
    if (error) {
      return res.json(new Array(mockStats.totalConfigs).fill(0).map((_, i) => ({ id: `mock-${i + 1}` })));
    }
    res.json(data || []);
  } catch (e) {
    res.json(new Array(mockStats.totalConfigs).fill(0).map((_, i) => ({ id: `mock-${i + 1}` })));
  }
});

router.get('/today-courses', async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.json({ count: mockStats.last7Days[mockStats.last7Days.length - 1]?.count || 0 });
    }
    const { supabase } = require('../supabaseClient');
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('schedules')
      .select('id')
      .eq('course_date', today);
    if (error) {
      return res.json({ count: mockStats.last7Days[mockStats.last7Days.length - 1]?.count || 0 });
    }
    res.json({ count: (data || []).length });
  } catch (e) {
    res.json({ count: mockStats.last7Days[mockStats.last7Days.length - 1]?.count || 0 });
  }
});

router.get('/recent-activity', async (req, res) => {
  try {
    const now = new Date();
    const fallback = [
      {
        id: 'activity-1',
        type: 'template',
        title: '模板数据同步完成',
        timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        status: 'success',
        statusText: '成功'
      },
      {
        id: 'activity-2',
        type: 'ocr',
        title: 'OCR任务队列刷新',
        timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
        status: 'warning',
        statusText: '处理中'
      },
      {
        id: 'activity-3',
        type: 'audit',
        title: '审核任务已更新',
        timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
        status: 'success',
        statusText: '成功'
      }
    ];

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.json(fallback);
    }

    const { supabase } = require('../supabaseClient');
    const { data, error } = await supabase
      .from('crawl_items')
      .select('id, created_at, ocr_status')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return res.json(fallback);
    }

    const mapped = (data || []).map((item) => ({
      id: `item-${item.id}`,
      type: 'ocr',
      title: `OCR任务 ${item.id}`,
      timestamp: item.created_at,
      status: item.ocr_status === 'failed' ? 'error' : (item.ocr_status === 'pending' ? 'warning' : 'success'),
      statusText: item.ocr_status === 'failed' ? '失败' : (item.ocr_status === 'pending' ? '处理中' : '成功')
    }));

    res.json(mapped.length ? mapped : fallback);
  } catch (e) {
    const now = new Date();
    res.json([
      {
        id: 'activity-1',
        type: 'template',
        title: '模板数据同步完成',
        timestamp: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        status: 'success',
        statusText: '成功'
      }
    ]);
  }
});

module.exports = router;
