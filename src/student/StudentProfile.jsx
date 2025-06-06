import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Mail, Shield, Edit3, KeyRound, X, Eye, EyeOff, UploadCloud, Trash2, Calendar, Target, BookCheck, Trophy, Lightbulb } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Cookies from 'js-cookie';
import axios from 'axios';
import { BookOpen } from 'lucide-react';
// Make sure this utility exists and works in your project structure
import { uploadImage } from '../utils/imageUpload'; 

const DefaultAvatar = ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
    </svg>
);

function Modal({ isOpen, onClose, title, children, size = "max-w-lg" }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className={`bg-white p-6 rounded-xl shadow-2xl w-full ${size} relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full"><X size={22} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

const InfoItem = ({ icon: IconComponent, label, value, iconColor = "text-violet-500" }) => (
    <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-100/60">
        <IconComponent className={`w-6 h-6 ${iconColor} mt-0.5 shrink-0`} />
        <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-slate-800 font-semibold text-sm break-words">{value || 'N/A'}</p>
        </div>
    </div>
);

const GoalItem = ({ icon: IconComponent, text }) => (
  <div className="flex items-center space-x-3 p-3 bg-violet-50/50 rounded-lg border border-violet-200/70 hover:shadow-md">
    <IconComponent className="w-5 h-5 text-violet-600 shrink-0" />
    <p className="text-sm text-slate-700">{text}</p>
  </div>
);

const InputField = ({ label, name, type = "text", value, onChange, required = false, disabled=false, children }) => (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
      <div className="relative">
        <input 
            type={type} 
            name={name} 
            id={name} 
            value={value} 
            onChange={onChange} 
            required={required} 
            disabled={disabled}
            className={`w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 sm:text-sm ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''} ${children ? 'pr-10' : ''}`} 
        />
        {children && <div className="absolute inset-y-0 right-0 pr-3 flex items-center">{children}</div>}
      </div>
    </div>
);

function StudentProfile() {
  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '' });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
  const [showPasswords, setShowPasswords] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  useEffect(() => {
    const fetchUserDetails = async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const sessionCookie = Cookies.get('session');
            if (!token || !sessionCookie) throw new Error('Authentication details not found.');
            const { data: sessionUser } = JSON.parse(sessionCookie);
            if (!sessionUser?.role || !sessionUser?.id) throw new Error('Invalid session data.');

            const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/user-details`, 
                { role: sessionUser.role, userId: sessionUser.id },
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            if (response.data.success) {
                const data = response.data.data;
                setUserDetails(data);
                setFormData({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    email: data.email || '',
                });
                setPhotoPreview(data.photo || null);
            } else {
                toast.error(response.data.message || 'Failed to load profile.');
            }
        } catch (error) {
            toast.error(error.message || 'Error loading profile.');
        } finally {
            setIsLoading(false);
        }
    };
    fetchUserDetails();
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error("File is too large (Max 2MB)."); return; }
      if (!['image/jpeg', 'image/png'].includes(file.type)) { toast.error("Invalid file type (JPG, PNG only)."); return; }
      setSelectedPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveSelectedPhoto = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview(userDetails?.photo || null);
    const input = document.getElementById('photo-upload');
    if (input) input.value = "";
  };
  
  const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handlePasswordInputChange = (e) => setPasswordData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const togglePasswordVisibility = (field) => setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      let photoUrl = userDetails?.photo;
      if (selectedPhotoFile) {
        photoUrl = await uploadImage(selectedPhotoFile, 'profile-photos');
      }
      const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/auth/update-profile`, 
          { ...formData, photo: photoUrl },
          { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success('Profile updated successfully!');
        setUserDetails(prev => ({ ...prev, ...response.data.data }));
        setPhotoPreview(response.data.data.photo || null);
        setSelectedPhotoFile(null);
        setIsEditModalOpen(false);
        window.location.reload();
      } else {
        toast.error(response.data.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmNewPassword) { toast.error('New passwords do not match'); return; }
    if (passwordData.newPassword.length < 6) { toast.error('New password must be at least 6 characters long.'); return; }
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/auth/change-password`, 
        { currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (response.data.success) {
        toast.success('Password changed successfully!');
        setIsPasswordModalOpen(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      } else {
        toast.error(response.data.message || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Error changing password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const studentGoals = [
    { icon: Target, text: "Complete assigned tasks on time" },
    { icon: BookCheck, text: "Engage with course material" },
    { icon: Trophy, text: "Strive for academic excellence" },
    { icon: Lightbulb, text: "Contribute to class discussions" },
  ];

  if (isLoading) return <div className="flex-grow flex items-center justify-center p-6"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-purple-600"></div></div>;
  if (!userDetails) return <div className="flex-grow flex items-center justify-center p-6"><h2 className="text-xl font-semibold text-red-600">Profile Not Found</h2></div>;
  
  return (
    <div className="p-4 md:p-6 font-inter">
      <ToastContainer theme="colored" position="bottom-right" autoClose={3000} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-white via-slate-50 to-purple-50/60 rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden">
          <div className="relative h-40 md:h-48 bg-gradient-to-r from-violet-500 via-purple-600 to-indigo-700">
            <div className="absolute -bottom-16 left-6 md:left-10">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 md:border-[6px] border-white object-cover shadow-lg"/>
              ) : (
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-purple-100 to-violet-200 border-4 md:border-[6px] border-white flex items-center justify-center shadow-lg">
                  <span className="text-4xl md:text-5xl font-semibold text-purple-700">{`${userDetails.firstName?.charAt(0) || ''}${userDetails.lastName?.charAt(0) || ''}`.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <div className="pt-20 md:pt-24 p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-800">{`${userDetails.firstName} ${userDetails.lastName}`}</h1>
                <p className="text-purple-600 font-medium text-md mt-1">Student</p>
              </div>
              <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                <button onClick={() => setIsEditModalOpen(true)} className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 shadow-md focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <Edit3 size={16} className="mr-2" /> Edit Profile
                </button>
                <button onClick={() => setIsPasswordModalOpen(true)} className="flex items-center justify-center px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <KeyRound size={16} className="mr-2" /> Change Password
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-1 space-y-4 bg-white/60 p-6 rounded-xl border border-gray-200/70 shadow-sm">
                <InfoItem icon={User} label="Username" value={userDetails.username} />
                <InfoItem icon={Mail} label="Email Address" value={userDetails.email} />
                <InfoItem icon={Shield} label="Role" value="Student" iconColor="text-green-500" />
                <InfoItem icon={BookOpen} label="Department" value={userDetails.department} iconColor="text-blue-500" />
                <InfoItem icon={Calendar} label="Member Since" value={new Date(userDetails.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} iconColor="text-pink-500" />
              </div>
              <div className="lg:col-span-2 bg-white/60 p-6 rounded-xl border border-gray-200/70 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-3">My Learning Journey</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentGoals.map((item) => ( <GoalItem key={item.text} icon={item.icon} text={item.text} /> ))}
                </div>
                <div className="mt-6 p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-center">
                  <p className="text-sm text-indigo-700">Stay focused and organized to achieve your academic goals. We're here to support you!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* --- MODAL CONTENT IS NOW INCLUDED --- */}
      <AnimatePresence>
        {isEditModalOpen && (
          <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Profile" size="max-w-2xl">
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
                  <div className="flex items-center space-x-4">
                      {photoPreview ? <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" /> : <DefaultAvatar className="w-24 h-24 rounded-full text-slate-300 border-2 border-slate-200 p-1" />}
                      <div>
                          <label htmlFor="photo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700">
                              <UploadCloud size={16} className="mr-2" /> Change Photo
                          </label>
                          <input id="photo-upload" name="photoFile" type="file" className="sr-only" onChange={handlePhotoChange} accept="image/png, image/jpeg" />
                          {selectedPhotoFile && (
                              <button type="button" onClick={handleRemoveSelectedPhoto} className="ml-3 inline-flex items-center px-3 py-2 border border-slate-300 text-sm rounded-md text-slate-700 bg-white hover:bg-slate-50">
                                  <Trash2 size={16} className="mr-1.5 text-red-500" /> Remove
                              </button>
                          )}
                      </div>
                  </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputField label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                  <InputField label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
                  <InputField label="Email Address" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                  <InputField label="Username" name="username" value={userDetails.username} disabled />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isPasswordModalOpen && (
          <Modal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} title="Change Password">
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
                <InputField label="Current Password" name="currentPassword" type={showPasswords.current ? "text" : "password"} value={passwordData.currentPassword} onChange={handlePasswordInputChange} required>
                    <button type="button" onClick={() => togglePasswordVisibility('current')} className="text-slate-500 hover:text-slate-700">{showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </InputField>
                <InputField label="New Password" name="newPassword" type={showPasswords.new ? "text" : "password"} value={passwordData.newPassword} onChange={handlePasswordInputChange} required>
                    <button type="button" onClick={() => togglePasswordVisibility('new')} className="text-slate-500 hover:text-slate-700">{showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </InputField>
                <InputField label="Confirm New Password" name="confirmNewPassword" type={showPasswords.confirm ? "text" : "password"} value={passwordData.confirmNewPassword} onChange={handlePasswordInputChange} required>
                    <button type="button" onClick={() => togglePasswordVisibility('confirm')} className="text-slate-500 hover:text-slate-700">{showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </InputField>
                <div className="flex justify-end space-x-3 pt-2">
                    <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Updating...' : 'Update Password'}
                    </button>
                </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StudentProfile;