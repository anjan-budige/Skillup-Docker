// models/Course.js
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
  faculty: [{ // Supports multiple instructors for a single course
    type: Schema.Types.ObjectId,
    ref: 'Faculty',
    required: true,
  }],
  batches: [{ // List of associated batches
    type: Schema.Types.ObjectId,
    ref: 'Batch', // Assuming you have a Batch model
  }],
  department: { type: String, trim: true, required: true },
  academicYear: { type: String, required: true }, // e.g., "2024-2025"
  semester: { type: Number }, // e.g., 3
  status: {
    type: String,
    enum: ['Active', 'Archived', 'Upcoming'],
    default: 'Upcoming',
  },

  // --- POLYMORPHIC CREATOR FIELD ---
  // This field will store the ID of the user who created the course.
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
  }

}, { timestamps: true });

export default model('Course', courseSchema);