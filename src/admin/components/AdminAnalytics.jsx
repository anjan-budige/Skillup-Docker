import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Download, Calendar, ChevronLeft, ChevronRight, BarChart2, CheckSquare, Users } from 'lucide-react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import moment from 'moment';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 




const kpiCardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({ 
        opacity: 1, 
        y: 0, 
        transition: { duration: 0.5, delay: i * 0.1 } 
    })
};

const chartVariant = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, delay: 0.2 } }
};



function Modal({ isOpen, onClose, title, children, size = 'max-w-md' }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={`bg-white rounded-2xl shadow-xl w-full ${size} m-auto`} onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-2xl">×</button>
                </div>
                <div className="p-6">{children}</div>
            </motion.div>
        </div>
    );
}


const CalendarComponent = ({ date, setDate, otherDate, isStartDate }) => {
    const [currentMonth, setCurrentMonth] = useState(moment(date));
    
    
    const daysOfWeek = moment.weekdaysShort(); 
    
    const firstDayOfMonth = currentMonth.clone().startOf('month');
    const lastDayOfMonth = currentMonth.clone().endOf('month');
    const startDay = firstDayOfMonth.day();

    const calendarDays = [];
    for (let i = 0; i < startDay; i++) calendarDays.push(<div key={`empty-${i}`} className="p-1"></div>);
    for (let i = 1; i <= lastDayOfMonth.date(); i++) {
        const dayMoment = currentMonth.clone().date(i);
        const isSelected = dayMoment.isSame(date, 'day');
        const isInRange = isStartDate ? dayMoment.isBefore(otherDate, 'day') : dayMoment.isAfter(otherDate, 'day');
        const isDisabled = !isInRange && !dayMoment.isSame(otherDate, 'day');

        calendarDays.push(
            <button key={i}
                disabled={isDisabled}
                className={`w-9 h-9 text-sm text-center flex items-center justify-center rounded-full transition-colors ${
                    isSelected ? 'bg-blue-600 text-white font-bold' 
                    : isDisabled ? 'text-slate-300' 
                    : 'hover:bg-blue-100 text-slate-700'
                }`}
                onClick={() => !isDisabled && setDate(dayMoment.toDate())}>
                {i}
            </button>
        );
    }

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => setCurrentMonth(currentMonth.clone().subtract(1, 'month'))} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button>
                <span className="font-bold text-lg">{currentMonth.format('MMMM YYYY')}</span>
                <button onClick={() => setCurrentMonth(currentMonth.clone().add(1, 'month'))} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-xs text-center text-slate-500">
                {daysOfWeek.map(day => <div key={day} className="font-semibold w-9 h-9 flex items-center justify-center">{day.charAt(0)}</div>)}
                {calendarDays}
            </div>
        </div>
    );
};



