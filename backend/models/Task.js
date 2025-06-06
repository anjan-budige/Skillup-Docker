// models/Task.js
import { Schema, model } from 'mongoose';

const attachmentSchema = new Schema({
  fileName: { type: String, required: true },
  url: { type: String, required: true },
  fileType: { type: String },
}, { _id: false });

const taskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  photo: { type: String },
  description: { type: String, required: true },
  type: {
    type: String,
    enum: ['Assignment', 'Quiz', 'Project', 'Lab Report'],
    default: 'Assignment',
  },
  course: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  },
  // NEW: Date when the task becomes visible and active for students
  publishDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  // The final deadline
  dueDate: {
    type: Date,
    required: true,
    // Add a validator to ensure due date is after publish date
    validate: [
        function(value) {
            return this.publishDate <= value;
        },
        'Due date must be on or after the publish date.'
    ]
  },
  maxPoints: { type: Number, required: true, min: 0 },
  attachments: [attachmentSchema], // Files provided by the faculty
  // REMOVED: The old 'status' field is no longer needed.
  // It will be calculated dynamically on the backend or frontend.
}, { timestamps: true });


// --- Dynamic Status Logic (Example for your API) ---
// You would add a virtual property to dynamically calculate the status
// This is extremely powerful as it's always up-to-date.
taskSchema.virtual('status').get(function() {
    const now = new Date();
    if (now < this.publishDate) {
        return 'Upcoming';
    } else if (now >= this.publishDate && now <= this.dueDate) {
        return 'Active';
    } else {
        return 'Completed'; // Or 'Past Due'
    }
});

// Ensure virtuals are included when converting to JSON
taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });


export default model('Task', taskSchema);