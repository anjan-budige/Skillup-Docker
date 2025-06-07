import { Schema, model } from 'mongoose';

const settingsSchema = new Schema({
    // A unique key to ensure we only ever have one settings document
    key: {
        type: String,
        default: 'global',
        unique: true,
    },

    // General Platform Settings
    platformName: {
        type: String,
        required: true,
        default: 'SkillUp Platform',
        trim: true,
    },
    platformLogo: {
        type: String, // URL to the logo image
        default: null,
    },
    supportEmail: {
        type: String,
        trim: true,
        lowercase: true,
    },

    // Policy Settings
    allowStudentRegistration: {
        type: Boolean,
        default: false, // More secure by default
    },
    allowLateSubmissions: {
        type: Boolean,
        default: true,
    },
    maxUploadSizeMB: {
        type: Number,
        default: 10, // Max size in Megabytes
    },
    allowedFileTypes: {
        type: [String], // e.g., ['.pdf', '.docx', '.zip']
        default: ['.pdf', '.docx', '.pptx', '.zip', '.jpg', '.png'],
    },

    // Maintenance Mode
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