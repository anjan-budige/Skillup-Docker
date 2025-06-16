
import { Schema, model } from 'mongoose';

const courseSchema = new Schema({
  courseCode: {
    type: String,
    required: [true, 'Course code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    index: true,
  },
  title: {
    type: String,
    required: [true, 'Course title is required'],
    trim: true,
  },
  photo: {
    type: String,
    default: null
  },
  description: { type: String, trim: true },
  faculty: [{ 
    type: Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  }],
  batches: [{ 
    type: Schema.Types.ObjectId,
    ref: 'Batch', 
  }],
  department: { type: String, trim: true, required: true },
  academicYear: { type: String, required: true }, 
  semester: { type: Number }, 
  status: {
    type: String,
    enum: ['Active', 'Archived', 'Upcoming'],
    default: 'Upcoming',
  },

  
  
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    
    
    refPath: 'creatorModel'
  },
  
  creatorModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Faculty'] 
  }

}, { timestamps: true });

export default model('Course', courseSchema);