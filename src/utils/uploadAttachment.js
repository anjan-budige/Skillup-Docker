import Cookies from 'js-cookie';

const BASE_URL = import.meta.env.VITE_API_URL;

export const uploadAttachment = async (file) => {
  try {
    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Upload file
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Attachment upload failed");
    }

    // 2. Return file info
    return {
      fileName: file.name,
      url: result.url,
      fileType: file.type,
      uploadedBy: id,
      role,
    };
  } catch (error) {
    console.error("Error uploading attachment:", error);
    throw error;
  }
};
