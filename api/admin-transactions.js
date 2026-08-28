import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function createAdminToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SECRET)
    .update("oluwa-convert-admin")
    .digest("hex");
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

  if (!session) {
    return response.status(401).json({
      error: "Unauthorized"
    });
  }

  const expectedToken = createAdminToken();

  if (session !== expectedToken) {
    return response.status(401).json({
      error: "Invalid admin session"
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
