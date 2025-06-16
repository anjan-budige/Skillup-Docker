import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Mail, Building, Shield, Users, UserPlus, CheckSquare, BarChart3, Edit3, KeyRound, X, Eye, EyeOff, UploadCloud, Trash2 } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Cookies from 'js-cookie';

import { uploadImage } from '../utils/imageUpload'; 


const DefaultAvatar = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"></path>
  </svg>
);


function Modal({ isOpen, onClose, title, children, size = "max-w-lg" }) {
  if (!isOpen) return null;
  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`bg-white p-6 rounded-xl shadow-2xl w-full ${size} relative`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
            <X size={22} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}


const InfoItem = ({ icon: IconComponent, label, value, iconColor = "text-blue-500" }) => (
  <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-slate-100/60 transition-colors duration-150">
    <IconComponent className={`w-6 h-6 ${iconColor} mt-0.5 shrink-0`} />
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-slate-800 font-semibold text-sm break-words">{value || 'N/A'}</p>
    </div>
  </div>
);


const PermissionItem = ({ icon: IconComponent, text }) => (
  <div className="flex items-center space-x-3 p-3 bg-blue-50/50 rounded-lg border border-blue-200/70 hover:shadow-md transition-shadow">
    <IconComponent className="w-5 h-5 text-blue-600 shrink-0" />
    <p className="text-sm text-slate-700">{text}</p>
  </div>
);


