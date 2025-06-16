import { Schema, model } from 'mongoose';

const settingsSchema = new Schema({
    
    key: {
        type: String,
        default: 'global',
        unique: true,
    },

    
    platformName: {
        type: String,
        required: true,
        default: 'SkillUp Platform',
        trim: true,
    },
    platformLogo: {
        type: String, 
        default: null,
    },
    supportEmail: {
        type: String,
        trim: true,
        lowercase: true,
    },

    
    allowStudentRegistration: {
        type: Boolean,
        default: false, 
    },
    allowLateSubmissions: {
        type: Boolean,
        default: true,
    },
    maxUploadSizeMB: {
        type: Number,
        default: 10, 
    },
    allowedFileTypes: {
        type: [String], 
        default: ['.pdf', '.docx', '.pptx', '.zip', '.jpg', '.png'],
    },

    
    maintenanceMode: {
        enabled: {
            type: Boolean,
            default: false,
        },
        message: {
            type: String,
            default: 'The platform is currently down for maintenance. We will be back shortly!'
        }
    }
}, { timestamps: true });

export default model('Setting', settingsSchema);