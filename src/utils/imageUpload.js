import Cookies from 'js-cookie';

export const uploadImage = async (file, path = 'uploads') => {
  try {
    const API_KEY = "29e23fb8e91a4a02baf7e21776ef0143";

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // 1. Check for previous photo
    const prevRes = await fetch(`http://localhost:5000/api/user/photo?id=${id}&role=${role}`);
    const prevData = await prevRes.json();

    if (prevData.success && prevData.photo) {
      // 2. Delete previous photo
      await fetch(`https://innovlabs.tech/skillup/delete.php?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY
        },
        body: JSON.stringify({ url: prevData.photo })
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
    console.error("Error uploading image:", error);
    throw error;
  }
};
