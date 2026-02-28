const express = require('express');
const router = express.Router();
const axios = require('axios'); // For calling Python service
const { supabase } = require('../supabaseClient');

const loadTemplateRules = async (name) => {
  if (!name) return null;
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('name', name)
    .eq('is_current', true)
    .single();
  return data || null;
};

// Trigger crawling
router.post('/crawl', async (req, res) => {
  const { url, studio, branch, template_name, config_id } = req.body;
  try {
    const templateRules = await loadTemplateRules(template_name);
    try {
      const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/crawl-article`, { url, template_name, studio, branch, template_rules: templateRules });
      const items = [];
      const results = response.data.ocr_results || [];
      for (const r of results) {
        const ocrFailed = !!r.error;
        items.push({
          source_type: 'crawler',
          studio,
          branch,
          config_id,
          wechat_url: url,
          image_path: r.image_path || null,
          ocr_data: r,
          crawl_status: 'success',
          ocr_status: ocrFailed ? 'failed' : 'success',
          need_manual_upload: ocrFailed,
          error_message: r.error || null,
        });
      }
      if (!items.length) {
        items.push({
          source_type: 'crawler',
          studio,
          branch,
          config_id,
          wechat_url: url,
          image_path: null,
          ocr_data: response.data,
          crawl_status: 'success',
          ocr_status: 'failed',
          need_manual_upload: true,
          error_message: 'No OCR results',
        });
      }
      const { data: inserted, error: insertErr } = await supabase
        .from('crawl_items')
        .insert(items)
        .select();
      if (insertErr) {
        console.error('Supabase insert crawl_items error:', insertErr.message);
        return res.status(500).json({ error: 'Failed to create crawl items' });
      }
      res.status(200).json({ success: true, data: inserted });
    } catch (pyError) {
      const msg = pyError?.response?.data?.message || pyError.message || 'Crawler failed';
      const { data: inserted, error: insertErr } = await supabase
        .from('crawl_items')
        .insert([{
          source_type: 'crawler',
          studio,
          branch,
          config_id,
          wechat_url: url,
          image_path: null,
          ocr_data: { error: msg },
          crawl_status: 'failed',
          ocr_status: 'failed',
          need_manual_upload: true,
          error_message: msg,
        }])
        .select();
      if (insertErr) {
        console.error('Supabase insert crawl_items error:', insertErr.message);
      }
      return res.status(500).json({ error: msg });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy Audit API to Python Service
router.get('/audit/tasks', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.PYTHON_SERVICE_URL}/audit/tasks`, {
      params: req.query,
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN }
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

router.get('/audit/tasks/:taskId', async (req, res) => {
  try {
    const response = await axios.get(`${process.env.PYTHON_SERVICE_URL}/audit/tasks/${req.params.taskId}`, {
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN }
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

router.post('/audit/tasks/:taskId/resolve', async (req, res) => {
  try {
    const response = await axios.post(`${process.env.PYTHON_SERVICE_URL}/audit/tasks/${req.params.taskId}/resolve`, req.body, {
      headers: { 'x-admin-token': process.env.ADMIN_TOKEN }
    });
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.response?.data?.detail || err.message });
  }
});

module.exports = router;
