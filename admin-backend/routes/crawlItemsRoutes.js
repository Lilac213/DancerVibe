const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

router.get('/', async (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const studio = req.query.studio;
  const branch = req.query.branch;
  const status = req.query.status;
  let query = supabase.from('crawl_items').select('*').order('created_at', { ascending: false }).limit(limit);
  if (studio) query = query.eq('studio', studio);
  if (branch) query = query.eq('branch', branch);
  if (status) query = query.eq('ocr_status', status);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

module.exports = router;

