import { motion } from 'framer-motion';

function AdminSettings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white/70 backdrop-blur-md rounded-2xl shadow-xl p-6 border border-gray-200/70"
    >
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>
      <p className="text-slate-600">Settings content will go here.</p>
    </motion.div>
  );
}

export default AdminSettings; 