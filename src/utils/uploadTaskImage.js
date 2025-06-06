import Cookies from 'js-cookie';

export const uploadTaskImage = async (file, taskId) => {
  try {
    const API_KEY = "29e23fb8e91a4a02baf7e21776ef0143";
    const BASE_URL = import.meta.env.VITE_API_URL;

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Fetch previous task photo
    const prevRes = await fetch(`${BASE_URL}/tasks/${taskId}`);
    const prevData = await prevRes.json();

    if (prevData.success && prevData.task?.photo) {
      // 2. Delete previous photo
      await fetch(`https://innovlabs.tech/skillup/delete.php?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
        },
        body: JSON.stringify({ url: prevData.task.photo }),
      });
    }

    // 3. Upload new task image
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`https://innovlabs.tech/skillup/upload.php?key=${API_KEY}`, {
      method: "POST",
      body: formData,
      headers: {
        "X-API-KEY": API_KEY,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Upload failed");
    }

    return result.url;
  } catch (error) {
    console.error("Error uploading task image:", error);
    throw error;
  }
};
