import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, Users, Eye, UploadCloud, Image as ImageIcon, X } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';
import { uploadCourseImage } from '../../utils/uploadCourseImage';



function Modal({ isOpen, onClose, title, children, size = 'max-w-4xl' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-2xl shadow-xl w-full ${size} m-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white p-6 border-b z-10">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl absolute top-4 right-4">×</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
            </motion.div>
        </div>
    );
}

const InputField = ({ name, label, type, value, onChange, placeholder, required = true }) => (
    <div>
        <label htmlFor={name} className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
);

const UserAvatar = ({ user, size = 'w-8 h-8' }) => (
    user.photo ?
        <img src={user.photo} alt={user.firstName} className={`${size} rounded-full object-cover ring-2 ring-white`} />
        :
        <div className={`${size} rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold ring-2 ring-white`}>
            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
        </div>
);

const AssignableMultiSelect = ({ type, placeholder, selectedItems, onSelectionChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        if (debouncedSearch.length < 2) { setResults([]); return; }
        const searchItems = async () => {
            try {
                const token = Cookies.get('token');
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/search-batches`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { q: debouncedSearch }
                });
                setResults(response.data.data.filter(item => !selectedItems.some(sel => sel._id === item._id)));
            } catch (error) { toast.error(`Failed to search ${type}`); }
        };
        searchItems();
    }, [debouncedSearch, selectedItems, type]);

    const addItem = (item) => {
        onSelectionChange([...selectedItems, item]);
        setSearchTerm(''); setResults([]);
    };
    const removeItem = (itemId) => onSelectionChange(selectedItems.filter(item => item._id !== itemId));

    return (
        <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Assign {type.charAt(0).toUpperCase() + type.slice(1)}</label>
            <div className="p-2 border border-slate-300 rounded-md min-h-[80px] space-y-2">
                <div className="flex flex-wrap gap-2">
                    {selectedItems.map(item => (
                        <div key={item._id} className="bg-emerald-100 text-emerald-800 text-sm font-medium px-2.5 py-1 rounded-full flex items-center gap-2">
                            <span>{item.name}</span>
                            <button type="button" onClick={() => removeItem(item._id)} className="text-emerald-600 hover:text-emerald-900"><X size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={placeholder}
                        className="w-full px-3 py-2 border-t border-slate-200 focus:outline-none" />
                    {results.length > 0 && (
                        <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-48 overflow-y-auto shadow-lg">
                            {results.map(item => (
                                <li key={item._id} onClick={() => addItem(item)} className="px-3 py-2 hover:bg-emerald-50 cursor-pointer text-sm">
                                    {`${item.name} (${item.academicYear})`}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};


function FacultyCourses() {
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filters, setFilters] = useState({ search: '' });
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [courseDetails, setCourseDetails] = useState({ course: null, tasks: [] });
    
    
    const [formData, setFormData] = useState({});
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);

    const fetchCourses = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = {
                page: pagination.page, limit: 6, search: debouncedSearch
            };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/courses/all`, {
                headers: { Authorization: `Bearer ${token}` }, params
            });
            if (response.data.success) {
                setCourses(response.data.data);
                setPagination(response.data.pagination);
            }
        } catch (err) { toast.error("Failed to fetch courses."); }
        finally { setIsLoading(false); }
    }, [pagination.page, debouncedSearch]);

    useEffect(() => {
        document.title = "Faculty | Manage Courses";
        fetchCourses();
    }, [fetchCourses]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setPagination(prev => ({ ...prev, page: 1 }));
    };
    
    const openModal = (type, data = null) => {
        setModalState({ type, data });
        setSelectedPhotoFile(null);
        if (type === 'add') {
            setFormData({
                title: '', courseCode: '', description: '', photo: '', department: '',
                academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
                batches: []
            });
            setPhotoPreview(null);
        } else if (type === 'edit') {
            setFormData({ ...data, batches: data.batches || [] });
            setPhotoPreview(data.photo || null);
        }
    };

    const openDetailsModal = async (courseId) => {
        try {
            const token = Cookies.get('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/courses/details/${courseId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCourseDetails(res.data.data);
            setModalState({ type: 'details', data: res.data.data.course });
        } catch (error) { toast.error("Failed to load course details."); }
    };

    const closeModal = () => {
        setModalState({ type: null, data: null });
        setSelectedPhotoFile(null);
    };

    const handleFormInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleMultiSelectChange = (type, items) => setFormData(prev => ({ ...prev, [type]: items }));
    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) { toast.error("Image must be less than 2MB."); return; }
            setSelectedPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            let photoUrl = formData.photo || null;
            if (selectedPhotoFile) {
                toast.info("Uploading image...");
                photoUrl = await uploadCourseImage(selectedPhotoFile, modalState.data?._id);
            }
            const payload = {
                ...formData, photo: photoUrl,
                batches: formData.batches.map(b => b._id),
            };
            const headers = { Authorization: `Bearer ${token}` };
            if (modalState.type === 'add') {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/faculty/courses/add`, payload, { headers });
                toast.success('Course created successfully!');
            } else if (modalState.type === 'edit') {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/faculty/courses/${modalState.data._id}`, payload, { headers });
                toast.success('Course updated successfully!');
            }
            fetchCourses();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed.');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/faculty/courses/delete/${modalState.data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Course deleted successfully.');
            fetchCourses();
            closeModal();
        } catch (err) { toast.error('Failed to delete course.'); }
        finally { setIsSubmitting(false); }
    };

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Header and Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-slate-800">Course Management</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" name="search" placeholder="Search courses..." value={filters.search}
                                onChange={handleFilterChange} className="w-full pl-10 pr-3 py-2 border rounded-lg" />
                        </div>
                        <button onClick={() => openModal('add')}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700">
                            <PlusCircle size={20} /> Add Course
                        </button>
                    </div>
                </div>

                {/* Course Cards Grid */}
                {isLoading ? <p className="text-center py-10">Loading courses...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {courses.map(course => (
                            <motion.div key={course._id} className="bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col group">
                                <div className="relative">
                                    <img 
                                        src={course.photo || `https://placehold.co/600x400/e2e8f0/475569?text=${encodeURIComponent(course.title)}`} 
                                        alt={course.title} 
                                        className="w-full h-40 object-cover"
                                    />
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openModal('edit', course)} className="bg-white/80 p-1.5 rounded-full text-emerald-600 hover:bg-white"><Edit size={16}/></button>
                                        <button onClick={() => openModal('delete', course)} className="bg-white/80 p-1.5 rounded-full text-red-500 hover:bg-white"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                                <div className="p-5 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-slate-800">{course.title}</h3>
                                    <p className="text-sm font-mono text-slate-500 mb-2">{course.courseCode}</p>
                                    <p className="text-sm text-slate-600 mb-4 flex-grow">{course.description?.substring(0, 100)}...</p>
                                    {course.facultyMetadata !== 'none' && (
                                        <b className="text-sm text-emerald-600 mb-4 border-b border-emerald-100 pb-2">
                                            This course has access for {course.facultyMetadata}
                                        </b>
                                    )}
                                    <div className="mt-auto pt-4 border-t space-y-3">
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase">Batches</h4>
                                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                {course.batches.map(b => (
                                                    <span 
                                                        key={b._id} 
                                                        className="text-xs bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full hover:bg-indigo-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <Users size={12} />
                                                        {b.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => openDetailsModal(course._id)} className="w-full mt-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2">
                                        <Eye size={16}/> View Details
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
                {courses.length === 0 && !isLoading && <p className="text-center p-8 text-slate-500">No courses found for the current filters.</p>}

                {/* Pagination */}
                <div className="flex justify-center items-center mt-8">
                    <div className="flex gap-2">
                        <button onClick={() => setPagination(p => ({...p, page: p.page - 1}))} disabled={pagination.page <= 1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Prev</button>
                        <span className="self-center text-sm">Page {pagination.page} of {pagination.totalPages}</span>
                        <button onClick={() => setPagination(p => ({...p, page: p.page + 1}))} disabled={pagination.page >= pagination.totalPages} className="px-4 py-2 border rounded-lg disabled:opacity-50">Next</button>
                    </div>
                </div>
            </motion.div>

            {/* Details Modal */}
            <Modal isOpen={modalState.type === 'details'} onClose={closeModal} title="Course Details">
                {courseDetails.course && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2">
                            <div className="flex gap-6 mb-6">
                                <div className="w-64 h-40 rounded-lg overflow-hidden bg-slate-100 shadow">
                                    {courseDetails.course.photo ? (
                                        <img
                                            src={courseDetails.course.photo}
                                            alt={courseDetails.course.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <img 
                                            src={`https://placehold.co/600x400/e2e8f0/475569?text=${encodeURIComponent(courseDetails.course.title)}`}
                                            alt={courseDetails.course.title}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold">{courseDetails.course.title}</h3>
                                    <p className="text-slate-500">{courseDetails.course.courseCode}</p>
                                </div>
                            </div>
                            <p className="text-slate-700">{courseDetails.course.description}</p>
                            <h4 className="font-bold mt-6 mb-2">Tasks ({courseDetails.tasks.length})</h4>
                            <ul className="space-y-2 max-h-60 overflow-y-auto p-1">
                                {courseDetails.tasks.length > 0 ? courseDetails.tasks.map(task => (
                                    <li key={task._id} className="flex justify-between p-2 bg-slate-50 rounded">
                                        <span>{task.title}</span>
                                        <span className="text-sm text-red-600">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                    </li>
                                )) : <p className="text-sm text-slate-500">No tasks created yet.</p>}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-2">Enrolled Students</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                {courseDetails.course.batches.flatMap(b => b.students).length > 0 ? courseDetails.course.batches.flatMap(batch => batch.students.map(student => (
                                    <div key={student._id} className="flex items-center gap-3">
                                        <UserAvatar user={student} size="w-8 h-8" />
                                        <div>
                                            <p className="text-sm font-semibold">{student.firstName} {student.lastName}</p>
                                            <p className="text-xs text-slate-500">@{student.username}</p>
                                        </div>
                                    </div>
                                ))) : <p className="text-sm text-slate-500">No students enrolled.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
            
            {/* Add/Edit Course Modal */}
            <Modal isOpen={modalState.type === 'add' || modalState.type === 'edit'} onClose={closeModal} title={modalState.type === 'add' ? 'Create New Course' : 'Edit Course'}>
                <form onSubmit={handleFormSubmit} className="space-y-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Left side: Image Upload */}
                        <div className="lg:w-1/3">
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Course Image</label>
                            <div className="aspect-video w-full bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                {photoPreview ? (
                                    <img src={photoPreview} alt="Course preview" className="w-full h-full object-cover" />
                                ) : (
                                    <ImageIcon className="w-12 h-12 text-slate-400" />
                                )}
                            </div>
                            <label htmlFor="photo-upload" className="w-full mt-2 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-emerald-600 hover:bg-emerald-700">
                                <UploadCloud size={16} /> Choose Image
                            </label>
                            <input id="photo-upload" type="file" className="sr-only" accept="image/png, image/jpeg" onChange={handlePhotoChange} />
                        </div>
                        {/* Right side: Form Fields */}
                        <div className="lg:w-2/3 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField name="title" label="Course Title" value={formData.title || ''} onChange={handleFormInputChange} placeholder="e.g., Intro to AI" />
                                <InputField name="courseCode" label="Course Code" value={formData.courseCode || ''} onChange={handleFormInputChange} placeholder="e.g., AI101" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <InputField name="department" label="Department" value={formData.department || ''} onChange={handleFormInputChange} placeholder="e.g., Computer Science" />
                                <InputField name="academicYear" label="Academic Year" value={formData.academicYear || ''} onChange={handleFormInputChange} placeholder="e.g., 2024-2025" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">Description</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleFormInputChange} rows="3" className="w-full px-3 py-2 border border-slate-300 rounded-md"></textarea>
                    </div>

                    <AssignableMultiSelect 
                        type="batch" 
                        placeholder="Search batches by name..." 
                        selectedItems={formData.batches || []} 
                        onSelectionChange={(items) => setFormData(prev => ({ ...prev, batches: items }))} 
                    />

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={closeModal} className="px-6 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">
                            {isSubmitting ? 'Saving...' : 'Save Course'}
                        </button>
                    </div>
                </form>
            </Modal>
            
            {/* Delete Confirmation Modal */}
            <Modal isOpen={modalState.type === 'delete'} onClose={closeModal} title="Confirm Deletion" size="max-w-md">
                <p className="my-4 text-slate-600">Are you sure you want to permanently delete the course <span className="font-bold">{modalState.data?.title}</span>? This action cannot be undone.</p>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Deleting...' : 'Yes, Delete'}</button>
                </div>
            </Modal>
        </>
    );
}

export default FacultyCourses;