import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ success: false, message: "No URL provided" });

  const filename = url.split('/').pop();
  const filepath = path.resolve('uploads', filename);

  fs.unlink(filepath, (err) => {
    if (err) {
      return res.status(404).json({ success: false, message: "File not found" });
    }
    res.json({ success: true, message: "Deleted successfully" });
  });
});

export default router;
