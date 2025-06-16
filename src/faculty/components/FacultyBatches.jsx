import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { PlusCircle, Edit, Trash2, Search, Users, X } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';



function Modal({ isOpen, onClose, title, children, size = 'max-w-2xl' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl shadow-xl w-full ${size} p-6`}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">×</button>
                </div>
                {children}
            </div>
        </div>
    );
}


const StudentMultiSelect = ({ selectedStudents, onSelectionChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedResults, setSelectedResults] = useState([]);
    const debouncedSearch = useDebounce(searchTerm, 500);

    useEffect(() => {
        if (debouncedSearch.length < 2) {
            setResults([]);
            return;
        }
        const searchStudents = async () => {
            setIsLoading(true);
            try {
                const token = Cookies.get('token');
                const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/students/search`, {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { q: debouncedSearch }
                });
                setResults(response.data.data.filter(s => !selectedStudents.some(sel => sel._id === s._id)));
            } catch (error) {
                toast.error("Could not search for students.");
            } finally {
                setIsLoading(false);
            }
        };
        searchStudents();
    }, [debouncedSearch, selectedStudents]);

    const toggleStudentSelection = (student) => {
        setSelectedResults(prev => {
            const isSelected = prev.some(s => s._id === student._id);
            if (isSelected) {
                return prev.filter(s => s._id !== student._id);
            } else {
                return [...prev, student];
            }
        });
    };

    const addSelectedStudents = () => {
        onSelectionChange([...selectedStudents, ...selectedResults]);
        setSearchTerm('');
        setResults([]);
        setSelectedResults([]);
    };

    const removeStudent = (studentId) => {
        onSelectionChange(selectedStudents.filter(s => s._id !== studentId));
    };

    return (
        <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Add Students</label>
            <div className="p-2 border border-slate-300 rounded-md">
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedStudents.map(student => (
                        <div key={student._id} className="bg-emerald-100 text-emerald-800 text-sm font-medium px-2 py-1 rounded-full flex items-center gap-2">
                            {student.firstName} {student.lastName} ({student.username})
                            <button onClick={() => removeStudent(student._id)} className="text-emerald-600 hover:text-emerald-900"><X size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search for students by name, username, or roll..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md"
                    />
                    {isLoading && <p className="text-xs text-slate-500 mt-1">Searching...</p>}
                    {results.length > 0 && (
                        <div className="absolute z-10 w-full bg-white border border-slate-300 rounded-md mt-1 shadow-lg">
                            <ul className="max-h-48 overflow-y-auto">
                                {results.map(student => (
                                    <li key={student._id} 
                                        onClick={() => toggleStudentSelection(student)}
                                        className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                                            selectedResults.some(s => s._id === student._id) 
                                                ? 'bg-emerald-50' 
                                                : 'hover:bg-emerald-50'
                                        }`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedResults.some(s => s._id === student._id)}
                                            onChange={() => {}}
                                            className="h-4 w-4 text-emerald-600 rounded border-gray-300"
                                        />
                                        {student.firstName} {student.lastName} (@{student.username})
                                    </li>
                                ))}
                            </ul>
                            {selectedResults.length > 0 && (
                                <div className="p-2 border-t border-gray-200 bg-gray-50">
                                    <button
                                        onClick={addSelectedStudents}
                                        className="w-full bg-emerald-600 text-white py-1.5 px-3 rounded-md hover:bg-emerald-700 transition-colors text-sm font-medium"
                                    >
                                        Add {selectedResults.length} Selected Student{selectedResults.length !== 1 ? 's' : ''}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


function FacultyBatches() {
    const [batchList, setBatchList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [modalState, setModalState] = useState({ type: null, data: null });
    
    const [formData, setFormData] = useState({ name: '', academicYear: '', department: '', students: [] });
    
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    const fetchBatches = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = { page: pagination.page, limit: 10, search: debouncedSearchTerm };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/batches/all`, {
                headers: { Authorization: `Bearer ${token}` }, params
            });
            if (response.data.success) {
                setBatchList(response.data.data);
                setPagination(response.data.pagination);
            }
        } catch (err) {
            toast.error('Failed to fetch batch data.');
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, debouncedSearchTerm]);

    useEffect(() => {
        document.title = "Faculty | Manage Batches";
        fetchBatches();
    }, [fetchBatches]);

    const handleStudentSelectionChange = (newSelection) => {
        setFormData(prev => ({ ...prev, students: newSelection }));
    };

    const openModal = (type, data = null) => {
        setModalState({ type, data });
        if (type === 'add') {
            setFormData({ name: '', academicYear: new Date().getFullYear().toString(), department: '', students: [] });
        } else if (type === 'edit') {
            setFormData({ name: data.name, academicYear: data.academicYear, department: data.department, students: data.students });
        }
    };

    const closeModal = () => {
        setModalState({ type: null, data: null });
        setFormData({ name: '', academicYear: '', department: '', students: [] });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const token = Cookies.get('token');
        const headers = { Authorization: `Bearer ${token}` };
        const payload = {
            name: formData.name,
            academicYear: formData.academicYear,
            department: formData.department,
            students: formData.students.map(s => s._id),
        };
        try {
            if (modalState.type === 'add') {
                await axios.post(`${import.meta.env.VITE_API_URL}/api/faculty/batches/add`, payload, { headers });
                toast.success('Batch created successfully!');
            } else if (modalState.type === 'edit') {
                await axios.put(`${import.meta.env.VITE_API_URL}/api/faculty/batches/update/${modalState.data._id}`, payload, { headers });
                toast.success('Batch updated successfully!');
            }
            fetchBatches();
            closeModal();
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to ${modalState.type} batch.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        setIsSubmitting(true);
        try {
            const token = Cookies.get('token');
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/faculty/batches/delete/${modalState.data._id}`, { headers: { Authorization: `Bearer ${token}` } });
            toast.success('Batch deleted successfully.');
            fetchBatches();
            closeModal();
        } catch (err) {
            toast.error('Failed to delete batch.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <div className="flex flex-col mb-6">
                <h2 className="text-3xl font-bold text-slate-800">Manage Batches</h2>
                <div className="flex items-center gap-3 w-full sm:w-auto mt-4">
                    <div className="relative w-full sm:w-64">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text" placeholder="Search batches..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <button onClick={() => openModal('add')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700">
                        <PlusCircle size={20} /> Add New
                    </button>
                </div>
            </div>

            {/* Batch Table */}
            <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="border-b-2 border-slate-200">
                            <tr className="text-sm text-slate-600">
                                <th className="p-4">Batch Name</th>
                                <th className="p-4">Academic Year</th>
                                <th className="p-4">Department</th>
                                <th className="p-4">Students</th>
                                <th className="p-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="5" className="text-center p-8">Loading...</td></tr>
                            ) : batchList.map(batch => (
                                <tr key={batch._id} className="border-b border-slate-100 hover:bg-slate-50/70">
                                    <td className="p-4">{batch.name}</td>
                                    <td className="p-4">{batch.academicYear}</td>
                                    <td className="p-4">{batch.department}</td>
                                    <td className="p-4">{batch.students.length}</td>
                                    <td className="p-4">
                                        <button onClick={() => openModal('edit', batch)} className="text-emerald-600 p-2 rounded-full hover:bg-emerald-100">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => openModal('delete', batch)} className="text-red-500 p-2 rounded-full hover:bg-red-100 ml-2">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {batchList.length === 0 && !isLoading && <p className="text-center p-8 text-slate-500">No batches found.</p>}
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={modalState.type === 'add' || modalState.type === 'edit'} onClose={closeModal} title={modalState.type === 'add' ? 'Create New Batch' : 'Edit Batch'}>
                <form onSubmit={handleFormSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md">
                            <label htmlFor="name" className="text-sm font-medium">Batch Name</label>
                            <input id="name" name="name" type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g., Section A" required className="w-full px-3 py-2 border border-slate-300 rounded-md" />
                        </div>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md">
                            <label htmlFor="academicYear" className="text-sm font-medium">Academic Year</label>
                            <input id="academicYear" name="academicYear" type="text" value={formData.academicYear || ''} onChange={(e) => setFormData({...formData, academicYear: e.target.value})} placeholder="e.g., 2024-2025" required className="w-full px-3 py-2 border border-slate-300 rounded-md" />
                        </div>
                        <div className="w-full px-3 py-2 border border-slate-300 rounded-md">
                            <label htmlFor="department" className="text-sm font-medium">Department</label>
                            <input id="department" name="department" type="text" value={formData.department || ''} onChange={(e) => setFormData({...formData, department: e.target.value})} placeholder="e.g., Computer Science" required className="w-full px-3 py-2 border border-slate-300 rounded-md" />
                        </div>
                    </div>
                    <StudentMultiSelect selectedStudents={formData.students || []} onSelectionChange={handleStudentSelectionChange} />
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-emerald-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Save Batch'}</button>
                    </div>
                </form>
            </Modal>
            
            {/* Delete Modal */}
            <Modal isOpen={modalState.type === 'delete'} onClose={closeModal} title="Confirm Deletion" size="max-w-md">
                <p className="my-4 text-slate-600">Are you sure you want to permanently delete the batch <span className="font-bold">{modalState.data?.name}</span>? This action cannot be undone.</p>
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={closeModal} className="px-4 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={handleDelete} disabled={isSubmitting} className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50">{isSubmitting ? 'Deleting...' : 'Yes, Delete'}</button>
                </div>
            </Modal>
        </>
    );
}

export default FacultyBatches;