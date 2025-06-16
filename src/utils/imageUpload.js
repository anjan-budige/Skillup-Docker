import Cookies from 'js-cookie';

// Access the API base URL from the Vite environment variable
const BASE_URL = import.meta.env.VITE_API_URL;

export const uploadImage = async (file, path = 'uploads') => {
  try {
    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Check for previous photo
    const prevRes = await fetch(`${BASE_URL}/api/user/photo?id=${id}&role=${role}`);
    const prevData = await prevRes.json();

    if (prevData.success && prevData.photo) {
      // 2. Delete previous photo
      await fetch(`${BASE_URL}/api/delete-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: prevData.photo })
      });
    }

    // 3. Upload new image
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Upload failed");
    }

    return result.url;
  } catch (error) {
    console.error("Error uploading image:", error);
    throw error;
  }
};
