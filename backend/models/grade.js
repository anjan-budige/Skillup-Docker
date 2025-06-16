import { Schema, model } from 'mongoose';

const gradeSchema = new Schema({
    
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
    course: { 
        type: Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },

    
    submission: {
        type: Schema.Types.ObjectId,
        ref: 'Submission',
        default: null,
    },
    
    
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
        enum: ['Pending', 'Graded'], 
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


gradeSchema.index({ task: 1, student: 1 }, { unique: true });

export default model('Grade', gradeSchema);