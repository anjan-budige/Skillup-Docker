import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, Users, Eye, UploadCloud, Image as ImageIcon, X } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';

// --- Reusable Components (same as AdminCourses) ---

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
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/search-batches`, {
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

// --- Main Component ---
function StudentCourses() {
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [filters, setFilters] = useState({ search: '' });
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [courseDetails, setCourseDetails] = useState({ course: null, tasks: [] });
    
    // Form State
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
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/courses/all`, {
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
        document.title = "Student | Manage Courses";
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
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/courses/details/${courseId}`, {
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

    


    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                {/* Header and Controls */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-slate-800">My Courses</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" name="search" placeholder="Search courses..." value={filters.search}
                                onChange={handleFilterChange} className="w-full pl-10 pr-3 py-2 border rounded-lg" />
                        </div>
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
                                </div>
                                <div className="p-5 flex flex-col flex-grow">
                                    <h3 className="text-lg font-bold text-slate-800">{course.title}</h3>
                                    <p className="text-sm font-mono text-slate-500 mb-2">{course.courseCode}</p>
                                    <p className="text-sm text-slate-600 mb-4 flex-grow">{course.description?.substring(0, 100)}...</p>
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
                                    <p className="text-sm text-slate-600 mt-1">Department: {courseDetails.course.department}</p>
                                </div>
                            </div>
                            <p className="text-slate-700">{courseDetails.course.description}</p>
                            
                            <h4 className="font-bold mt-6 mb-2">Tasks ({courseDetails.tasks.length})</h4>
                            <ul className="space-y-2 max-h-60 overflow-y-auto p-1">
                                {courseDetails.tasks.length > 0 ? courseDetails.tasks.map(task => (
                                    <li key={task._id} className="flex justify-between p-2 bg-slate-50 rounded">
                                        <div>
                                            <span className="font-medium">{task.title}</span>
                                            <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                                                new Date() > new Date(task.dueDate) ? 'bg-green-100 text-green-800' : 
                                                new Date() >= new Date(task.publishDate) ? 'bg-purple-100 text-purple-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                                {new Date() > new Date(task.dueDate) ? 'Over' : 
                                                 new Date() >= new Date(task.publishDate) ? 'Active' :
                                                 'Upcoming'}
                                            </span>
                                        </div>
                                        <span className="text-sm text-red-600">Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                    </li>
                                )) : <p className="text-sm text-slate-500">No tasks created yet.</p>}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-bold mb-2">Faculty</h4>
                            <div className="space-y-2 mb-6">
                                {courseDetails.course.faculty.map(faculty => (
                                    <div key={faculty._id} className="flex items-center gap-3">
                                        <UserAvatar user={faculty} size="w-8 h-8" />
                                        <div>
                                            <p className="text-sm font-semibold">{faculty.firstName} {faculty.lastName}</p>
                                            <p className="text-xs text-slate-500">Faculty</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <h4 className="font-bold mb-2">Enrolled Batches</h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                {courseDetails.course.batches.length > 0 ? courseDetails.course.batches.map(batch => (
                                    <div key={batch._id} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                        <Users size={16} className="text-slate-500" />
                                        <div>
                                            <p className="text-sm font-semibold">{batch.name}</p>
                                        </div>
                                    </div>
                                )) : <p className="text-sm text-slate-500">No batches enrolled.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

export default StudentCourses;