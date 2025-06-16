import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle, XCircle, Clock, Edit, Download, AlertTriangle, Eye, Save, Calendar, Star, BookOpen } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// --- Reusable Components ---

function Modal({ isOpen, onClose, title, children, size = 'max-w-2xl' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-2xl shadow-xl w-full ${size} m-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">×</button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
            </motion.div>
        </div>
    );
}

const UserAvatar = ({ user, size = 'w-10 h-10' }) => (
    user?.photo ?
        <img src={user.photo} alt={user.firstName || 'User'} className={`${size} rounded-full object-cover`} />
        :
        <div className={`${size} rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold`}>
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </div>
);

const SubmissionStatus = ({ submission }) => {
    if (!submission) return <span className="flex items-center gap-1.5 text-xs font-medium text-red-600"><XCircle size={14} /> Not Submitted</span>;
    if (submission.status === 'Graded') return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle size={14} /> Graded</span>;
    if (submission.status === 'On-Time') return <span className="flex items-center gap-1.5 text-xs font-medium text-green-700"><CheckCircle size={14} /> Submitted</span>;
    if (submission.status === 'Late') return <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><AlertTriangle size={14} /> Submitted (Late)</span>;
    return <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Clock size={14} /> Pending</span>;
};

// --- Main Grading Interface Component ---
function FacultyTaskSubmissions() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [grades, setGrades] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editableRow, setEditableRow] = useState(null);
    const [previewModal, setPreviewModal] = useState({ isOpen: false, submission: null });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/${taskId}/grades`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success) {
                setTask(response.data.task);
                setGrades(response.data.grades.map(g => ({ ...g, isDirty: false })));
            }
        } catch (error) {
            toast.error("Failed to fetch grading data.");
            navigate('/faculty/tasks'); // Navigate away if task doesn't exist
        } finally {
            setIsLoading(false);
        }
    }, [taskId, navigate]);

    useEffect(() => {
        document.title = "Faculty | Grade Task";
        fetchData();
    }, [fetchData]);

    const handleGradeChange = (gradeId, value) => {
        const numericValue = value === '' ? '' : Number(value);
        if (numericValue > task.maxPoints) {
            toast.warn(`Grade cannot exceed ${task.maxPoints} points.`);
            return;
        }
        if (numericValue < 0) {
            toast.warn("Grade cannot be negative.");
            return;
        }
        setGrades(prev => prev.map(g => 
            g._id === gradeId ? { ...g, grade: numericValue, isDirty: true } : g
        ));
    };

    const handleFeedbackChange = (gradeId, value) => {
        setGrades(prev => prev.map(g => 
            g._id === gradeId ? { ...g, feedback: value, isDirty: true } : g
        ));
    };

    const handleSaveChanges = async () => {
        setIsSubmitting(true);
        const changedGrades = grades
            .filter(g => g.isDirty)
            .map(g => ({
                gradeId: g._id,
                grade: g.grade === '' ? null : Number(g.grade), 
                feedback: g.feedback
            }));

        if (changedGrades.length === 0) {
            toast.info("No changes to save.");
            setIsSubmitting(false);
            return;
        }

        const saveToastId = toast.loading("Saving grades...");
        try {
            const token = Cookies.get('token');
            await axios.post(`${import.meta.env.VITE_API_URL}/api/faculty/tasks/${taskId}/grade`, 
                { grades: changedGrades },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.update(saveToastId, { render: "Grades saved successfully!", type: "success", isLoading: false, autoClose: 3000 });
            fetchData();
            setEditableRow(null);
        } catch (error) {
            toast.update(saveToastId, { render: "Failed to save grades.", type: "error", isLoading: false, autoClose: 5000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;
    if (!task) return <div className="text-center p-10 text-red-600">Task not found.</div>;

    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <button onClick={() => navigate('/faculty/tasks')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 font-medium">
                    <ArrowLeft size={18} /> Back to All Tasks
                </button>

                {/* --- NEW HERO SECTION --- */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/70 p-6 mb-8">
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/3 lg:w-1/4">
                            <img 
                                src={task.photo || `https://placehold.co/600x400/e2e8f0/475569?text=${task.type}`} 
                                alt={task.title} 
                                className="w-full h-48 object-cover rounded-xl"
                            />
                        </div>
                        <div className="flex-1">
                            <span className="text-sm font-bold text-indigo-600 uppercase">{task.type}</span>
                            <h2 className="text-3xl font-bold text-slate-800 mt-1">{task.title}</h2>
                            <p className="text-slate-500 mt-1">
                                For course: <span className="font-semibold text-slate-600">{task.course.title}</span>
                            </p>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} className="text-slate-400"/>
                                    <div>
                                        <p className="text-xs text-slate-500">Due Date</p>
                                        <p className="font-semibold">{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                                    
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Star size={18} className="text-slate-400"/>
                                    <div>
                                        <p className="text-xs text-slate-500">Max Points</p>
                                        <p className="font-semibold">{task.maxPoints}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BookOpen size={18} className="text-slate-400"/>
                                    <div>
                                        <p className="text-xs text-slate-500">Submissions</p>
                                        <p className="font-semibold">{grades.filter(g => g.submission).length} / {grades.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grading Table */}
                <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200/70">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Student Submissions</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b-2 border-slate-200">
                                <tr className="text-sm text-slate-600">
                                    <th className="p-4 w-2/5">Student</th>
                                    <th className="p-4">Submission</th>
                                    <th className="p-4">Grade</th>
                                    <th className="p-4 w-1/3">Feedback</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grades.map(grade => {
                                    // Add null check for grade.student
                                    if (!grade?.student) return null;
                                    
                                    const isEditing = editableRow === grade.student._id;
                                    return (
                                        <tr key={grade._id} className="border-b border-slate-100 last:border-b-0">
                                            <td className="p-4 flex items-center gap-4">
                                                <UserAvatar user={grade.student} />
                                                <div>
                                                    <p className="font-semibold text-slate-800">{grade.student.firstName} {grade.student.lastName}</p>
                                                    <p className="text-xs text-slate-500">{grade.student.email}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <SubmissionStatus submission={grade.submission} />
                                                {grade.submission && (
                                                    <button onClick={() => setPreviewModal({ isOpen: true, submission: grade.submission })}
                                                        className="mt-1 text-xs text-emerald-600 hover:underline flex items-center gap-1">
                                                        <Eye size={12}/> View Submission
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1">
                                                        <input type="number" min="0" value={grade.grade || ''}
                                                            onChange={(e) => handleGradeChange(grade._id, e.target.value)}
                                                            className="w-20 px-2 py-1 border rounded-md" />
                                                        <span>/ {task.maxPoints}</span>
                                                    </div>
                                                ) : (
                                                    <span className={`font-bold ${grade.status === 'Graded' ? 'text-slate-800' : 'text-slate-400'}`}>
                                                        {grade.grade ?? '—'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {isEditing ? (
                                                    <textarea value={grade.feedback || ''}
                                                        onChange={(e) => handleFeedbackChange(grade._id, e.target.value)}
                                                        className="w-full p-2 border rounded-md text-sm" rows="2" />
                                                ) : (
                                                    <p className="text-sm text-slate-600 truncate">{grade.feedback || '—'}</p>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => setEditableRow(isEditing ? null : grade.student._id)} 
                                                    className={`p-2 rounded-full transition-colors ${isEditing ? 'bg-green-100 text-green-700' : 'text-emerald-600 hover:bg-emerald-100'}`}>
                                                    {isEditing ? <CheckCircle size={16} /> : <Edit size={16} />}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-end mt-6">
                        <button onClick={handleSaveChanges} disabled={isSubmitting}
                            className="px-6 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                            {isSubmitting ? 'Saving...' : <><Save size={16}/> Save All Changes</>}
                        </button>
                    </div>
                </div>
            </motion.div>

            <Modal isOpen={previewModal.isOpen} onClose={() => setPreviewModal({ isOpen: false, submission: null })} title="View Submission" size="max-w-3xl">
                {previewModal.submission && (
                    <div className="space-y-6">
                        {/* Submission Status and Timestamp */}
                        <div className="flex items-center justify-between text-sm">
                            <span className={`px-3 py-1 rounded-full ${previewModal.submission.status === 'On-Time' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                {previewModal.submission.status}
                            </span>
                            <span className="text-slate-500">
                                {previewModal.submission.createdAt === previewModal.submission.updatedAt ? (
                                    `Submitted on ${new Date(previewModal.submission.createdAt).toLocaleString('en-US', { 
                                        day: 'numeric', 
                                        month: 'long', 
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: 'numeric',
                                        hour12: true 
                                    })}`
                                ) : (
                                    <>
                                        Submitted on {new Date(previewModal.submission.createdAt).toLocaleString()}
                                        <br />
                                        Updated on {new Date(previewModal.submission.updatedAt).toLocaleString()}
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Text Content Section */}
                        {previewModal.submission.content && (
                            <div>
                                <h4 className="font-bold mb-3 text-slate-800">Text Submission</h4>
                                <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="whitespace-pre-wrap">{previewModal.submission.content}</p>
                                </div>
                            </div>
                        )}

                        {/* Attachments Section */}
                        <div>
                            <h4 className="font-bold mb-3 text-slate-800">Attachments</h4>
                            {previewModal.submission.attachments?.length > 0 ? (
                                <ul className="space-y-4">
                                    {previewModal.submission.attachments.map(file => {
                                        const isImage = file.fileType?.startsWith('image/');
                                        const isPDF = file.fileType === 'application/pdf';
                                        return (
                                            <li key={file.fileName} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="font-semibold text-sm text-slate-800">{file.fileName}</p>
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            Uploaded on {new Date(file.uploadedAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <a href={file.url} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors">
                                                        <Download size={16} /> Download
                                                    </a>
                                                </div>
                                                {isImage && (
                                                    <div className="mt-3">
                                                        <img src={file.url} alt={file.fileName} 
                                                            className="max-w-full h-auto rounded-md border border-slate-200" />
                                                    </div>
                                                )}
                                                {isPDF && (
                                                    <div className="mt-3 h-[600px]">
                                                        <iframe 
                                                            src={file.url}
                                                            className="w-full h-full rounded-md border border-slate-200"
                                                            title={file.fileName}
                                                        />
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500 italic">No attachments were submitted.</p>
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}

export default FacultyTaskSubmissions;