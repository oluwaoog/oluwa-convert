import crypto from "crypto";

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

  if (!adminPassword) {
    return response.status(500).json({
      error: "Admin authentication is not configured"
    });
  }

  if (password !== adminPassword) {
    return response.status(401).json({
      error: "Invalid password"
    });
  }

  const token = crypto
    .createHmac("sha256", process.env.ADMIN_SECRET)
    .update("oluwa-convert-admin")
    .digest("hex");

  return response.status(200).json({
    success: true,
    token
  });
}
