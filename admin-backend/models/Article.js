const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String, required: true, unique: true },
  content: { type: String }, // Can store full HTML or parsed text
  images: [{ type: String }], // URLs or paths to images
  ocrData: [{ type: Object }], // Extracted OCR data
  status: { 
    type: String, 
    enum: ['pending', 'crawled', 'failed', 'processed'], 
    default: 'pending' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', articleSchema);
