import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Download, Eye, File, ArrowRight } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useDebounce } from '../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';

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

const TaskStatusBadge = ({ status }) => {
    const styles = {
        Active: 'bg-green-100 text-green-800',
        Upcoming: 'bg-blue-100 text-blue-800',
        Completed: 'bg-gray-200 text-gray-800'
    };
    return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status]}`}>{status}</span>;
};

function StudentTasks() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState({ search: '' });
    const debouncedSearch = useDebounce(filters.search, 500);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [modalState, setModalState] = useState({ type: null, data: null });
    const [taskDetails, setTaskDetails] = useState({ task: null });

    const fetchTasks = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = { page: pagination.page, limit: 9, search: debouncedSearch };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/tasks/all`, {
                headers: { Authorization: `Bearer ${token}` }, params
            });
            if (response.data.success) {
                setTasks(response.data.data);
                setPagination(response.data.pagination);
            } else {
                toast.error("Failed to fetch tasks: " + response.data.message);
            }
        } catch (error) {
            console.error("Error fetching tasks: ", error);
            toast.error("Failed to fetch tasks.");
        } finally {
            setIsLoading(false);
        }
    }, [pagination.page, debouncedSearch]);

    useEffect(() => {
        document.title = "Student | View Tasks";
        fetchTasks();
    }, [fetchTasks]);

    const openDetailsModal = async (taskId) => {
        try {
            const token = Cookies.get('token');
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/student/tasks/details/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTaskDetails(res.data.data);
            setModalState({ type: 'details', data: res.data.data.task });
        } catch (error) {
            console.error("Error loading task details: ", error);
            toast.error("Failed to load task details.");
        }
    };

    const closeModal = () => {
        setModalState({ type: null, data: null });
    };

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h2 className="text-3xl font-bold text-slate-800">View Tasks</h2>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="text" placeholder="Search tasks..." value={filters.search}
                                onChange={(e) => setFilters({ search: e.target.value })} className="w-full pl-10 pr-3 py-2 border rounded-lg" />
                        </div>
                    </div>
                </div>

                {isLoading ? <p className="text-center py-10">Loading tasks...</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tasks.map(task => (
                            <motion.div key={task._id} className="bg-white rounded-xl shadow-lg border overflow-hidden flex flex-col group">
                                <div className="relative">
                                    <img src={task.photo || `https://placehold.co/600x400/e2e8f0/475569?text=${task.type}`} alt={task.title} className="w-full h-40 object-cover"/>
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
                                            <button onClick={() => openDetailsModal(task._id)} className="text-sm font-semibold text-blue-600 hover:underline">View Details</button>
                                            {!task.grade?.submission || task.grade?.status === 'pending' ? (
                                                <button 
                                                    onClick={() => navigate(`/student/tasks/${task._id}`)} 
                                                    className="p-3 py-2 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 flex items-center justify-center gap-2 text-sm"
                                                >
                                                    Submit Task
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => navigate(`/student/tasks/${task._id}`)} 
                                                    className="p-3 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 flex items-center justify-center gap-2 text-sm"
                                                >
                                                    View Task Details
                                                </button>
                                            )}
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
                {taskDetails?.task ? (
                    <div className="space-y-6">
                        {/* Hero Section */}
                        <div className="relative -m-6 mb-6">
                            <div className="w-full h-64 rounded-t-2xl overflow-hidden bg-slate-200">
                                <img 
                                    src={taskDetails.task.photo || `https://placehold.co/800x400/e2e8f0/475569?text=${taskDetails.task.type}`} 
                                    alt={taskDetails.task.title} 
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                <div className="absolute bottom-0 left-0 p-6">
                                    <h2 className="text-2xl font-bold text-white mb-2">{taskDetails.task.title}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm text-white">
                                            {taskDetails.submissionStatus}
                                        </span>
                                        {taskDetails.submissionStatus === "Not Submitted" ? (
                                            <button 
                                                onClick={() => navigate(`/student/tasks/${taskDetails.task._id}`)}
                                                className="px-4 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                                            >
                                                Submit Task
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => navigate(`/student/tasks/${taskDetails.task._id}`)}
                                                className="px-4 py-1 bg-blue-500 text-white rounded-full text-sm hover:bg-blue-600 transition-colors"
                                            >
                                                Edit Submission
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="prose max-w-none">
                            <h3 className="text-lg font-semibold text-slate-800 mb-2">Description</h3>
                            <p className="text-slate-600">{taskDetails.task.description || 'No description provided.'}</p>
                        </div>

                        {/* Attachments Section */}
                        {taskDetails.task.attachments?.length > 0 && (
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800 mb-3">Task Attachments</h3>
                                <div className="space-y-2">
                                    {taskDetails.task.attachments.map((attachment, index) => (
                                        <a 
                                            key={index}
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <File className="text-slate-500" />
                                                <span className="text-slate-700">{attachment.fileName || 'Unnamed File'}</span>
                                            </div>
                                            <Download className="text-slate-500 hover:text-slate-700" size={18} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submission Status */}
                        {taskDetails.submissionStatus !== "Not Submitted" && taskDetails.grade?.submission && (
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="text-lg font-semibold text-blue-800 mb-2">Your Submission</h3>
                                <div className="space-y-3">
                                    <p className="text-blue-700">
                                        Submitted on: {taskDetails.grade.submission.createdAt ? 
                                            new Date(taskDetails.grade.submission.createdAt).toLocaleDateString() : 
                                            'Date not available'}
                                    </p>
                                    {taskDetails.grade.submission.attachments?.length > 0 && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-blue-800 mb-2">Your Attachments</h4>
                                            <div className="space-y-2">
                                                {taskDetails.grade.submission.attachments.map((attachment, index) => (
                                                    <a 
                                                        key={index}
                                                        href={attachment.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-3 bg-blue-100/50 rounded-lg hover:bg-blue-100 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <File className="text-blue-600" />
                                                            <span className="text-blue-700">{attachment.fileName || 'Unnamed File'}</span>
                                                        </div>
                                                        <Download className="text-blue-600 hover:text-blue-700" size={18} />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Task Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-600 mb-1">Publish Date</h3>
                                <p className="text-slate-800">
                                    {new Date(taskDetails.task.publishDate).toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-600 mb-1">Due Date</h3>
                                <p className="text-slate-800">
                                    {new Date(taskDetails.task.dueDate).toLocaleDateString('en-GB', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="flex justify-end mt-6">
                            <button
                                onClick={() => navigate(`/student/tasks/${taskDetails.task._id}`)}
                                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                            >
                                {taskDetails.submissionStatus === "Not Submitted" ? "Submit Task" : "Edit Submission"}
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-8 text-slate-500">
                        <p>Task details not available.</p>
                    </div>
                )}
            </Modal>
        </>
    );
}

export default StudentTasks;
