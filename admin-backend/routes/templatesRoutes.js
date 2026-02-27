const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const { supabase } = require('../supabaseClient');
const { logOperation } = require('../adminLogger');

const upload = multer({ storage: multer.memoryStorage() });
const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const normalizeRules = (rules) => {
  if (!rules) return null;
  if (typeof rules === 'string') return { text: rules };
  return rules;
};

const validateRules = (crawlerRules, ocrRules) => {
  if (!crawlerRules) return 'crawler_rules missing';
  if (!ocrRules) return 'ocr_rules missing';
  const ocrObj = normalizeRules(ocrRules);
  const reqFields = ['teacher', 'time', 'course'];
  for (const k of reqFields) {
    if (!ocrObj[k] && !ocrObj.text) return `ocr_rules.${k} missing`;
  }
  return null;
};

router.get('/', async (req, res) => {
  const { name, studio, branch } = req.query;
  let query = supabase.from('templates').select('*').order('created_at', { ascending: false });
  if (name) query = query.eq('name', name);
  if (studio) query = query.eq('studio', studio);
  if (branch) query = query.eq('branch', branch);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get('/current', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .eq('is_current', true)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/history', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .order('version', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/', requireAdmin, async (req, res) => {
  const { name, studio, branch, crawler_rules, ocr_rules, description, is_current } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const validation = validateRules(crawler_rules, ocr_rules);
  if (validation) return res.status(400).json({ error: validation });

  const { data: versions } = await supabase
    .from('templates')
    .select('version')
    .eq('name', name)
    .order('version', { ascending: false })
    .limit(1);
  const nextVersion = versions && versions.length ? (versions[0].version + 1) : 1;
  if (is_current !== false) {
    await supabase.from('templates').update({ is_current: false }).eq('name', name);
  }
  const payload = {
    name,
    studio,
    branch,
    version: nextVersion,
    is_current: is_current !== false,
    crawler_rules: normalizeRules(crawler_rules),
    ocr_rules: normalizeRules(ocr_rules),
    description,
  };
  const { data, error } = await supabase
    .from('templates')
    .insert([payload])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await logOperation({ actor: 'admin', action: 'create_template', resource_type: 'template', resource_id: data.id, detail: { name, version: nextVersion } });
  res.json(data);
});

router.post('/:id/set-current', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: current, error: findErr } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();
  if (findErr || !current) return res.status(404).json({ error: 'Template not found' });
  await supabase.from('templates').update({ is_current: false }).eq('name', current.name);
  const { data, error } = await supabase
    .from('templates')
    .update({ is_current: true })
    .eq('id', id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await logOperation({ actor: 'admin', action: 'set_template_current', resource_type: 'template', resource_id: id, detail: { name: current.name } });
  res.json(data);
});

router.get('/export', requireAdmin, async (req, res) => {
  const { name, studio, branch } = req.query;
  let query = supabase.from('templates').select('*').order('version', { ascending: true });
  if (name) query = query.eq('name', name);
  if (studio) query = query.eq('studio', studio);
  if (branch) query = query.eq('branch', branch);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/import', requireAdmin, async (req, res) => {
  const { templates } = req.body;
  if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
  const inserted = [];
  for (const t of templates) {
    const validation = validateRules(t.crawler_rules, t.ocr_rules);
    if (validation) return res.status(400).json({ error: validation });
    const { data: versions } = await supabase
      .from('templates')
      .select('version')
      .eq('name', t.name)
      .order('version', { ascending: false })
      .limit(1);
    const nextVersion = versions && versions.length ? (versions[0].version + 1) : 1;
    await supabase.from('templates').update({ is_current: false }).eq('name', t.name);
    const payload = {
      name: t.name,
      studio: t.studio,
      branch: t.branch,
      version: nextVersion,
      is_current: true,
      crawler_rules: normalizeRules(t.crawler_rules),
      ocr_rules: normalizeRules(t.ocr_rules),
      description: t.description,
    };
    const { data, error } = await supabase.from('templates').insert([payload]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    inserted.push(data);
  }
  res.json({ success: true, data: inserted });
  await logOperation({ actor: 'admin', action: 'import_templates', resource_type: 'template', resource_id: null, detail: { count: inserted.length } });
});

router.post('/preview', requireAdmin, upload.single('file'), async (req, res) => {
  const { url, template_name, studio, branch } = req.body;
  try {
    let templateRules = null;
    if (template_name) {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .eq('name', template_name)
        .eq('is_current', true)
        .single();
      templateRules = data || null;
    }
    if (req.file) {
      const formData = new (require('form-data'))();
      formData.append('file', req.file.buffer, { filename: req.file.originalname || 'preview.png' });
      if (templateRules) formData.append('template_rules', JSON.stringify(templateRules));
      const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/ocr-image`, formData, {
        headers: { ...formData.getHeaders() },
      });
      return res.json({ source: 'image', result: response.data });
    }
    if (!url) return res.status(400).json({ error: 'url or file required' });
    const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/crawl-article`, { url, template_name, studio, branch, template_rules: templateRules });
    return res.json({ source: 'url', result: response.data });
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || 'Preview failed';
    return res.status(500).json({ error: msg });
  }
});

module.exports = router;
