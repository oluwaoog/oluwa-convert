import crypto from "crypto";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function createAdminToken() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SECRET)
    .update("oluwa-convert-admin")
    .digest("hex");
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const authorization = request.headers.authorization || "";

  if (!authorization.startsWith("Bearer ")) {
    return response.status(401).json({
      error: "Unauthorized"
    });
  }

  const token = authorization.slice(7);
  const expectedToken = createAdminToken();

  if (token !== expectedToken) {
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
