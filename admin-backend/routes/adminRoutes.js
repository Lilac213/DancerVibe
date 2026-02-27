const express = require('express');
const axios = require('axios');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const { logOperation } = require('../adminLogger');
const { runConfig } = require('./configsRoutes');
const fs = require('fs');
const path = require('path');

const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const monthRange = (month) => {
  const [y, m] = month.split('-').map(v => parseInt(v, 10));
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
};

const classifyError = (msg) => {
  if (!msg) return '';
  const text = String(msg).toLowerCase();
  if (text.includes('timeout') || text.includes('timed out')) return '网络超时';
  if (text.includes('format') || text.includes('parse')) return '数据格式错误';
  if (text.includes('not found') || text.includes('404')) return '目标站点变更';
  if (text.includes('forbidden') || text.includes('403')) return '权限受限';
  return '未知错误';
};

router.get('/check-auth', requireAdmin, (req, res) => {
  res.json({ status: 'ok', message: 'Token is valid' });
});

router.get('/months', requireAdmin, async (req, res) => {
  try {
    const months = new Set();
    const { data: schedules } = await supabase.from('schedules').select('course_date');
    for (const row of schedules || []) {
      if (row.course_date) months.add(row.course_date.slice(0, 7));
    }
    const { data: items } = await supabase.from('crawl_items').select('created_at');
    for (const row of items || []) {
      if (row.created_at) months.add(row.created_at.slice(0, 7));
    }
    if (!months.size) months.add(new Date().toISOString().slice(0, 7));
    const list = Array.from(months).sort().reverse();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/studios', requireAdmin, async (req, res) => {
  try {
    const month = req.query.month;
    if (!month) return res.status(400).json({ error: 'month required' });
    const range = monthRange(month);
    const { data: studios } = await supabase.from('studios').select('id, name, branch');
    const { data: configs } = await supabase.from('crawl_configs').select('*');
    const { data: schedules } = await supabase
      .from('schedules')
      .select('studio_id, course_date')
      .gte('course_date', range.from)
      .lte('course_date', range.to);
    const completedStudioIds = new Set((schedules || []).map(s => s.studio_id));
    const configIds = (configs || []).map(c => c.id);
    const { data: items } = await supabase
      .from('crawl_items')
      .select('config_id, error_message, created_at')
      .in('config_id', configIds)
      .order('created_at', { ascending: false })
      .limit(300);
    const latestErrorByConfig = {};
    for (const it of items || []) {
      if (!latestErrorByConfig[it.config_id] && it.error_message) {
        latestErrorByConfig[it.config_id] = it.error_message;
      }
    }
    const studioMap = new Map();
    for (const s of studios || []) {
      studioMap.set(`${s.name}__${s.branch}`, s);
    }
    const result = (configs || []).map(cfg => {
      const studio = studioMap.get(`${cfg.studio}__${cfg.branch}`) || null;
      const completed = studio ? completedStudioIds.has(studio.id) : false;
      const err = latestErrorByConfig[cfg.id] || '';
      return {
        id: cfg.id,
        studio: cfg.studio,
        branch: cfg.branch,
        template_name: cfg.template_name,
        enabled: cfg.enabled,
        last_crawl_status: cfg.last_crawl_status,
        last_ocr_status: cfg.last_ocr_status,
        fail_count: cfg.fail_count || 0,
        need_manual_upload: cfg.need_manual_upload,
        completed,
        fail_reason: cfg.last_crawl_status === 'failed' ? classifyError(err) : '',
        error_message: err,
      };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/restart', requireAdmin, async (req, res) => {
  try {
    const { month, studio, branch } = req.body;
    if (!month) return res.status(400).json({ error: 'month required' });
    const range = monthRange(month);
    let query = supabase.from('crawl_configs').select('*');
    if (studio) query = query.eq('studio', studio);
    if (branch !== undefined && branch !== null) {
      if (branch === '') {
        query = query.is('branch', null);
      } else {
        query = query.eq('branch', branch);
      }
    }
    const { data: configs, error } = await query;
    if (error) throw error;
    const results = [];
    for (const cfg of configs || []) {
      const { data: studioRow } = await supabase
        .from('studios')
        .select('id')
        .eq('name', cfg.studio)
        .eq('branch', cfg.branch || '')
        .single();
      if (studioRow?.id) {
        await supabase
          .from('schedules')
          .delete()
          .eq('studio_id', studioRow.id)
          .gte('course_date', range.from)
          .lte('course_date', range.to);
      }
      const r = await runConfig(cfg, req.app.get('io'));
      results.push(r);
      await logOperation({
        actor: 'admin',
        action: 'restart_crawler',
        resource_type: 'crawl_config',
        resource_id: cfg.id,
        detail: { month, studio: cfg.studio, branch: cfg.branch }
      });
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/images', requireAdmin, async (req, res) => {
  try {
    const { month, studio, branch, limit = 20, offset = 0 } = req.query;
    let query = supabase.from('crawl_items').select('*', { count: 'exact' });
    if (studio) query = query.eq('studio', studio);
    if (branch) query = query.eq('branch', branch);
    if (month) {
      const range = monthRange(month);
      query = query.gte('created_at', `${range.from}T00:00:00.000Z`).lte('created_at', `${range.to}T23:59:59.999Z`);
    }
    query = query.order('created_at', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    const items = (data || []).map(it => ({
      ...it,
      image_url: it.image_path ? `/api/admin/image?path=${encodeURIComponent(it.image_path)}` : null,
      download_url: it.image_path ? `/api/admin/image?path=${encodeURIComponent(it.image_path)}` : null,
    }));
    res.json({ items, total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/image', requireAdmin, async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'path required' });
    // 本地上传文件走本地文件系统，避免跨服务读取失败
    if (path.startsWith('uploads/')) {
      const abs = path.startsWith('/') ? path : require('path').join(process.cwd(), path);
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Not Found' });
      return res.sendFile(abs);
    }
    // 其他由 Python 服务下载/生成的图片转发到 Python 服务读取
    try {
      const base = process.env.PYTHON_SERVICE_URL || '';
      const response = await axios.get(`${base}/image`, {
        params: { path },
        headers: { 'x-admin-token': adminToken },
        responseType: 'arraybuffer',
        validateStatus: () => true
      });
      if (response.status >= 400) {
        return res.status(response.status).json({ error: response.data?.detail || 'Image fetch failed' });
      }
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      res.set('Content-Type', contentType);
      res.send(response.data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/parsed', requireAdmin, async (req, res) => {
  try {
    const { month, studio, branch, teacher, q, limit = 50, offset = 0 } = req.query;
    let query = supabase.from('schedules_view').select('*', { count: 'exact' });
    if (month) {
      const range = monthRange(month);
      query = query.gte('course_date', range.from).lte('course_date', range.to);
    }
    if (studio) query = query.ilike('studio_name', `%${studio}%`);
    if (branch) query = query.ilike('branch_name', `%${branch}%`);
    if (teacher) query = query.ilike('teacher_name', `%${teacher}%`);
    if (q) query = query.or(`course_name.ilike.%${q}%,style.ilike.%${q}%,teacher_name.ilike.%${q}%`);
    query = query.order('course_date', { ascending: false }).range(Number(offset), Number(offset) + Number(limit) - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ items: data || [], total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { month } = req.query;
    const { data: studios } = await supabase.from('studios').select('id, name, branch');
    const { data: configs } = await supabase.from('crawl_configs').select('*');
    let completedStudioIds = new Set();
    if (month) {
      const range = monthRange(month);
      const { data: schedules } = await supabase
        .from('schedules')
        .select('studio_id')
        .gte('course_date', range.from)
        .lte('course_date', range.to);
      completedStudioIds = new Set((schedules || []).map(s => s.studio_id));
    }
    const totalStudios = (studios || []).length;
    const completed = completedStudioIds.size;
    const pending = Math.max(totalStudios - completed, 0);
    const failures = (configs || [])
      .filter(c => c.last_crawl_status === 'failed' || c.need_manual_upload)
      .map(c => ({
        id: c.id,
        studio: c.studio,
        branch: c.branch,
        status: c.last_crawl_status || 'unknown',
      }));
    res.json({ totalStudios, completed, pending, failures });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/logs', requireAdmin, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const { data, error, count } = await supabase
      .from('admin_operation_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);
    if (error) throw error;
    res.json({ items: data || [], total: count || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/rules', requireAdmin, async (req, res) => {
  try {
    const { name, studio, branch } = req.query;
    let query = supabase.from('crawler_rules').select('*').order('created_at', { ascending: false });
    if (name) query = query.eq('name', name);
    if (studio) query = query.eq('studio', studio);
    if (branch) query = query.eq('branch', branch);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rules', requireAdmin, async (req, res) => {
  try {
    const { name, studio, branch, target_url, field_mapping, update_frequency, exception_policy, is_current } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    let mappingObj = field_mapping || {};
    let exceptionObj = exception_policy || {};
    if (typeof mappingObj === 'string' && mappingObj.trim()) {
      try {
        mappingObj = JSON.parse(mappingObj);
      } catch {
        mappingObj = { text: mappingObj };
      }
    }
    if (typeof exceptionObj === 'string' && exceptionObj.trim()) {
      try {
        exceptionObj = JSON.parse(exceptionObj);
      } catch {
        exceptionObj = { text: exceptionObj };
      }
    }
    const { data: versions } = await supabase
      .from('crawler_rules')
      .select('version')
      .eq('name', name)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = versions && versions.length ? (versions[0].version + 1) : 1;
    if (is_current !== false) {
      await supabase.from('crawler_rules').update({ is_current: false }).eq('name', name);
    }
    const payload = {
      name,
      studio,
      branch,
      target_url,
      field_mapping: mappingObj || {},
      update_frequency: update_frequency || '',
      exception_policy: exceptionObj || {},
      version: nextVersion,
      is_current: is_current !== false,
    };
    const { data, error } = await supabase.from('crawler_rules').insert([payload]).select().single();
    if (error) throw error;
    await logOperation({
      actor: 'admin',
      action: 'create_rule',
      resource_type: 'crawler_rule',
      resource_id: data.id,
      detail: { name, version: nextVersion }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/rules/:id/set-current', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: current, error: findErr } = await supabase
      .from('crawler_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (findErr || !current) return res.status(404).json({ error: 'Rule not found' });
    await supabase.from('crawler_rules').update({ is_current: false }).eq('name', current.name);
    const { data, error } = await supabase.from('crawler_rules').update({ is_current: true }).eq('id', id).select().single();
    if (error) throw error;
    await logOperation({
      actor: 'admin',
      action: 'set_rule_current',
      resource_type: 'crawler_rule',
      resource_id: id,
      detail: { name: current.name }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/rules/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('crawler_rules').delete().eq('id', id);
    if (error) throw error;
    await logOperation({
      actor: 'admin',
      action: 'delete_rule',
      resource_type: 'crawler_rule',
      resource_id: id,
      detail: {}
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const { data: configs } = await supabase.from('crawl_configs').select('*');
    const { data: templates } = await supabase.from('templates').select('*');
    const { data: rules } = await supabase.from('crawler_rules').select('*');
    await logOperation({ actor: 'admin', action: 'backup', resource_type: 'system', resource_id: null, detail: {} });
    res.json({ configs: configs || [], templates: templates || [], rules: rules || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/restore', requireAdmin, async (req, res) => {
  try {
    const { configs, templates, rules } = req.body;
    if (Array.isArray(configs) && configs.length) {
      await supabase.from('crawl_configs').upsert(configs, { onConflict: 'id' });
    }
    if (Array.isArray(templates) && templates.length) {
      await supabase.from('templates').upsert(templates, { onConflict: 'id' });
    }
    if (Array.isArray(rules) && rules.length) {
      await supabase.from('crawler_rules').upsert(rules, { onConflict: 'id' });
    }
    await logOperation({ actor: 'admin', action: 'restore', resource_type: 'system', resource_id: null, detail: {} });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
