const express = require('express');
const router = express.Router();
const axios = require('axios');
const { supabase } = require('../supabaseClient');
const { logOperation } = require('../adminLogger');

const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const getCurrentTemplateByName = async (name) => {
  if (!name) return null;
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .eq('is_current', true)
    .single();
  return data || null;
};

const insertCrawlItems = async (config, response, crawlStatus) => {
  const results = response?.ocr_results || [];
  const items = [];
  for (const r of results) {
    const ocrFailed = !!r.error;
    items.push({
      source_type: 'crawler',
      studio: config.studio,
      branch: config.branch,
      config_id: config.id,
      wechat_url: config.wechat_url,
      image_path: r.image_path || null,
      ocr_data: r,
      crawl_status: crawlStatus,
      ocr_status: ocrFailed ? 'failed' : 'success',
      need_manual_upload: ocrFailed,
      error_message: r.error || null,
    });
  }
  if (!items.length) {
    items.push({
      source_type: 'crawler',
      studio: config.studio,
      branch: config.branch,
      config_id: config.id,
      wechat_url: config.wechat_url,
      image_path: null,
      ocr_data: response || {},
      crawl_status: crawlStatus,
      ocr_status: 'failed',
      need_manual_upload: true,
      error_message: 'No OCR results',
    });
  }
  await supabase.from('crawl_items').insert(items);
  return items;
};

const updateConfigStatus = async (configId, fields) => {
  const { data } = await supabase
    .from('crawl_configs')
    .update(fields)
    .eq('id', configId)
    .select()
    .single();
  return data;
};

const runConfig = async (config, io) => {
  const now = new Date().toISOString();
  let template = await getCurrentTemplateByName(config.template_name);
  const fallbackTemplateName = template?.crawler_rules?.fallback_template_name || null;
  const attempt = async (templateName, templateRules) => {
    const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/crawl-article`, {
      url: config.wechat_url,
      studio: config.studio,
      branch: config.branch,
      template_name: templateName,
      template_rules: templateRules
    });
    return response.data;
  };

  try {
    const data = await attempt(config.template_name, template);
    const items = await insertCrawlItems(config, data, 'success');
    const anyFailed = items.some(i => i.ocr_status === 'failed');
    const failCount = anyFailed ? (config.fail_count || 0) + 1 : 0;
    const needManual = failCount >= 2;
    const updated = await updateConfigStatus(config.id, {
      last_crawl_at: now,
      last_crawl_status: 'success',
      last_ocr_status: anyFailed ? 'failed' : 'success',
      fail_count: failCount,
      need_manual_upload: needManual,
      updated_at: now,
    });
    if (needManual && io) {
      io.emit('alert', { type: 'need_manual_upload', studio: config.studio, branch: config.branch, config_id: config.id, message: `${config.studio || ''} ${config.branch || ''} 需要手动上传课表` });
    }
    return { config: updated, items };
  } catch (err) {
    if (fallbackTemplateName && fallbackTemplateName !== config.template_name) {
      try {
        const fallbackTemplate = await getCurrentTemplateByName(fallbackTemplateName);
        const data = await attempt(fallbackTemplateName, fallbackTemplate);
        const items = await insertCrawlItems(config, data, 'success');
        const anyFailed = items.some(i => i.ocr_status === 'failed');
        const failCount = anyFailed ? (config.fail_count || 0) + 1 : 0;
        const needManual = failCount >= 2;
        const updated = await updateConfigStatus(config.id, {
          last_crawl_at: now,
          last_crawl_status: 'success',
          last_ocr_status: anyFailed ? 'failed' : 'success',
          fail_count: failCount,
          need_manual_upload: needManual,
          updated_at: now,
        });
        if (needManual && io) {
          io.emit('alert', { type: 'need_manual_upload', studio: config.studio, branch: config.branch, config_id: config.id, message: `${config.studio || ''} ${config.branch || ''} 需要手动上传课表` });
        }
        return { config: updated, items };
      } catch (fallbackErr) {
        const msg = fallbackErr?.response?.data?.message || fallbackErr.message || 'Crawler failed';
        await supabase.from('crawl_items').insert([{
          source_type: 'crawler',
          studio: config.studio,
          branch: config.branch,
          config_id: config.id,
          wechat_url: config.wechat_url,
          image_path: null,
          ocr_data: { error: msg },
          crawl_status: 'failed',
          ocr_status: 'failed',
          need_manual_upload: true,
          error_message: msg,
        }]);
      }
    }
    const msg = err?.response?.data?.message || err.message || 'Crawler failed';
    const failCount = (config.fail_count || 0) + 1;
    const needManual = failCount >= 2;
    const updated = await updateConfigStatus(config.id, {
      last_crawl_at: now,
      last_crawl_status: 'failed',
      last_ocr_status: 'failed',
      fail_count: failCount,
      need_manual_upload: needManual,
      updated_at: now,
    });
    await supabase.from('crawl_items').insert([{
      source_type: 'crawler',
      studio: config.studio,
      branch: config.branch,
      config_id: config.id,
      wechat_url: config.wechat_url,
      image_path: null,
      ocr_data: { error: msg },
      crawl_status: 'failed',
      ocr_status: 'failed',
      need_manual_upload: true,
      error_message: msg,
    }]);
    if (needManual && io) {
      io.emit('alert', { type: 'need_manual_upload', studio: config.studio, branch: config.branch, config_id: config.id, message: `${config.studio || ''} ${config.branch || ''} 需要手动上传课表` });
    }
    return { config: updated, error: msg };
  }
};

const runAllConfigs = async (io) => {
  const { data, error } = await supabase
    .from('crawl_configs')
    .select('*')
    .eq('enabled', true);
  if (error || !data) return { error: error?.message || 'Failed to load configs' };
  const results = [];
  for (const cfg of data) {
    const r = await runConfig(cfg, io);
    results.push(r);
  }
  return { results };
};

router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('crawl_configs')
    .select('*')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get('/options', async (req, res) => {
  const { data, error } = await supabase
    .from('crawl_configs')
    .select('id, studio, branch, wechat_url, template_name')
    .order('studio', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', requireAdmin, async (req, res) => {
  const { studio, branch, wechat_url, template_name, enabled } = req.body;
  const { data, error } = await supabase
    .from('crawl_configs')
    .insert([{
      studio,
      branch,
      wechat_url,
      template_name,
      enabled: enabled !== false,
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await logOperation({ actor: 'admin', action: 'create_config', resource_type: 'crawl_config', resource_id: data.id, detail: data });
  res.json(data);
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  const { data, error } = await supabase
    .from('crawl_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await logOperation({ actor: 'admin', action: 'update_config', resource_type: 'crawl_config', resource_id: id, detail: updates });
  res.json(data);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase
    .from('crawl_configs')
    .delete()
    .eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  await logOperation({ actor: 'admin', action: 'delete_config', resource_type: 'crawl_config', resource_id: id, detail: {} });
  res.json({ success: true });
});

router.post('/:id/run', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('crawl_configs')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Config not found' });
  const result = await runConfig(data, req.app.get('io'));
  await logOperation({ actor: 'admin', action: 'run_config', resource_type: 'crawl_config', resource_id: id, detail: { studio: data.studio, branch: data.branch } });
  res.json(result);
});

router.post('/run-all', requireAdmin, async (req, res) => {
  const result = await runAllConfigs(req.app.get('io'));
  await logOperation({ actor: 'admin', action: 'run_all_configs', resource_type: 'crawl_config', resource_id: null, detail: {} });
  res.json(result);
});

module.exports = { router, runAllConfigs, runConfig };
