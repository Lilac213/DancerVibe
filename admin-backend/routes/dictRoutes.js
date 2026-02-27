const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');

const adminToken = process.env.ADMIN_TOKEN || '';
const requireAdmin = (req, res, next) => {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set' });
  if (req.headers['x-admin-token'] !== adminToken) return res.status(403).json({ error: 'Forbidden' });
  next();
};

const TABLES = {
  course: 'dict_courses',
  teacher: 'dict_teachers',
  style: 'dict_styles'
};

// List dictionary items
router.get('/:type', requireAdmin, async (req, res) => {
  const { type } = req.params;
  const table = TABLES[type];
  
  if (!table) return res.status(400).json({ error: 'Invalid dictionary type' });
  
  try {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create item
router.post('/:type', requireAdmin, async (req, res) => {
  const { type } = req.params;
  const table = TABLES[type];
  const payload = req.body;
  
  if (!table) return res.status(400).json({ error: 'Invalid dictionary type' });
  
  try {
    const { data, error } = await supabase
      .from(table)
      .insert([payload])
      .select()
      .single();
      
    if (error) throw error;
    
    // Log change
    await supabase.from('dict_changelog').insert([{
      dict_type: type,
      action_type: 'create',
      record_id: data.id,
      new_value: data,
      operator: 'admin'
    }]);
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item
router.put('/:type/:id', requireAdmin, async (req, res) => {
  const { type, id } = req.params;
  const table = TABLES[type];
  const payload = req.body;
  
  if (!table) return res.status(400).json({ error: 'Invalid dictionary type' });
  
  try {
    // Get old value first
    const { data: oldData } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
      
    const { data, error } = await supabase
      .from(table)
      .update({ ...payload, updated_at: new Date() })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    // Log change
    await supabase.from('dict_changelog').insert([{
      dict_type: type,
      action_type: 'update',
      record_id: id,
      old_value: oldData,
      new_value: data,
      operator: 'admin'
    }]);
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete item
router.delete('/:type/:id', requireAdmin, async (req, res) => {
  const { type, id } = req.params;
  const table = TABLES[type];
  
  if (!table) return res.status(400).json({ error: 'Invalid dictionary type' });
  
  try {
    // Get old value first
    const { data: oldData } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .single();
      
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
      
    if (error) throw error;
    
    // Log change
    await supabase.from('dict_changelog').insert([{
      dict_type: type,
      action_type: 'delete',
      record_id: id,
      old_value: oldData,
      operator: 'admin'
    }]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get changelog
router.get('/changelog/list', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('dict_changelog')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
