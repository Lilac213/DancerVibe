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
    // 检查Supabase是否配置
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.warn('Supabase未配置，使用模拟数据');
      return res.json(mockStats);
    }

    const { supabase } = require('../supabaseClient');
    
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 6);

    const { data, error } = await supabase
      .from('schedules')
      .select('course_date, teacher_id')
      .gte('course_date', from.toISOString().slice(0, 10))
      .lte('course_date', today.toISOString().slice(0, 10));

    if (error) {
      console.error('数据库查询错误:', error);
      return res.json(mockStats); // 降级到模拟数据
    }

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
    console.error('统计接口错误:', e.message);
    res.json(mockStats); // 降级到模拟数据
  }
});

// 获取概览数据 - 带降级处理
router.get('/overview', async (req, res) => {
  try {
    // 检查Supabase是否配置
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.warn('Supabase未配置，使用模拟数据');
      return res.json({
        totalConfigs: mockStats.totalConfigs,
        needManual: mockStats.needManual,
        failConfigs: mockStats.failConfigs,
        failedItems: mockStats.failedItems,
        last7Days: mockStats.last7Days,
      });
    }

    const { supabase } = require('../supabaseClient');
    
    const { data: configs, error: cfgErr } = await supabase
      .from('crawl_configs')
      .select('id, need_manual_upload, fail_count');
      
    if (cfgErr) {
      console.error('配置查询错误:', cfgErr);
      return res.json({
        totalConfigs: mockStats.totalConfigs,
        needManual: mockStats.needManual,
        failConfigs: mockStats.failConfigs,
        failedItems: mockStats.failedItems,
        last7Days: mockStats.last7Days,
      });
    }

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

    if (itemsErr) {
      console.error('项目查询错误:', itemsErr);
    }

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
    console.error('概览接口错误:', e.message);
    res.json({
      totalConfigs: mockStats.totalConfigs,
      needManual: mockStats.needManual,
      failConfigs: mockStats.failConfigs,
      failedItems: mockStats.failedItems,
      last7Days: mockStats.last7Days,
    });
  }
});

module.exports = router;