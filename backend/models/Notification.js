
import { Schema, model } from 'mongoose';

const notificationSchema = new Schema({
  
  recipient: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'recipientModel' 
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Faculty', 'Student']
  },
  sender: {
    type: Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Admin', 'Faculty', 'Student', 'System'] 
  },
  type: {
    type: String,
    required: true,
    enum: [
      'NEW_TASK', 'TASK_GRADED', 'DEADLINE_REMINDER', 'SUBMISSION_RECEIVED',
      'ADMIN_ANNOUNCEMENT', 'COURSE_ENROLLMENT', 'TASK_EDITED'
    ],
  },
  message: { type: String, required: true },
  link: { type: String }, 
  isRead: { type: Boolean, default: false, index: true },
}, { timestamps: true });

export default model('Notification', notificationSchema);