const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const TABLE = 'sys_dicts';

// List items by category
router.get('/:category', async (req, res) => {
  const { category } = req.params;
  
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('update_time', { ascending: false });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create item
router.post('/:category', requireAdmin, async (req, res) => {
  const { category } = req.params;
  const { key, value, sort_order } = req.body;
  
  if (!key || !value) return res.status(400).json({ error: 'Key and Value are required' });

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert([{
        category,
        key,
        value,
        sort_order: sort_order || 0,
        created_person: 'admin', // TODO: Get real user
        update_person: 'admin'
      }])
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({ 
        ...payload, 
        update_time: new Date(),
        update_person: 'admin'
      })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft Delete item (set is_active = false)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ 
        is_active: false,
        update_time: new Date(),
        update_person: 'admin'
      })
      .eq('id', id);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
