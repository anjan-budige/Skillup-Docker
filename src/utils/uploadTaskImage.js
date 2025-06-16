import Cookies from 'js-cookie';

export const uploadTaskImage = async (file, taskId) => {
  try {
    const BASE_URL = import.meta.env.VITE_API_URL;

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Fetch previous task photo
    const prevRes = await fetch(`${BASE_URL}/api/tasks/${taskId}`);
    const prevData = await prevRes.json();

    if (prevData.success && prevData.task?.photo) {
      // 2. Delete previous photo using your backend
      await fetch(`${BASE_URL}/api/delete-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: prevData.task.photo }),
      });
    }

    // 3. Upload new task image to local storage via backend
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Upload failed");
    }

    return result.url;
  } catch (error) {
    console.error("Error uploading task image:", error);
    throw error;
  }
};
