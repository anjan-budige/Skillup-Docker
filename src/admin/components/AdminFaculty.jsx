import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, ArrowUp, ArrowDown } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';

// --- Reusable Components (Keep these as they are) ---

function Modal({ isOpen, onClose, title, children, size = 'max-w-lg' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-2xl shadow-xl w-full ${size} p-6`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">×</button>
                </div>
                {children}
            </motion.div>
        </div>
    );
}

const InputField = ({ name, label, type, value, onChange, placeholder }) => (
    <div>
        <label htmlFor={name} className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} required
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
);

const UserAvatar = ({ user }) => (
    user.photo ? (
        <img src={user.photo} alt={user.firstName} className="w-10 h-10 rounded-full object-cover" />
    ) : (
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
        </div>
    )
);

// --- Main Component ---

function AdminFaculty() {
    const [facultyList, setFacultyList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    const fetchFaculty = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = {
                page: pagination.page,
                limit: 10,
                search: debouncedSearchTerm,
                sortBy: sortConfig.key,
                sortOrder: sortConfig.direction,
            };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/faculty/all`, {
                headers: { Authorization: `Bearer ${token}` },
                params,
            });
            if (response.data.success) {
                setFacultyList(response.data.data);
                setPagination(prev => ({ ...prev, ...response.data.pagination }));
            }
        } catch (err) {
            toast.error('Failed to fetch faculty data.');
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, debouncedSearchTerm, sortConfig]);

    useEffect(() => {
        document.title = "Admin | Manage Faculty";
        fetchFaculty();
    }, [fetchFaculty]);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const openModal = (type, data = null) => {
        setModalState({ type, data });
        if (type === 'add') setFormData({ firstName: '', lastName: '', email: '', username: '', password: '', department: '' });
        else if (type === 'edit') setFormData(data);
    };

    const closeModal = () => {
        setModalState({ type: null, data: null });
        setFormData({});
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = Cookies.get('token');
        const headers = { Authorization: `Bearer ${token}` };
        try {
            if (modalState.type === 'add') {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/faculty/add`, formData, { headers });
                toast.success('Faculty added successfully!');
            } else if (modalState.type === 'edit') {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/admin/faculty/update/${modalState.data._id}`, formData, { headers });
                toast.success('Faculty updated successfully!');
            }
            fetchFaculty();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to ${modalState.type} faculty.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/admin/faculty/delete/${modalState.data._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Faculty deleted successfully.');
            fetchFaculty();
            closeModal();
        } catch (err) {
            toast.error('Failed to delete faculty.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSort = (key) => {
        const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key, direction });
    };

    const SortableHeader = ({ tkey, label }) => (
        <th className="p-4 cursor-pointer" onClick={() => handleSort(tkey)}>
            <div className="flex items-center gap-2">
                {label}
                {sortConfig.key === tkey && (sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
            </div>
        </th>
    );

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-slate-800">Manage Faculty</h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search faculty..." value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg" />
                        </div>
                        <button onClick={() => openModal('add')}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition-colors shrink-0">
                            <PlusCircle size={20} /> Add New
                        </button>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200/70">
                    {/* Mobile Card View */}
                    <div className="sm:hidden space-y-4">
                        {isLoading ? (
                            <div className="text-center p-8">Loading...</div>
                        ) : facultyList.map(faculty => (
                            <div key={faculty._id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                                <div className="flex items-center gap-3 mb-3">
                                    <UserAvatar user={faculty} />
                                    <div>
                                        <p className="font-bold text-slate-800">{faculty.firstName} {faculty.lastName}</p>
                                        <p className="text-sm text-slate-500">{faculty.email || `@${faculty.username}`}</p>
                                    </div>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-600">Department:</span>
                                        <span className="text-slate-800">{faculty.department}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600 block mb-1">Courses:</span>
                                        <div className="flex flex-wrap gap-1">
                                            {faculty.courses && faculty.courses.length > 0 ? (
                                                faculty.courses.map((course, index) => (
                                                    <span 
                                                        key={`${faculty._id}-course-${index}`} 
                                                        className="text-xs bg-sky-100 text-sky-800 px-2 py-1 rounded-full font-medium"
                                                    >
                                                        {course}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-slate-400">Not Assigned</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
                                    <button onClick={() => openModal('edit', faculty)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100">
                                        <Edit size={18} />
                                    </button>
                                    <button onClick={() => openModal('delete', faculty)} className="text-red-500 p-2 rounded-full hover:bg-red-100">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-slate-200">
                                <tr className="text-sm text-slate-600">
                                    <SortableHeader tkey="firstName" label="Name" />
                                    <SortableHeader tkey="department" label="Department" />
                                    <th className="p-4">Assigned Courses</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="4" className="text-center p-8">Loading...</td></tr>
                                ) : facultyList.map(faculty => (
                                    <tr key={faculty._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                        <td className="p-4 flex items-center gap-4">
                                            <UserAvatar user={faculty} />
                                            <div>
                                                <p className="font-bold text-slate-800">{faculty.firstName} {faculty.lastName}</p>
                                                <p className="text-sm text-slate-500">{faculty.email || `@${faculty.username}`}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-700">{faculty.department}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {faculty.courses?.length > 0 ? faculty.courses.map(course => (
                                                    <span key={course} className="text-xs bg-sky-100 text-sky-800 px-2 py-1 rounded-full font-medium">{course}</span>
                                                )) : <span className="text-xs text-slate-400">Not Assigned</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => openModal('edit', faculty)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100">
                                                <Edit size={18} />
                                            </button>
                                            <button onClick={() => openModal('delete', faculty)} className="text-red-500 p-2 rounded-full hover:bg-red-100 ml-2">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {facultyList.length === 0 && !isLoading && (
                        <p className="text-center p-8 text-slate-500">No faculty members found for the current search.</p>
                    )}

                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                        <p className="text-sm text-slate-600 font-medium text-center sm:text-left">
                            Showing page {Math.round(pagination.page)} of {Math.round(pagination.totalPages)} • {Math.round(pagination.total)} total entries
                        </p>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <button 
                                onClick={() => setPagination(p => ({...p, page: p.page - 1}))} 
                                disabled={pagination.page <= 1} 
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setPagination(p => ({...p, page: p.page + 1}))} 
                                disabled={pagination.page >= pagination.totalPages} 
                                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <Modal isOpen={modalState.type === 'add' || modalState.type === 'edit'} onClose={closeModal} title={modalState.type === 'add' ? 'Add New Faculty' : 'Edit Faculty'}>
                <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField name="firstName" label="First Name" type="text" value={formData.firstName || ''} onChange={handleInputChange} />
                        <InputField name="lastName" label="Last Name" type="text" value={formData.lastName || ''} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField name="email" label="Email Address" type="email" value={formData.email || ''} onChange={handleInputChange} />
                        <InputField name="username" label="Username" type="text" value={formData.username || ''} onChange={handleInputChange} />
                    </div>
                    <InputField name="department" label="Department" type="text" value={formData.department || ''} onChange={handleInputChange} />
                    {modalState.type === 'add' && <InputField name="password" label="Password" type="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Min. 6 characters"/>}
                    <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                        <button type="button" onClick={closeModal} className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors text-base">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 transition-colors text-base">
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={modalState.type === 'delete'} onClose={closeModal} title="Confirm Deletion" size="max-w-md">
                <p className="my-4 text-slate-600">
                    Are you sure you want to <span className="font-bold text-red-600">permanently delete</span> {modalState.data?.firstName} {modalState.data?.lastName}? This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">
                        {isSubmitting ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                </div>
            </Modal>
        </>
    );
}

export default AdminFaculty;