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
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const session = getCookie(request, "admin_session");

  if (!session || session !== createAdminToken()) {
    return response.status(401).json({
      error: "Unauthorized"
    });
  }

  const { reference, status } = request.body || {};

  const allowedStatuses = [
    "PENDING",
    "VERIFIED",
    "PAID",
    "REJECTED"
  ];

  if (!reference || !status) {
    return response.status(400).json({
      error: "Reference and status are required"
    });
  }

  if (!allowedStatuses.includes(status)) {
    return response.status(400).json({
      error: "Invalid transaction status"
    });
  }

  try {
    const result = await sql`
      UPDATE transactions
      SET status = ${status}
      WHERE reference = ${reference}
      RETURNING
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
    `;

    if (result.length === 0) {
      return response.status(404).json({
        error: "Transaction not found"
      });
    }

    return response.status(200).json({
      success: true,
      transaction: result[0]
    });

  } catch (error) {
    console.error("Database error:", error);

    return response.status(500).json({
      error: "Unable to update transaction"
    });
  }
}
