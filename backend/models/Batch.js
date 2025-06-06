import { Schema, model } from 'mongoose';

const batchSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Batch name is required.'],
    trim: true,
  },
  academicYear: {
    type: String, // e.g., "2024-2025"
    required: [true, 'Academic year is required.'],
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Department is required.'],
    trim: true,
  },
  // Array of students belonging to this batch
  students: [{
    type: Schema.Types.ObjectId,
    ref: 'Student',
  }],
  
  // --- POLYMORPHIC CREATOR FIELD ---
  // This field will store the ID of the user who created the batch.
  createdBy: {
    type: Schema.Types.ObjectId,
    required: true,
    // The 'refPath' tells Mongoose to look at the 'creatorModel' field 
    // to determine which collection (Admin or Faculty) to query.
    refPath: 'creatorModel'
  },
  // This field stores the name of the model that 'createdBy' refers to.
  creatorModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Faculty'] // Restricts the value to these two models.
  },
}, { 
  timestamps: true,
  // Ensure the combination of name, academicYear and department is unique to prevent duplicates
  indexes: [{ unique: true, fields: ['name', 'academicYear', 'department'] }]
});

export default model('Batch', batchSchema);