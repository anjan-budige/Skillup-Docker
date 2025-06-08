import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, Eye, Download, CheckCircle, AlertTriangle, Clock, UploadCloud, File, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';
import { uploadTaskImage } from '../../utils/uploadTaskImage';
import { uploadAttachment } from '../../utils/uploadAttachment';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';

// --- Reusable Components ---

function Modal({ isOpen, onClose, title, children, size = 'max-w-4xl' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-2xl shadow-xl w-full ${size} m-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white p-6 border-b z-10">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl absolute top-4 right-4">×</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
            </motion.div>
        </div>
    );
}

const UserAvatar = ({ user, size = 'w-8 h-8' }) => (
    user?.photo ?
        <img src={user.photo} alt={user.firstName || 'User'} className={`${size} rounded-full object-cover`} />
        :
        <div className={`${size} rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold`}>
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
);

const TaskStatusBadge = ({ status }) => {
    const styles = {
        Active: 'bg-green-100 text-green-800',
        Upcoming: 'bg-emerald-100 text-emerald-800',
        Completed: 'bg-gray-200 text-gray-800'
    };
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status]}`}>{status}</span>;
};

const CourseSingleSelect = ({ placeholder, selectedItem, onSelectionChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [showResults, setShowResults] = useState(false);
    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        setSearchTerm(selectedItem?.label || '');
    }, [selectedItem]);

    useEffect(() => {
        if (debouncedSearch.length < 1) {
            setResults([]);
            return;
        }
        const searchCourses = async () => {
            if (searchTerm !== selectedItem?.label) {
                try {
                    const token = Cookies.get('token');
                    const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/search/task-assignables?type=course`, {
                        headers: { Authorization: `Bearer ${token}` },
                        params: { q: debouncedSearch }
                    });
                    setResults(res.data.data);
                    setShowResults(true);
                } catch (error) {}
            }
        };
        searchCourses();
    }, [debouncedSearch, selectedItem, searchTerm]);

    const selectItem = (item) => {
        const label = `${item.title} (${item.courseCode})`;
        onSelectionChange({ id: item._id, label });
        setSearchTerm(label);
        setShowResults(false);
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        if (selectedItem) onSelectionChange(null);
    };

    return (
        <div className="relative">
            <label className="text-sm font-medium text-slate-700 mb-1 block">Select Course *</label>
            <input type="text" value={searchTerm} onChange={handleInputChange} placeholder={placeholder} required
                onFocus={() => setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            {showResults && results.length > 0 && (
                <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                    {results.map(item => (
                        <li key={item._id} onMouseDown={() => selectItem(item)} className="px-3 py-2 hover:bg-emerald-50 cursor-pointer">{item.title} ({item.courseCode})</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const InputField = ({ name, label, type, value, onChange, placeholder, required = true }) => (
    <div>
        <label htmlFor={name} className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
);

// --- Main Component ---
function FacultyTasks() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filters, setFilters] = useState({ search: '' });
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [taskDetails, setTaskDetails] = useState({ task: null, stats: {} });
    
    const [formData, setFormData] = useState({});
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [selectedAttachments, setSelectedAttachments] = useState([]);

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = { page: pagination.page, limit: 9, search: debouncedSearch };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/all`, {
                headers: { Authorization: `Bearer ${token}` }, params
            });
            if (response.data.success) {
                setTasks(response.data.data);
                setPagination(response.data.pagination);
            }
        } catch (err) { toast.error("Failed to fetch tasks."); }
        finally { setIsLoading(false); }
    }, [pagination.page, debouncedSearch]);

    useEffect(() => {
        document.title = "Faculty | Manage Tasks";
        fetchTasks();
    }, [fetchTasks]);

    const openModal = (type, data = null) => {
        setModalState({ type, data });
        setSelectedPhotoFile(null);
        setSelectedAttachments([]);
        if (type === 'add') {
            setFormData({
                title: '', description: '', maxPoints: '',
                publishDate: '', dueDate: '',
                type: 'Assignment', attachments: [], course: null, photo: null,
            });
            setPhotoPreview(null);
        } else if (type === 'edit') {
            setFormData({
                ...data,
                course: data.course ? { id: data.course._id, label: `${data.course.title} (${data.course.courseCode})` } : null,
            });
            setPhotoPreview(data.photo);
        }
    };

    const openDetailsModal = async (taskId) => {
        try {
            const token = Cookies.get('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/details/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTaskDetails(res.data.data);
            setModalState({ type: 'details', data: res.data.data.task });
        } catch (error) { toast.error("Failed to load task details."); }
    };

    const closeModal = () => {
        setModalState({ type: null, data: null });
        setFormData({});
        setSelectedPhotoFile(null);
        setPhotoPreview(null);
    };

    const handleFormInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSingleSelectChange = (type, item) => setFormData(prev => ({ ...prev, [type]: item }));
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };
    const handleAttachmentChange = (e) => setSelectedAttachments(prev => [...prev, ...Array.from(e.target.files)]);
    const removeNewAttachment = (fileName) => setSelectedAttachments(prev => prev.filter(f => f.name !== fileName));
    const removeExistingAttachment = (fileName) => setFormData(prev => ({ ...prev, attachments: prev.attachments.filter(f => f.fileName !== fileName) }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.course?.id) {
            toast.error("Please select a course.");
            return;
        }
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            let photoUrl = formData.photo || null;
            if (selectedPhotoFile) {
                photoUrl = await uploadTaskImage(selectedPhotoFile, modalState.data?._id || 'new-task');
            }

            let finalAttachments = formData.attachments || [];
            if (selectedAttachments.length > 0) {
                toast.info("Uploading attachments...");
                const uploadPromises = selectedAttachments.map(file => uploadAttachment(file, 'task-attachments'));
                const newAttachments = await Promise.all(uploadPromises);
                finalAttachments = [...finalAttachments, ...newAttachments];
            }
            
            const payload = { ...formData, photo: photoUrl, attachments: finalAttachments, course: formData.course.id };
            delete payload.createdBy;

            const headers = { Authorization: `Bearer ${token}` };
            if (modalState.type === 'add') {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/add`, payload, { headers });
                toast.success('Task created successfully!');
            } else if (modalState.type === 'edit') {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/update/${modalState.data._id}`, payload, { headers });
                toast.success('Task updated successfully!');
            }
            fetchTasks();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatLocalDate = (dateStr) => {
        const date = new Date(dateStr);
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - offset * 60000);
        return localDate.toISOString().slice(0, 16);
    };
    
    const handleDelete = async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/delete/${modalState.data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Task and its submissions deleted.');
            closeModal();
            fetchTasks();
        } catch (err) {
            toast.error('Failed to delete task.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-slate-800">Manage Tasks</h2>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search tasks..." value={filters.search}
                                onChange={(e) => setFilters({ search: e.target.value })} className="w-full pl-10 pr-3 py-2 border rounded-lg" />
                        </div>
                        <button onClick={() => openModal('add')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700">
                            <PlusCircle size={20} /> Add Task
                        </button>
                    </div>
                </div>

                {isLoading ? <p className="text-center py-10">Loading tasks...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tasks.map(task => (
                            <motion.div key={task._id} className="bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col group">
                                <div className="relative">
                                    <img src={task.photo || `https://placehold.co/600x400/e2e8f0/475569?text=${task.type}`} alt={task.title} className="w-full h-40 object-cover"/>
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openModal('edit', task)} className="bg-white/80 p-1.5 rounded-full text-emerald-600 hover:bg-white"><Edit size={16}/></button>
                                        <button onClick={() => setModalState({ type: 'delete', data: task })} className="bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="p-5 flex flex-col flex-grow">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-indigo-600 uppercase">{task.type}</span>
                                        <TaskStatusBadge status={task.status} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 line-clamp-2">{task.title}</h3>
                                    <p className="text-sm text-slate-500 mb-3">For: <span className="font-semibold">{task.course?.title || 'N/A'}</span></p>
                                    <div className="text-sm text-slate-600 mb-4 flex-grow space-y-1">
                                        <p><strong>Starts:</strong> {new Date(task.publishDate).toLocaleDateString('en-GB')}</p>
                                        <p><strong>Due:</strong> {new Date(task.dueDate).toLocaleDateString('en-GB')}</p>
                                    </div>
                                    <div className="mt-auto pt-4 border-t">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2" title={`Created by ${task.createdBy?.firstName} ${task.createdBy?.lastName}`}>
                                                <UserAvatar user={task.createdBy} size="w-7 h-7" />
                                                <span className="text-xs font-medium text-slate-600">{task.createdBy?.firstName} {task.createdBy?.lastName}</span>
                                            </div>
                                            <button onClick={() => openDetailsModal(task._id)} className="text-sm font-semibold text-emerald-600 hover:underline">View Details</button>
                                            <button 
                                                onClick={() => navigate(`/faculty/tasks/${task._id}`)} 
                                                className="p-3 py-2 bg-emerald-100 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-200 flex items-center justify-center gap-2 text-sm"
                                            >
                                                Submissions
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
                {tasks.length === 0 && !isLoading && <p className="text-center p-8 text-slate-500">No tasks found.</p>}
                
                <div className="flex justify-center items-center mt-8">
                    <div className="flex gap-2">
                        <button onClick={() => setPagination(p => ({...p, page: p.page - 1}))} disabled={pagination.page <= 1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Prev</button>
                        <span className="self-center text-sm">Page {pagination.page} of {pagination.totalPages}</span>
                        <button onClick={() => setPagination(p => ({...p, page: p.page + 1}))} disabled={pagination.page >= pagination.totalPages} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
                    </div>
                </div>
            </motion.div>

            <Modal isOpen={modalState.type === 'details'} onClose={closeModal} title="Task Details" size="max-w-3xl">
                {taskDetails.task && (
                    <div>
                        {/* --- Hero Section with Image Banner --- */}
                        <div className="relative -m-6 mb-6">
                            <div className="w-full h-48 rounded-t-2xl overflow-hidden bg-slate-200">
                                <img 
                                    src={taskDetails.task.photo || `https://placehold.co/800x400/e2e8f0/475569?text=${taskDetails.task.type}`} 
                                    alt={taskDetails.task.title} 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            {/* Gradient overlay for text readability */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-6">
                                <h3 className="text-2xl font-bold text-white shadow-lg">{taskDetails.task.title}</h3>
                                <p className="text-slate-200 text-sm">
                                    In <span className="font-semibold text-white">{taskDetails.task.course.title}</span> by {taskDetails.task.createdBy.firstName} {taskDetails.task.createdBy.lastName}
                                </p>
                            </div>
                        </div>

                        {/* --- Content Section --- */}
                        <div className="px-1">
                            <p className="mt-4 text-slate-700">{taskDetails.task.description}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                                <div>
                                    <h4 className="font-bold mb-3 text-slate-700">Attachments from Instructor</h4>
                                    <ul className="space-y-2">
                                        {taskDetails.task.attachments?.length > 0 ? taskDetails.task.attachments.map(file => (
                                            <a href={file.url} target="_blank" rel="noopener noreferrer" key={file.fileName}
                                                className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                                <Download size={18} className="text-emerald-600 shrink-0" />
                                                <span className="text-sm text-emerald-700 underline truncate">{file.fileName}</span>
                                            </a>
                                        )) : <p className="text-sm text-slate-500">No attachments provided.</p>}
                                    </ul>
                                </div>
                                <div>
                                    <h4 className="font-bold mb-3 text-slate-700">Submission Statistics</h4>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                                            <span className="flex items-center gap-2 text-green-700">
                                                <CheckCircle size={18} className="text-green-500"/> 
                                                Total Grades
                                            </span> 
                                            <span className="font-bold text-green-800 bg-white px-3 py-1 rounded-full shadow-sm">
                                                {taskDetails.stats['totalGraded'] || 0}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-yellow-50 rounded-lg">
                                            <span className="flex items-center gap-2 text-yellow-700">
                                                <AlertTriangle size={18} className="text-yellow-500"/> 
                                                Total Submitted
                                            </span> 
                                            <span className="font-bold text-yellow-800 bg-white px-3 py-1 rounded-full shadow-sm">
                                                {taskDetails.stats['totalSubmitted'] || 0}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center p-2 bg-emerald-50 rounded-lg">
                                            <span className="flex items-center gap-2 text-emerald-700">
                                                <Users size={18} className="text-emerald-500"/> 
                                                Total Students
                                            </span> 
                                            <span className="font-bold text-emerald-800 bg-white px-3 py-1 rounded-full shadow-sm">
                                                {taskDetails.stats['totalEnrolled'] || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-8 pt-6 border-t">
                                <button onClick={() => setModalState({ type: 'delete', data: taskDetails.task })} className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold">
                                    <Trash2 size={16} /> Delete This Task
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            
            <Modal isOpen={modalState.type === 'add' || modalState.type === 'edit'} onClose={closeModal} title={modalState.type === 'add' ? 'Create New Task' : 'Edit Task'}>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <InputField name="title" label="Task Title" value={formData.title || ''} onChange={handleFormInputChange} placeholder="e.g., Final Project Proposal" />
                    <CourseSingleSelect placeholder="Search for a course..." selectedItem={formData.course} onSelectionChange={(item) => handleSingleSelectChange('course', item)} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField name="maxPoints" label="Max Points" type="number" value={formData.maxPoints || ''} onChange={handleFormInputChange} placeholder="e.g., 100" />
                        <div>
                            <label htmlFor="type" className="text-sm font-medium text-slate-700 mb-1 block">Task Type</label>
                            <select name="type" id="type" value={formData.type || 'Assignment'} onChange={handleFormInputChange} className="w-full px-3 py-2 border border-slate-300 rounded-md">
                                <option>Assignment</option><option>Quiz</option><option>Project</option><option>Lab Report</option>
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField
                            name="publishDate"
                            label="Publish Date"
                            type="datetime-local"
                            value={formData.publishDate ? formatLocalDate(formData.publishDate) : ''}
                            onChange={handleFormInputChange}
                        />
                        <InputField
                            name="dueDate"
                            label="Due Date"
                            type="datetime-local"
                            value={formData.dueDate ? formatLocalDate(formData.dueDate) : ''}
                            onChange={handleFormInputChange}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Description</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleFormInputChange} rows="3" className="w-full px-3 py-2 border border-slate-300 rounded-md"></textarea>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Task Image</label>
                        <div className="flex items-center gap-4">
                            <div className="aspect-video w-32 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-slate-400" />}
                            </div>
                            <label htmlFor="photo-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm hover:bg-slate-50">
                                <UploadCloud size={16} /> Choose Image
                            </label>
                            <input id="photo-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handlePhotoChange} />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Add Attachments</label>
                        <input type="file" multiple onChange={handleAttachmentChange} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                        <div className="mt-2 space-y-1">
                            {formData.attachments?.map(file => <div key={file.fileName} className="text-xs flex items-center justify-between bg-slate-100 p-1.5 rounded"><span>{file.fileName}</span><button type="button" onClick={() => removeExistingAttachment(file.fileName)}><X size={14}/></button></div>)}
                            {selectedAttachments.map(file =>                             <div key={file.name} className="text-xs flex items-center justify-between bg-emerald-100 p-1.5 rounded"><span>{file.name}</span><button type="button" onClick={() => removeNewAttachment(file.name)}><X size={14}/></button></div>)}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={closeModal} className="px-6 py-2 bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                            {isSubmitting ? 'Saving...' : 'Save Task'}
                        </button>
                    </div>
                </form>
            </Modal>
            
            <Modal isOpen={modalState.type === 'delete'} onClose={closeModal} title="Confirm Deletion" size="max-w-md">
                <p className="my-4 text-slate-600">Are you sure you want to permanently delete the task <span className="font-bold">{modalState.data?.title}</span>? This action cannot be undone.</p>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Deleting...' : 'Yes, Delete'}</button>
                </div>
            </Modal>
        </>
    );
}

export default FacultyTasks;