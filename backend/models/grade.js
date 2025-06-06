import { Schema, model } from 'mongoose';

const gradeSchema = new Schema({
    // Core Relationships
    task: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true,
    },
    student: {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
        index: true,
    },
    course: { // Denormalized for easier queries
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },

    // Link to the actual submission, if one exists
    submission: {
        type: Schema.Types.ObjectId,
        ref: 'Submission',
        default: null,
    },
    
    // Grading Details
    grade: {
        type: Number,
        min: 0,
    },
    feedback: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['Pending', 'Graded'], // Simple status for the grade itself
        default: 'Pending',
    },
    gradedBy: {
        type: Schema.Types.ObjectId,
        refPath: 'graderModel'
    },
    graderModel: {
        type: String,
        enum: ['Admin', 'Faculty']
    },
    gradedAt: {
        type: Date,
    },
}, { timestamps: true });

// Ensures a student has only one grade entry per task. CRITICAL.
gradeSchema.index({ task: 1, student: 1 }, { unique: true });

export default model('Grade', gradeSchema);