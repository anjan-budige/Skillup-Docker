import { Schema, model } from 'mongoose';

const submissionAttachmentSchema = new Schema({
  fileName: { type: String, required: true },
  url: { type: String, required: true },
  fileType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const submissionSchema = new Schema({
  
  task: { 
    type: Schema.Types.ObjectId, 
    ref: 'Task', 
    required: true 
  },
  student: { 
    type: Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  course: { 
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },

  
  content: { 
    type: String, 
    trim: true 
  },
  attachments: [submissionAttachmentSchema], 
  
  status: { 
    type: String,
    enum: ['On-Time', 'Late'],
    required: true
  },
}, { 
  timestamps: true, 
});


submissionSchema.index({ task: 1, student: 1 }, { unique: true });

export default model('Submission', submissionSchema);