function AdminAnalytics() {
    const [analytics, setAnalytics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDateModalOpen, setIsDateModalOpen] = useState(false);
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).setDate(new Date().getDate() - 29),
        endDate: new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })),
        department: ''
    });
    
    const [tempFilters, setTempFilters] = useState(filters);

    const fetchAnalytics = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = Cookies.get('token');
            const params = {
                startDate: moment(filters.startDate).format('YYYY-MM-DD'),
                endDate: moment(filters.endDate).add(1, 'day').format('YYYY-MM-DD'),
                department: filters.department
            };
            const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/admin/analytics`, {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            if (response.data.success) {
                setAnalytics(response.data.data);
            }
        } catch (error) { toast.error("Failed to fetch analytics data."); } 
        finally { setIsLoading(false); }
    }, [filters]);

    useEffect(() => {
        document.title = "Admin | Analytics";
        fetchAnalytics();
    }, [fetchAnalytics]);

    const handleApplyDateFilter = () => {
        setFilters(tempFilters);
        setIsDateModalOpen(false);
    };

    
    

    const generatePDFReport = () => {
      if (!analytics) {
        toast.error("No analytics data to generate a report.");
        return;
      }
    
      const doc = new jsPDF();
      let y = 40;
    
      doc.setFontSize(18);
      doc.text("Analytics Report", 14, 22);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(
        `Date Range: ${moment(filters.startDate).format("MMM D, YYYY")} - ${moment(filters.endDate).format("MMM D, YYYY")}`,
        14,
        30
      );
    
      const kpis = analytics.kpis;
      const kpiText = `Total Submissions: ${kpis.totalSubmissions}  |  Total Graded: ${kpis.totalGraded}  |  Average Score: ${kpis.averageScore?.toFixed(2) || "N/A"}`;
      doc.text(kpiText, 14, y);
      y += 10;
    
      if (analytics.coursePerformance.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Course Performance", "Avg. Grade", "Submissions"]],
          body: analytics.coursePerformance.map((c) => [
            c.courseName,
            c.averageGrade?.toFixed(2) ?? "N/A",
            c.submissionCount,
          ]),
          theme: "striped",
          headStyles: { fillColor: [22, 160, 133] },
        });
        y = doc.lastAutoTable.finalY + 10;
      }
    
      if (analytics.facultyPerformance.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Top Faculty", "Avg. Grade", "Tasks Created"]],
          body: analytics.facultyPerformance.map((f) => [
            f.facultyName,
            f.averageGrade?.toFixed(2) ?? "N/A",
            f.taskCount,
          ]),
          theme: "grid",
          headStyles: { fillColor: [41, 128, 185] },
        });
      }
    
      doc.save(`Analytics_Report_${moment().format("YYYY-MM-DD")}.pdf`);
    };


    if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
    if (!analytics) return <div className="text-center p-10 bg-red-100 text-red-600 rounded-lg">Could not load analytics data. Please try again.</div>;

    const kpiCards = [
        { title: 'Total Submissions', value: analytics.kpis.totalSubmissions, icon: <CheckSquare size={28} className="text-blue-600"/> },
        { title: 'Total Graded', value: analytics.kpis.totalGraded, icon: <Users size={28} className="text-emerald-600"/> },
        { title: 'Average Score', value: analytics.kpis.averageScore?.toFixed(1) || 'N/A', icon: <BarChart2 size={28} className="text-indigo-600"/> },
    ];

    return (
        <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <ToastContainer theme="colored" position="bottom-right" />
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-slate-800 self-start md:self-center">Platform Analytics</h2>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <button onClick={() => { setTempFilters(filters); setIsDateModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
                        <Calendar size={16} className="text-slate-500"/>
                        <span className="text-sm font-medium text-slate-700">
                            {moment(filters.startDate).format('MMM D, YY')} - {moment(filters.endDate).format('MMM D, YY')}
                        </span>
                    </button>
                    <button onClick={generatePDFReport} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg shadow-md hover:bg-emerald-700">
                        <Download size={16}/> Download Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                 {kpiCards.map((card, index) => (
                    <motion.div custom={index} variants={kpiCardVariant} key={card.title} className="bg-white p-6 rounded-xl shadow-lg border">
                        <div className="flex items-center justify-between">
                            <h3 className="text-slate-500 font-semibold">{card.title}</h3>
                            <div className="p-3 bg-slate-100 rounded-full">{card.icon}</div>
                        </div>
                        <p className="text-4xl font-bold text-slate-800 mt-2">{card.value}</p>
                    </motion.div>
                 ))}
            </div>

            <motion.div variants={chartVariant} className="bg-white p-6 rounded-xl shadow-lg border mb-8">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Submission Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analytics.submissionTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="_id" tick={{fontSize: 12}} />
                        <YAxis tick={{fontSize: 12}} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="count" name="Submissions" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div variants={chartVariant} className="bg-white p-6 rounded-xl shadow-lg border">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Top Performing Courses (by Avg. Grade)</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.coursePerformance} layout="vertical" margin={{ right: 20, left: 100 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis type="number" />
                           <YAxis type="category" dataKey="courseName" width={100} tick={{fontSize: 12}} interval={0}/>
                           <Tooltip />
                           <Bar dataKey="averageGrade" name="Avg. Grade" fill="#10b981" />
                        </BarChart>
                     </ResponsiveContainer>
                </motion.div>
                <motion.div variants={chartVariant} className="bg-white p-6 rounded-xl shadow-lg border">
                    <h3 className="text-xl font-bold text-slate-800 mb-4">Top Performing Faculty (by Avg. Grade)</h3>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analytics.facultyPerformance} layout="vertical" margin={{ right: 20, left: 100 }}>
                           <CartesianGrid strokeDasharray="3 3" />
                           <XAxis type="number" />
                           <YAxis type="category" dataKey="facultyName" width={100} tick={{fontSize: 12}} interval={0}/>
                           <Tooltip />
                           <Bar dataKey="averageGrade" name="Avg. Grade" fill="#8b5cf6" />
                        </BarChart>
                     </ResponsiveContainer>
                </motion.div>
            </div>

            <Modal
  isOpen={isDateModalOpen}
  onClose={() => setIsDateModalOpen(false)}
  title="Select Date Range"
  size="max-w-full sm:max-w-2xl"
>
  {/* Scrollable content wrapper */}
  <div className="max-h-[80vh] overflow-y-auto px-4 sm:px-6 py-4">
    <div className="flex flex-col sm:flex-row gap-6">
      {/* Start Date */}
      <div className="w-full">
        <h3 className="font-semibold text-center mb-2 text-base sm:text-lg">Start Date</h3>
        <CalendarComponent
          date={tempFilters.startDate}
          setDate={(date) =>
            setTempFilters((prev) => ({ ...prev, startDate: date }))
          }
          otherDate={tempFilters.endDate}
          isStartDate={true}
        />
      </div>

      {/* End Date */}
      <div className="w-full border-t sm:border-t-0 sm:border-l pt-6 sm:pt-0 sm:pl-6">
        <h3 className="font-semibold text-center mb-2 text-base sm:text-lg">End Date</h3>
        <CalendarComponent
          date={tempFilters.endDate}
          setDate={(date) =>
            setTempFilters((prev) => ({ ...prev, endDate: date }))
          }
          otherDate={tempFilters.startDate}
          isStartDate={false}
        />
      </div>
    </div>

    {/* Apply Button */}
    <div className="flex justify-end mt-6 pt-4 border-t">
      <button
        onClick={handleApplyDateFilter}
        className="w-full sm:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
      >
        Apply Filters
      </button>
    </div>
  </div>
</Modal>

        </motion.div>
    );
}

export default AdminAnalytics;