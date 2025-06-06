import Cookies from 'js-cookie';

export const uploadCourseImage = async (file, courseId) => {
  try {
    const API_KEY = "29e23fb8e91a4a02baf7e21776ef0143";
    const BASE_URL = import.meta.env.VITE_API_URL;

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Check for previous course photo
    const prevRes = await fetch(`${BASE_URL}/courses/${courseId}`);
    const prevData = await prevRes.json();

    if (prevData.success && prevData.course?.photo) {
      // 2. Delete previous photo from storage
      await fetch(`https://innovlabs.tech/skillup/delete.php?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
        },
        body: JSON.stringify({ url: prevData.course.photo }),
      });
    }

    // 3. Upload new image
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
    console.error("Error uploading course image:", error);
    throw error;
  }
};
