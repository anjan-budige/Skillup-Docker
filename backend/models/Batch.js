import { Schema, model } from 'mongoose';

const batchSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Batch name is required.'],
    trim: true,
  },
  academicYear: {
    type: String, 
    required: [true, 'Academic year is required.'],
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Department is required.'],
    trim: true,
  },
  
  students: [{
    type: Schema.Types.ObjectId,
    ref: 'Student',
  }],
  
  
  
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    
    
    refPath: 'creatorModel'
  },
  
  creatorModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Faculty'] 
  },
}, { 
  timestamps: true,
  
  indexes: [{ unique: true, fields: ['name', 'academicYear', 'department'] }]
});

export default model('Batch', batchSchema);