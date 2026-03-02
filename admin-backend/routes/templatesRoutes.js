const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const { supabase } = require('../supabaseClient');
const { logOperation } = require('../adminLogger');

const upload = multer({ storage: multer.memoryStorage() });
const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const validateRules = (crawler_rules, ocr_rules) => {
  if (!crawler_rules || !ocr_rules) return false;
  if (!ocr_rules.teacher || !ocr_rules.time || !ocr_rules.course) return false;
  return true;
};

router.get('/', async (req, res) => {
  try {
    const { name, studio, branch } = req.query;
    let query = supabase.from('templates').select('*');
    if (name) query = query.eq('name', name);
    if (studio) query = query.eq('studio', studio);
    if (branch) query = query.eq('branch', branch);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/current', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .eq('is_current', true)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || null);
});

router.get('/history', async (req, res) => {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: 'name required' });
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .order('version', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.get('/export', requireAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

router.post('/import', requireAdmin, async (req, res) => {
  const { templates } = req.body;
  if (!Array.isArray(templates)) return res.status(400).json({ error: 'templates array required' });
  for (const t of templates) {
    if (!t?.name || !validateRules(t.crawler_rules, t.ocr_rules)) {
      return res.status(400).json({ error: 'invalid template' });
    }
  }
  try {
    const { data, error } = await supabase.from('templates').insert(templates).select();
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, studio, branch, crawler_rules, ocr_rules, is_current } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    if (!validateRules(crawler_rules, ocr_rules)) return res.status(400).json({ error: 'rules invalid' });
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
      crawler_rules,
      ocr_rules,
      version: nextVersion,
      is_current: is_current !== false
    };
    const { data, error } = await supabase.from('templates').insert([payload]).select().single();
    if (error) throw error;
    await logOperation({
      actor: 'admin',
      action: 'create_template',
      resource_type: 'template',
      resource_id: data.id,
      detail: { name, version: nextVersion }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/preview', requireAdmin, upload.single('file'), async (req, res) => {
  try {
    const { url } = req.body;
    if (!url && !req.file) return res.status(400).json({ error: 'url or file required' });
    if (url) {
      const response = await axios.post(`${pythonServiceUrl}/templates/preview`, { url }, {
        headers: { 'x-admin-token': adminToken }
      });
      return res.json(response.data);
    }
    const formData = new FormData();
    formData.append('file', req.file.buffer, { filename: req.file.originalname });
    const response = await axios.post(`${pythonServiceUrl}/templates/preview`, formData, {
      headers: { ...formData.getHeaders(), 'x-admin-token': adminToken }
    });
    res.json(response.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/:id/set-current', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: current, error: findErr } = await supabase
      .from('templates')
      .select('*')
      .eq('id', id)
      .single();
    if (findErr || !current) return res.status(404).json({ error: 'Template not found' });
    await supabase.from('templates').update({ is_current: false }).eq('name', current.name);
    const { data, error } = await supabase.from('templates').update({ is_current: true }).eq('id', id).select().single();
    if (error) throw error;
    await logOperation({
      actor: 'admin',
      action: 'set_template_current',
      resource_type: 'template',
      resource_id: id,
      detail: { name: current.name }
    });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
