import Cookies from 'js-cookie';

export const uploadCourseImage = async (file, courseId) => {
  try {
    const BASE_URL = import.meta.env.VITE_API_URL;

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Fetch course details to get previous photo
    const prevRes = await fetch(`${BASE_URL}/api/courses/${courseId}`);
    const prevData = await prevRes.json();

    // 2. If previous photo exists, delete it from storage (you must implement this route in backend)
    if (prevData.success && prevData.course?.photo) {
      await fetch(`${BASE_URL}/api/delete-photo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: prevData.course.photo }),
      });
    }

    // 3. Upload new course image
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
    console.error("Error uploading course image:", error);
    throw error;
  }
};
