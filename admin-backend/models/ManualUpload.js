const mongoose = require('mongoose');

const manualUploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  imagePath: { type: String, required: true },
  ocrData: { type: Object },
  status: { 
    type: String, 
    enum: ['pending', 'processed', 'failed'], 
    default: 'pending' 
  },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ManualUpload', manualUploadSchema);
