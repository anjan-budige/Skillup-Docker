
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
  
  publishDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  
  dueDate: {
    type: Date,
    required: true,
    
    validate: [
        function(value) {
            return this.publishDate <= value;
        },
        'Due date must be on or after the publish date.'
    ]
  },
  maxPoints: { type: Number, required: true, min: 0 },
  attachments: [attachmentSchema], 
  
  
}, { timestamps: true });





taskSchema.virtual('status').get(function() {
    const now = new Date();
    if (now < this.publishDate) {
        return 'Upcoming';
    } else if (now >= this.publishDate && now <= this.dueDate) {
        return 'Active';
    } else {
        return 'Completed'; 
    }
});


taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });


export default model('Task', taskSchema);