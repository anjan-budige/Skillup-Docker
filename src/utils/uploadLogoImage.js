import Cookies from 'js-cookie';

export const uploadLogoImage = async (file) => {
  try {
    const API_KEY = "29e23fb8e91a4a02baf7e21776ef0143";
    const BASE_URL = import.meta.env.VITE_API_URL;

    const session = Cookies.get("session");
    if (!session) throw new Error("Session not found");

    const parsed = JSON.parse(decodeURIComponent(session));
    const { role } = parsed.data;

    if (role !== "admin") {
      throw new Error("Only admins can update the logo");
    }

    // 1. Fetch existing settings to get old logo
    const settingsRes = await fetch(`${BASE_URL}/settings`);
    const settingsData = await settingsRes.json();

    if (settingsData.success && settingsData.data?.platformLogo) {
      // 2. Delete old logo
      await fetch(`https://innovlabs.tech/skillup/delete.php?key=${API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": API_KEY,
        },
        body: JSON.stringify({ url: settingsData.data.platformLogo }),
      });
    }

    // 3. Upload new logo
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(`https://innovlabs.tech/skillup/upload.php?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "X-API-KEY": API_KEY,
      },
      body: formData,
    });

    const uploadData = await uploadRes.json();

    if (!uploadRes.ok) {
      throw new Error(uploadData.error || "Image upload failed");
    }

    const uploadedUrl = uploadData.url;

    // 4. Update logo in settings
    const updateRes = await fetch(`${BASE_URL}/settings/logo`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${parsed.token}`,
      },
      body: JSON.stringify({ platformLogo: uploadedUrl }),
    });

    const updateData = await updateRes.json();

    if (!updateData.success) {
      throw new Error(updateData.message || "Failed to update logo in settings");
    }

    return uploadedUrl;

  } catch (error) {
    console.error("Error uploading logo image:", error);
    throw error;
  }
};
