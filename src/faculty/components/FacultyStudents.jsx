import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, ArrowUp, ArrowDown, X } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';

function Modal({ isOpen, onClose, title, children, size = 'max-w-2xl' }) {
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

const InputField = ({ name, label, type, value, onChange, placeholder, required = true }) => (
    <div>
        <label htmlFor={name} className="text-sm font-medium text-slate-700 mb-1 block">{label}</label>
        <input id={name} name={name} type={type} value={value || ''} onChange={onChange} placeholder={placeholder} required={required}
            className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
    </div>
);

const UserAvatar = ({ user }) => (
    user.photo ? (
        <img src={user.photo} alt={user.firstName} className="w-10 h-10 rounded-full object-cover" />
    ) : (
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
            {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
        </div>
    )
);


function FacultyStudents() {
    const [studentList, setStudentList] = useState([]);
    const [batchList, setBatchList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [formData, setFormData] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const headers = { Authorization: `Bearer ${token}` };
            
            const [studentRes, batchRes] = await Promise.all([
                axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/students`, {
                    headers, params: {
                        page: pagination.page, limit: 10, search: debouncedSearchTerm,
                        sortBy: sortConfig.key, sortOrder: sortConfig.direction,
                    }
                }),
                axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/my-batches`, { headers })
            ]);
            
            if (studentRes.data.success) {
                setStudentList(studentRes.data.data);
                setPagination(prev => ({ ...prev, ...studentRes.data.pagination }));
            }
            if (batchRes.data.success) {
                setBatchList(batchRes.data.data);
            }
        } catch (err) {
            toast.error('Failed to fetch student or batch data.');
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, debouncedSearchTerm, sortConfig]);

    useEffect(() => {
        document.title = "Faculty | Manage Students";
        fetchData();
    }, [fetchData]);

    const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const openModal = (type, data = null) => {
        setModalState({ type, data });
        if (type === 'add') {
            setFormData({ firstName: '', lastName: '', email: '', username: '', password: '', department: '', rollNumber: '', semester: '', batches: [] });
        } else if (type === 'edit') {
            setFormData({ ...data, batches: data.batches?.map(b => b._id) || [] });
        }
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
                await axios.post(`${import.meta.env.VITE_API_URL}/api/faculty/students`, formData, { headers });
                toast.success('Student added successfully!');
            } else if (modalState.type === 'edit') {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/faculty/students/${modalState.data._id}`, formData, { headers });
                toast.success('Student updated successfully!');
            }
            fetchData();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to ${modalState.type} student.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/faculty/students/${modalState.data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Student permanently deleted.');
            fetchData();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete student.');
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
                    <h2 className="text-3xl font-bold text-slate-800">Manage Students</h2>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search all students..." value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg" />
                        </div>
                        <button onClick={() => openModal('add')}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700 shrink-0">
                            <PlusCircle size={20} /> Add Student
                        </button>
                    </div>
                </div>

                <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-slate-200">
                                <tr className="text-sm text-slate-600">
                                    <SortableHeader tkey="firstName" label="Name" />
                                    <SortableHeader tkey="rollNumber" label="Roll Number" />
                                    <SortableHeader tkey="department" label="Department" />
                                    <th className="p-4">My Courses</th>
                                    <th className="p-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan="5" className="text-center p-8">Loading students...</td></tr>
                                ) : studentList.map(student => (
                                    <tr key={student._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                        <td className="p-4 flex items-center gap-4">
                                            <UserAvatar user={student} />
                                            <div>
                                                <p className="font-bold text-slate-800">{student.firstName} {student.lastName}</p>
                                                <p className="text-sm text-slate-500">{student.email}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-700 font-mono">{student.rollNumber}</td>
                                        <td className="p-4 text-slate-700">{student.department}</td>
                                        <td className="p-4">
                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                {student.courses?.length > 0 ? student.courses.map(course => (
                                                    <span key={course} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-medium">{course}</span>
                                                )) : <span className="text-xs text-slate-400">Not in your courses</span>}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <button onClick={() => openModal('edit', student)} className="text-blue-600 p-2 rounded-full hover:bg-blue-100"><Edit size={18} /></button>
                                            <button onClick={() => openModal('delete', student)} className="text-red-500 p-2 rounded-full hover:bg-red-100 ml-2"><Trash2 size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {studentList.length === 0 && !isLoading && <p className="text-center p-8 text-slate-500">No students found.</p>}
                    </div>
                    <div className="flex justify-between items-center mt-6">
                         <p className="text-sm text-slate-600 font-medium">Page {pagination.page} of {pagination.totalPages} (Total: {pagination.total})</p>
                        <div className="flex gap-3">
                            <button onClick={() => setPagination(p => ({...p, page: p.page - 1}))} disabled={pagination.page <= 1} className="px-4 py-2 text-sm font-medium border rounded-lg disabled:opacity-50">Previous</button>
                            <button onClick={() => setPagination(p => ({...p, page: p.page + 1}))} disabled={pagination.page >= pagination.totalPages} className="px-4 py-2 text-sm font-medium border rounded-lg disabled:opacity-50">Next</button>
                        </div>
                    </div>
                </div>
            </motion.div>

            <Modal isOpen={modalState.type === 'add' || modalState.type === 'edit'} onClose={closeModal} title={modalState.type === 'add' ? 'Add New Student' : 'Edit Student'}>
                <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="firstName" label="First Name" value={formData.firstName || ''} onChange={handleInputChange} />
                        <InputField name="lastName" label="Last Name" value={formData.lastName || ''} onChange={handleInputChange} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="email" label="Email Address" type="email" value={formData.email || ''} onChange={handleInputChange} />
                        <InputField name="username" label="Username" type="text" value={formData.username || ''} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="department" label="Department" type="text" value={formData.department || ''} onChange={handleInputChange} />
                        <InputField name="rollNumber" label="Roll Number" type="text" value={formData.rollNumber || ''} onChange={handleInputChange} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField name="semester" label="Semester" type="number" value={formData.semester || ''} onChange={handleInputChange} required={false} />
                    </div>
                    {modalState.type === 'add' && <InputField name="password" label="Password" type="password" value={formData.password || ''} onChange={handleInputChange} placeholder="Min. 6 characters"/>}
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
                    </div>
                </form>
            </Modal>
            
            <Modal isOpen={modalState.type === 'delete'} onClose={closeModal} title="Confirm Deletion" size="max-w-md">
                <p className="my-4 text-slate-600">Are you sure you want to permanently delete <span className="font-bold">{modalState.data?.firstName} {modalState.data?.lastName}</span>? This cannot be undone.</p>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Deleting...' : 'Yes, Delete'}</button>
                </div>
            </Modal>
        </>
    );
}

export default FacultyStudents;