const InputField = ({ label, name, type = "text", value, onChange, placeholder, required = false, disabled = false, children }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <input
        type={type} name={name} id={name} value={value} onChange={onChange} placeholder={placeholder}
        required={required} disabled={disabled}
        className={`w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${disabled ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''} ${children ? 'pr-10' : ''}`}
      />
      {children && <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">{children}</div>}
    </div>
  </div>
);


function AdminProfile() {

  const [userDetails, setUserDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '',
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '', newPassword: '', confirmNewPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      setIsLoading(true);
      try {
        const token = Cookies.get('token');
        const sessionCookie = Cookies.get('session');
        if (!token || !sessionCookie) {
          toast.error('Authentication details not found.'); setIsLoading(false); return;
        }
        const sessionData = JSON.parse(sessionCookie);
        const { data: sessionUser } = sessionData;
        if (!sessionUser || !sessionUser.role || !sessionUser.id) {
          toast.error('Invalid session data.'); setIsLoading(false); return;
        }
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/user-details`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ role: sessionUser.role, userId: sessionUser.id })
        });
        const result = await response.json();
        if (result.success) {
          setUserDetails(result.data);
          const newFormData = {
            firstName: result.data.firstName || '',
            lastName: result.data.lastName || '',
            email: result.data.email || '',
          };
          setFormData(newFormData);
          setPhotoPreview(result.data.photo || null);
        } else {
          toast.error(result.message || 'Failed to load profile.');
        }
      } catch (error) {
        toast.error('Error loading profile.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserDetails();
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File is too large. Max 2MB allowed."); return;
      }
      if (!['image/jpeg', 'image/png', 'image/gif'].includes(file.type)) {
        toast.error("Invalid file type. Only JPG, PNG, GIF allowed."); return;
      }
      setSelectedPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveSelectedPhoto = () => {
    setSelectedPhotoFile(null);
    setPhotoPreview(userDetails?.photo || null);
    const fileInput = document.getElementById('photo-upload');
    if (fileInput) fileInput.value = "";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updatedState = { ...prev, [name]: value };
      return updatedState;
    });
  };
  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => {
      const updatedState = { ...prev, [name]: value };
      return updatedState;
    });
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      if (!token) {
        toast.error('Authentication token not found'); setIsSubmitting(false); return;
      }
      let photoUrl = userDetails?.photo;
      if (selectedPhotoFile) {
        try {
          photoUrl = await uploadImage(selectedPhotoFile, 'profile-photos');
        } catch (uploadError) {
          toast.error('Failed to upload photo. Please try again.');
          setIsSubmitting(false); return;
        }
      }
      const profileData = { ...formData, photo: photoUrl };
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profileData)
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Profile updated successfully!');
        setUserDetails(prev => ({ ...prev, ...result.data }));
        setPhotoPreview(result.data.photo || null);
        setSelectedPhotoFile(null);
        setIsEditModalOpen(false);
        window.location.reload();
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch (error) {
      toast.error('Error updating profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      toast.error('New passwords do not match'); return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long'); return;
    }
    setIsSubmitting(true);
    try {
      const token = Cookies.get('token');
      if (!token) {
        toast.error('Authentication token not found'); setIsSubmitting(false); return;
      }
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Password changed successfully!');
        setIsPasswordModalOpen(false);
        setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
      } else {
        toast.error(result.message || 'Failed to change password');
      }
    } catch (error) {
      toast.error('Error changing password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const adminPermissions = [
    { icon: Users, text: "Manage Student Information" },
    { icon: UserPlus, text: "Manage Faculty Accounts" },
    { icon: CheckSquare, text: "Oversee and Administer Tasks" },
    { icon: BarChart3, text: "Access and Analyze Platform Data" },
  ];

  if (isLoading) {
    return (
      <div className="flex-grow flex items-center justify-center p-6 min-h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-t-4 border-blue-600"></div>
          <p className="mt-3 text-slate-600">Loading Profile...</p>
        </div>
      </div>
    );
  }
  if (!userDetails) {
    return (
      <div className="flex-grow flex items-center justify-center p-6 min-h-[calc(100vh-200px)] text-center">
        <div className="bg-white/70 backdrop-blur-md p-8 rounded-xl shadow-lg border border-gray-200/50">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Profile Not Found</h2>
          <p className="text-slate-600">Could not load admin profile details.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 font-inter">
      <ToastContainer theme="colored" position="bottom-right" autoClose={3000} />
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="max-w-5xl mx-auto"
      >
        <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50/60 rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden">
          <div className="relative h-40 md:h-48 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-700">
            <div className="absolute -bottom-16 left-6 md:left-10">
              {userDetails.photo ? (
                <img src={userDetails.photo} alt={`${userDetails.firstName} ${userDetails.lastName}`} className="w-28 h-28 md:w-32 md:h-32 rounded-full border-4 md:border-[6px] border-white object-cover shadow-lg bg-gray-200"/>
              ) : (
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 border-4 md:border-[6px] border-white flex items-center justify-center shadow-lg">
                  <span className="text-4xl md:text-5xl font-semibold text-blue-700">{`${userDetails.firstName?.charAt(0) || ''}${userDetails.lastName?.charAt(0) || ''}`.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>
          <div className="pt-20 md:pt-24 p-6 md:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">{`${userDetails.firstName} ${userDetails.lastName}`}</h1>
                    <p className="text-blue-600 font-medium text-md mt-1">Administrator</p>
                </div>
                <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                    <button onClick={() => { 
                        setFormData({ firstName: userDetails.firstName, lastName: userDetails.lastName, email: userDetails.email });
                        setSelectedPhotoFile(null);
                        setPhotoPreview(userDetails.photo || null);
                        setIsEditModalOpen(true); 
                      }} 
                      className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        <Edit3 size={16} className="mr-2" /> Edit Profile
                    </button>
                    <button onClick={() => setIsPasswordModalOpen(true)} className="flex items-center justify-center px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-100 transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50">
                        <KeyRound size={16} className="mr-2" /> Change Password
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className="lg:col-span-1 space-y-6 bg-white/60 p-6 rounded-xl border border-gray-200/70 shadow-sm">
                <div>
                  <h2 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2">Personal Information</h2>
                  <div className="space-y-1">
                    <InfoItem icon={User} label="Username" value={userDetails.username} />
                    <InfoItem icon={Mail} label="Email Address" value={userDetails.email} />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-700 mb-3 border-b pb-2 pt-3">Account Details</h2>
                  <div className="space-y-1">
                    <InfoItem icon={Shield} label="Role" value="Administrator" iconColor="text-green-500" />
                    <InfoItem icon={Building} label="Member Since" value={new Date(userDetails.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} iconColor="text-purple-500" />
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white/60 p-6 rounded-xl border border-gray-200/70 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-700 mb-4 border-b pb-3">Key Responsibilities</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {adminPermissions.map((permission) => ( <PermissionItem key={permission.text} icon={permission.icon} text={permission.text} /> ))}
                </div>
                <div className="mt-6 p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-center">
                    <p className="text-sm text-indigo-700">As an Administrator, you have full access to manage all aspects of the SkillUp platform. Please use these privileges responsibly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Edit Profile Modal with Simplified Input Test */}
      <AnimatePresence>
        {isEditModalOpen && (
          <Modal 
            key="edit-profile-modal" 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            title="Edit Profile" 
            size="max-w-2xl"
          >
            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profile Photo</label>
                <div className="flex items-center space-x-4">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <DefaultAvatar className="w-24 h-24 rounded-full text-slate-300 border-2 border-slate-200 p-1" />
                  )}
                  <div>
                    <label htmlFor="photo-upload" className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      <UploadCloud size={16} className="mr-2" /> Change Photo
                    </label>
                    <input id="photo-upload" name="photoFile" type="file" className="sr-only" onChange={handlePhotoChange} accept="image/png, image/jpeg, image/gif" />
                    {selectedPhotoFile && (
                      <button type="button" onClick={handleRemoveSelectedPhoto} className="ml-3 inline-flex items-center px-3 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                        <Trash2 size={16} className="mr-1.5 text-red-500" /> Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-1">Max 2MB. JPG, PNG, GIF.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {/* SIMPLIFIED INPUT TEST for First Name */}
                <div>
                  <label htmlFor="firstNameSimplified" className="block text-sm font-medium text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="firstNameSimplified"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter first name"
                  />
                </div>

                {/* Using InputField for Last Name (can also be simplified for testing) */}
                <InputField label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} required placeholder="Enter last name" />
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                    <p className="w-full px-3 py-2 border border-slate-200 rounded-md bg-slate-50 text-slate-600 sm:text-sm cursor-not-allowed">
                        {userDetails?.username || 'N/A'}
                    </p>
                </div>
                <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleInputChange} required placeholder="Enter email address" />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t mt-6">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isPasswordModalOpen && (
          <Modal 
            key="change-password-modal" 
            isOpen={isPasswordModalOpen} 
            onClose={() => setIsPasswordModalOpen(false)} 
            title="Change Password"
          >
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              {/* SIMPLIFIED INPUT TEST for Current Password */}
              <div>
                <label htmlFor="currentPasswordSimplified" className="block text-sm font-medium text-slate-700 mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    id="currentPasswordSimplified"
                    name="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={handlePasswordInputChange}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                    <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="text-slate-500 hover:text-slate-700">
                      {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Using InputField for other password fields */}
              <InputField label="New Password" name="newPassword" type={showNewPassword ? "text" : "password"} value={passwordData.newPassword} onChange={handlePasswordInputChange} required>
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="text-slate-500 hover:text-slate-700">{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </InputField>
              <InputField label="Confirm New Password" name="confirmNewPassword" type={showConfirmNewPassword ? "text" : "password"} value={passwordData.confirmNewPassword} onChange={handlePasswordInputChange} required>
                <button type="button" onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} className="text-slate-500 hover:text-slate-700">{showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
              </InputField>
              <div className="flex justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50">
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

export default AdminProfile;