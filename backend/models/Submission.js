import { Schema, model } from 'mongoose';

const submissionAttachmentSchema = new Schema({
  fileName: { type: String, required: true },
  url: { type: String, required: true },
  fileType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const submissionSchema = new Schema({
  // Core Relationships
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
  course: { // Denormalized for easier queries if needed
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },

  // Submission Details
  content: { // For text-based submissions
    type: String, 
    trim: true 
  },
  attachments: [submissionAttachmentSchema], // For file uploads
  
  status: { // The status of this specific submission action
    type: String,
    enum: ['On-Time', 'Late'],
    required: true
  },
}, { 
  timestamps: true, // `createdAt` will function as the `submittedAt` timestamp
});

// A student can only submit to a task once. This index enforces that.
submissionSchema.index({ task: 1, student: 1 }, { unique: true });

export default model('Submission', submissionSchema);