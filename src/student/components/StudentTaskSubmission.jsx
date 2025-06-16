import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Star, Clock, Paperclip, UploadCloud, X, Download, Save, Edit, Award, File } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { uploadAttachment } from '../../utils/uploadAttachment';

// --- Reusable Components ---
const InfoCard = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50/70 rounded-lg">
        <Icon size={20} className="text-slate-400 flex-shrink-0" />
        <div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className="font-semibold text-slate-700">{value}</p>
        </div>
    </div>
);

const FileAttachment = ({ file, onRemove, isEditing }) => (
    <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg group">
        <Paperclip size={18} className="text-slate-500" />
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-700 hover:underline flex-1 truncate">{file.fileName}</a>
        {isEditing ? (
            <button type="button" onClick={onRemove} className="ml-auto text-red-500 hover:text-red-700"><X size={16} /></button>
        ) : (
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-slate-400 group-hover:text-indigo-600"><Download size={16} /></a>
        )}
    </div>
);

// --- Main Student Submission Component ---
function StudentTaskSubmission() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const API_URL = import.meta.env.VITE_API_URL;
    const fileInputRef = useRef(null);

    // State
    const [task, setTask] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [gradeInfo, setGradeInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Form State
    const [content, setContent] = useState('');
    const [attachments, setAttachments] = useState([]);
    const [newFilesToUpload, setNewFilesToUpload] = useState([]);
    
    const fetchData = useCallback(async (showLoader = true) => {
        if(showLoader) setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const response = await axios.get(`${API_URL}/api/student/tasks/details/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                const { task, submission, grade } = response.data.data;
                setTask(task);
                setGradeInfo(grade);
                setSubmission(submission);

                if (submission) {
                    setContent(submission.content || '');
                    setAttachments(submission.attachments || []);
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to fetch task details.");
            navigate('/student/tasks');
        } finally {
            if(showLoader) setIsLoading(false);
        }
    }, [taskId, navigate, API_URL]);

    useEffect(() => {
        document.title = "Student | Submit Task";
        fetchData();
    }, [fetchData]);

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            setNewFilesToUpload(prev => [...prev, ...files]);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveNewFile = (fileToRemove) => {
        setNewFilesToUpload(prev => prev.filter(f => f !== fileToRemove));
    };

    const handleRemoveExistingFile = (fileToRemove) => {
        setAttachments(prev => prev.filter(f => f.url !== fileToRemove.url));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content && attachments.length === 0 && newFilesToUpload.length === 0) {
            toast.warn("You must provide either text content or at least one file.");
            return;
        }

        setIsSubmitting(true);
        const submitToastId = toast.loading("Saving your work...");

        try {
            const uploadedNewAttachments = await Promise.all(
                newFilesToUpload.map(file => uploadAttachment(file))
            );

            const finalAttachments = [...attachments, ...uploadedNewAttachments];
            
            const payload = { content, attachments: finalAttachments };
            const token = Cookies.get('token');

            await axios.post(`${API_URL}/api/student/tasks/${taskId}/submit`, payload, {
                headers: { Authorization: `Bearer ${token}` } 
            });

            toast.update(submitToastId, { render: "Submission saved successfully!", type: "success", isLoading: false, autoClose: 3000 });
            
            setIsEditing(false);
            setNewFilesToUpload([]);
            await fetchData(false);
        } catch (error) {
            const errorMessage = error.response?.data?.message || "An unexpected error occurred.";
            toast.update(submitToastId, { render: errorMessage, type: "error", isLoading: false, autoClose: 5000 });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleCancelEdit = () => {
        setIsEditing(false);
        setContent(submission?.content || '');
        setAttachments(submission?.attachments || []);
        setNewFilesToUpload([]);
    }

    if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
    if (!task) return <div className="text-center p-10 text-red-600">Task not found.</div>;

    const isDeadlinePassed = new Date() > new Date(task.dueDate);
    const canEdit = submission && !isDeadlinePassed;
    const isGraded = gradeInfo?.status === 'Graded';

    const renderSubmissionView = () => (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Your Submission</h2>
                    <p className="text-sm text-slate-500 mt-1">Last submitted on: {new Date(submission.createdAt).toLocaleString()}</p>
                </div>
                {canEdit && !isGraded && (
                    <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-200 w-full sm:w-auto justify-center">
                        <Edit size={16}/> Edit Submission
                    </button>
                )}
            </div>

            {isGraded && (
                <div className="mb-6 p-5 bg-indigo-50 rounded-xl border border-indigo-100">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2"><Award size={20} className="text-indigo-500" /> Grade & Feedback</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm text-indigo-800 font-medium">Your Grade</p>
                            <p className="text-3xl font-bold text-indigo-900">{gradeInfo.grade ?? 'N/A'} / {task.maxPoints}</p>
                        </div>
                        <div>
                            <p className="text-sm text-indigo-800 font-medium">Faculty Feedback</p>
                            <p className="text-slate-700 italic mt-1">{gradeInfo.feedback || 'No feedback provided.'}</p>
                        </div>
                    </div>
                </div>
            )}

            {!isGraded && submission && (
                <div className="mb-6 p-5 bg-yellow-50 rounded-xl border border-yellow-100">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Clock size={20} className="text-yellow-500" /> Waiting for Grading
                    </h3>
                    <p className="text-slate-600">Your submission has been received and is pending review by the faculty.</p>
                </div>
            )}

            {submission.content && (
                <div>
                    <h4 className="font-bold mb-2">Text Submission</h4>
                    <div className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-lg border">{submission.content}</div>
                </div>
            )}
            {submission.attachments?.length > 0 && (
                <div className="mt-4">
                    <h4 className="font-bold mb-3">Submitted Files</h4>
                    <div className="space-y-3">
                        {submission.attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
                                <div className="flex items-center gap-3">
                                    <File size={18} className="text-indigo-500" />
                                    <div>
                                        <p className="font-medium text-slate-800">{file.fileName}</p>
                                        <p className="text-xs text-slate-500">Uploaded on {new Date(file.uploadedAt).toLocaleString()}</p>
                                    </div>
                                </div>
                                <a href={file.url} target="_blank" rel="noopener noreferrer" 
                                   className="text-indigo-600 hover:text-indigo-800">
                                    <Download size={18} />
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
    
    const renderForm = () => (
        <form onSubmit={handleSubmit}>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">{submission ? 'Edit Your Submission' : 'Submit Your Work'}</h2>
            <div className="space-y-6">
                <div>
                    <label htmlFor="content" className="block text-sm font-medium text-slate-700 mb-2">Text Response</label>
                    <textarea id="content" rows="6" value={content} onChange={(e) => setContent(e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Type your response here..."></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Attachments</label>
                    {attachments.length > 0 && (
                        <div className="mb-4 space-y-2">
                            <h4 className="font-semibold text-sm text-slate-600">Current files:</h4>
                            {attachments.map((file, i) => (
                                <FileAttachment key={i} file={file} isEditing={true} onRemove={() => handleRemoveExistingFile(file)} />
                            ))}
                        </div>
                    )}
                    <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <UploadCloud className="mx-auto h-12 w-12 text-slate-400" />
                            <div className="flex flex-col items-center gap-2">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500">
                                    <span>Upload files</span>
                                    <input 
                                        id="file-upload" 
                                        name="file-upload" 
                                        type="file" 
                                        multiple 
                                        className="sr-only" 
                                        onChange={handleFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.pptx"
                                        disabled={isSubmitting}
                                    />
                                </label>
                                <p className="text-xs text-slate-500">PDF, Images, Word, Excel, PowerPoint</p>
                            </div>
                        </div>
                    </div>
                    {newFilesToUpload.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {newFilesToUpload.map((file, i) => (
                                <div key={i} className="flex items-center justify-between p-2 bg-slate-100 rounded-md text-sm">
                                    <span className="truncate">{file.name}</span>
                                    <button type="button" onClick={() => handleRemoveNewFile(file)} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-end items-center mt-8 gap-4">
                {isEditing && (
                    <button type="button" onClick={handleCancelEdit} className="px-6 py-3 text-slate-600 font-semibold rounded-lg hover:bg-slate-100">
                        Cancel
                    </button>
                )}
                <button type="submit" disabled={isSubmitting}
                    className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                    {isSubmitting ? 'Saving...' : <><Save size={18}/> {submission ? 'Save Changes' : 'Submit Task'}</>}
                </button>
            </div>
        </form>
    );
    
    const renderStatusMessage = (message, details) => (
        <div className="text-center py-10 bg-slate-50 rounded-lg">
            <h2 className="text-2xl font-bold text-slate-800">{message}</h2>
            <p className="text-slate-500 mt-2">{details}</p>
        </div>
    );
    
    return (
        <>
            <ToastContainer theme="colored" position="bottom-right" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto p-4 md:p-6">
                <button onClick={() => navigate('/student/tasks')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 font-medium">
                    <ArrowLeft size={18} /> Back to All Tasks
                </button>
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/70 p-6 md:p-8 mb-8">
                    <div className="flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <span className="text-sm font-bold text-indigo-600 uppercase">{task.type}</span>
                            <h1 className="text-3xl font-bold text-slate-800 mt-1">{task.title}</h1>
                            <p className="text-slate-600 mt-2">{task.description || 'No description provided.'}</p>
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                <InfoCard icon={Calendar} label="Due Date" value={new Date(task.dueDate).toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' at ', ' ')} />
                                <InfoCard icon={Star} label="Max Points" value={`${task.maxPoints} Points`} />
                                <InfoCard icon={Clock} label="Status" value={isDeadlinePassed ? "Completed" : "Active"} />
                            </div>
                        </div>
                        <div className="md:w-1/3">
                            <img 
                                src={task.photo || `https://placehold.co/600x400/e2e8f0/475569?text=${task.type}`} 
                                alt={task.title}
                                className="w-full h-48 object-cover rounded-xl shadow-md"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/70 p-6 md:p-8">
                    {/* Main conditional rendering logic */}
                    {isEditing && renderForm()}
                    {!isEditing && submission && renderSubmissionView()}
                    {!submission && !isDeadlinePassed && !isGraded && renderForm()}
                    {isDeadlinePassed && !submission && !isGraded && renderStatusMessage("Deadline Passed", "The deadline for this task has passed and you did not make a submission.")}
                    {!submission && isGraded && (
                        <div className="text-center py-10 bg-slate-50 rounded-lg">
                            <h2 className="text-2xl font-bold text-slate-800">Graded Without Submission</h2>
                            <p className="text-slate-500 mt-2">You did not upload a submission, but the faculty has graded this task.</p>
                            <div className="mt-4 p-5 bg-indigo-50 rounded-xl border border-indigo-100 max-w-2xl mx-auto">
                                <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2 justify-center">
                                    <Award size={20} className="text-indigo-500" /> Grade & Feedback
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-indigo-800 font-medium">Your Grade</p>
                                        <p className="text-3xl font-bold text-indigo-900">{gradeInfo.grade ?? 'N/A'} / {task.maxPoints}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-indigo-800 font-medium">Faculty Feedback</p>
                                        <p className="text-slate-700 italic mt-1">{gradeInfo.feedback || 'No feedback provided.'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
}

export default StudentTaskSubmission;