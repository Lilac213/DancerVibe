const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { supabase } = require('../supabaseClient');

const loadTemplateByConfig = async (config_id) => {
  if (!config_id) return null;
  const { data: cfg } = await supabase
    .from('crawl_configs')
    .select('template_name')
    .eq('id', config_id)
    .single();
  if (!cfg?.template_name) return null;
  const { data } = await supabase
    .from('templates')
    .select('*')
    .eq('name', cfg.template_name)
    .eq('is_current', true)
    .single();
  return data || null;
};

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Manual upload endpoint
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const studio = req.body.studio || null;
    const branch = req.body.branch || null;
    const config_id = req.body.config_id || null;
    const templateRules = await loadTemplateByConfig(config_id);

    // 2. Send to Python Service for OCR
    // We need to send the file itself or the path if on same machine.
    // Assuming distributed, we send the file as form-data.
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    if (templateRules) formData.append('template_rules', JSON.stringify(templateRules));
    if (studio) formData.append('studio', studio);
    if (branch) formData.append('branch', branch);

    try {
      const pyResponse = await axios.post(`${process.env.PYTHON_SERVICE_URL}/ocr-image`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      const ocrFailed = pyResponse.data?.status === 'error';
      const { data: inserted, error: insertErr } = await supabase
        .from('crawl_items')
        .insert([{
          source_type: 'manual',
          studio,
          branch,
          config_id,
          wechat_url: null,
          image_path: req.file.path,
          ocr_data: pyResponse.data,
          crawl_status: 'success',
          ocr_status: ocrFailed ? 'failed' : 'success',
          need_manual_upload: ocrFailed,
          error_message: ocrFailed ? pyResponse.data?.message || 'OCR failed' : null,
        }])
        .select();
      if (insertErr) {
        console.error('Supabase insert crawl_items error:', insertErr.message);
        return res.status(500).json({ error: 'Failed to create upload record' });
      }

      res.status(200).json({ success: true, data: inserted });
    } catch (pyError) {
      console.error('Python OCR Error:', pyError.message);
      const msg = pyError?.response?.data?.message || pyError.message || 'OCR processing failed';
      const { error: insertErr } = await supabase
        .from('crawl_items')
        .insert([{
          source_type: 'manual',
          studio,
          branch,
          config_id,
          wechat_url: null,
          image_path: req.file.path,
          ocr_data: { status: 'error', message: msg },
          crawl_status: 'success',
          ocr_status: 'failed',
          need_manual_upload: true,
          error_message: msg,
        }]);
      if (insertErr) {
        console.error('Supabase insert crawl_items error:', insertErr.message);
      }
      return res.status(500).json({ error: msg });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
