import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Building, UploadCloud, Wrench, Save, File, Mail, Users, Clock, MessageSquare } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { uploadLogoImage } from '../../utils/uploadLogoImage'; 


const ToggleSwitch = ({ enabled, onChange }) => {
    return (
        <div onClick={onChange} className={`flex items-center w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 ${enabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
            <motion.div layout transition={{ type: 'spring', stiffness: 700, damping: 30 }} className="w-4 h-4 bg-white rounded-full shadow" />
        </div>
    );
};


const SettingsCard = ({ title, description, children }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-200/80 overflow-hidden"
    >
        <div className="p-6 border-b">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">{description}</p>
        </div>
        <div className="p-6 bg-slate-50/50 space-y-6">
            {children}
        </div>
    </motion.div>
);

const InputGroup = ({ icon, label, children }) => (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="w-full sm:w-1/3">
            <label className="font-semibold text-slate-700 flex items-center gap-2">
                {icon}
                {label}
            </label>
        </div>
        <div className="w-full sm:w-2/3">{children}</div>
    </div>
);


function AdminSettings() {
    const [settings, setSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');

    const fetchSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/settings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setSettings(response.data.data);
                setLogoPreview(response.data.data.platformLogo);
            }
        } catch (error) { 
            toast.error("Failed to load settings."); 
        } 
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        document.title = "Admin | Platform Settings";
        fetchSettings();
    }, [fetchSettings]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleNestedChange = (parent, e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [parent]: { ...prev[parent], [name]: value }
        }));
    };

    const handleToggleChange = (name) => {
        setSettings(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };
    
    const handleSaveSettings = async () => {
        setIsSaving(true);
        const saveToastId = toast.loading("Saving settings...");
        
        try {
            const token = Cookies.get('token');
            let updatedSettingsData = { ...settings };

            if (logoFile) {
                const logoUrl = await uploadLogoImage(logoFile, 'platform-assets');
                updatedSettingsData.platformLogo = logoUrl;
            }
            
            
            if (typeof updatedSettingsData.allowedFileTypes === 'string') {
                updatedSettingsData.allowedFileTypes = updatedSettingsData.allowedFileTypes
                    .split(',')
                    .map(ext => ext.trim())
                    .filter(ext => ext); 
            }

            const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/settings`, updatedSettingsData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (response.data.success) {
                toast.update(saveToastId, { 
                    render: "Settings saved successfully!", 
                    type: "success", 
                    isLoading: false, 
                    autoClose: 3000,
                });
                
                setSettings(response.data.data);
                setLogoPreview(response.data.data.platformLogo);
                setLogoFile(null); 
            } else {
                
                throw new Error(response.data.message || "Failed to save settings");
            }

        } catch (error) {
            toast.update(saveToastId, {
                render: error.message || "Failed to save settings.", 
                type: "error", 
                isLoading: false, 
                autoClose: 5000,
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />

            {isLoading ? (
                <div className="text-center p-10">Loading settings...</div>
            ) : !settings ? (
                <div className="text-center p-10 bg-red-50 text-red-700 rounded-lg">
                    Could not load platform settings. Please try refreshing the page.
                </div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-bold text-slate-800">Platform Settings</h2>
                    </div>
                    
                    <SettingsCard title="General" description="Basic information and branding for the platform.">
                        <InputGroup label="Platform Name" icon={<Building size={20} />}>
                            <input type="text" name="platformName" value={settings.platformName || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md" />
                        </InputGroup>
                        <InputGroup label="Platform Logo" icon={<UploadCloud size={20} />}>
                            <div className="flex items-center gap-4">
                                {logoPreview && <img src={logoPreview} alt="Logo Preview" className="w-16 h-16 object-contain bg-slate-200 p-1 rounded-md" />}
                                <label htmlFor="logo-upload" className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">Change logo</label>
                                <input id="logo-upload" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={handleLogoChange} />
                            </div>
                        </InputGroup>
                        <InputGroup label="Support Email" icon={<Mail size={20} />}>
                            <input type="email" name="supportEmail" value={settings.supportEmail || ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md" />
                        </InputGroup>
                    </SettingsCard>
                    
                    <SettingsCard title="Policies" description="Rules for user registration and task submissions.">
                        <InputGroup label="Allow Student Self-Registration" icon={<Users size={20} />}>
                            <ToggleSwitch enabled={settings.allowStudentRegistration} onChange={() => handleToggleChange('allowStudentRegistration')} />
                        </InputGroup>
                         <InputGroup label="Allow Late Submissions" icon={<Clock size={20} />}>
                            <ToggleSwitch enabled={settings.allowLateSubmissions} onChange={() => handleToggleChange('allowLateSubmissions')} />
                        </InputGroup>
                        <InputGroup label="Allowed File Types" icon={<File size={20} />}>
                            <input type="text" name="allowedFileTypes" value={Array.isArray(settings.allowedFileTypes) ? settings.allowedFileTypes.join(', ') : ''} onChange={handleInputChange} className="w-full px-3 py-2 border rounded-md" placeholder=".pdf, .docx, .zip" />
                        </InputGroup>
                    </SettingsCard>

                    <SettingsCard title="Maintenance Mode" description="Temporarily take the platform offline for users.">
                        <InputGroup label="Enable Maintenance Mode" icon={<Wrench size={20} />}>
                            <ToggleSwitch enabled={settings.maintenanceMode.enabled} onChange={() => setSettings(p => ({...p, maintenanceMode: {...p.maintenanceMode, enabled: !p.maintenanceMode.enabled}}))} />
                        </InputGroup>
                        <InputGroup label="Maintenance Message" icon={<MessageSquare size={20} />}>
                            <textarea name="message" value={settings.maintenanceMode.message || ''} onChange={(e) => handleNestedChange('maintenanceMode', e)} rows="3" className="w-full px-3 py-2 border rounded-md" disabled={!settings.maintenanceMode.enabled}></textarea>
                        </InputGroup>
                    </SettingsCard>
                    
                    <div className="flex justify-end pt-4">
                        <button onClick={handleSaveSettings} disabled={isSaving} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                            <Save size={20} />
                            {isSaving ? 'Saving...' : 'Save All Settings'}
                        </button>
                    </div>
                </motion.div>
            )}
        </>
    );
}

export default AdminSettings;