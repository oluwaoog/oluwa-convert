import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function verifyAdminToken(token) {
  if (!token || !process.env.ADMIN_SECRET) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [payload, signature] = parts;

  try {
    const expectedSignature = crypto
      .createHmac("sha256", process.env.ADMIN_SECRET)
      .update(payload)
      .digest("base64url");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return false;
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    if (data.role !== "admin") {
      return false;
    }

    if (!Number.isFinite(data.expiresAt) || Date.now() >= data.expiresAt) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function getCookie(request, name) {
  const cookies = request.headers.cookie || "";

  const match = cookies
    .split(";")
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(name + "="));

  return match ? match.substring(name.length + 1) : null;
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const session = getCookie(request, "admin_session");

  if (!verifyAdminToken(session)) {
    return response.status(401).json({
      error: "Unauthorized"
    });
  }

  try {
    const transactions = await sql`
      SELECT
        id,
        reference,
        type,
        network,
        amount,
        rate,
        payout,
        bank,
        account_last4,
        phone,
        status,
        created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 100
    `;

    response.setHeader("Cache-Control", "no-store");

    return response.status(200).json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error("Database error:", error);

    return response.status(500).json({
      error: "Unable to load transactions"
    });
  }
}