import Cookies from 'js-cookie';

export const uploadAttachment = async (file) => {
  try {
    const API_KEY = "29e23fb8e91a4a02baf7e21776ef0143";

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { id, role } = parsed.data;

    // Upload the file
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
      throw new Error(result.error || "Attachment upload failed");
    }

    // Return necessary file info
    return {
      fileName: file.name,
      url: result.url,
      fileType: file.type,
    };
  } catch (error) {
    console.error("Error uploading attachment:", error);
    throw error;
  }
};
