import crypto from "crypto";

function createAdminToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SECRET)
    .update("oluwa-convert-admin")
    .digest("hex");
}

export default function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const { password } = request.body || {};

  if (!password) {
    return response.status(400).json({
      error: "Password is required"
    });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword || !process.env.ADMIN_SECRET) {
    return response.status(500).json({
      error: "Admin authentication is not configured"
    });
  }

  if (password !== adminPassword) {
    return response.status(401).json({
      error: "Invalid password"
    });
  }

  const token = createAdminToken();

  response.setHeader(
    "Set-Cookie",
    `admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
  );

  return response.status(200).json({
    success: true
  });
}
