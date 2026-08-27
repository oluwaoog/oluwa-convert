import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rates = {
  MTN: { airtime: 0.75, data: 0.70 },
  Airtel: { airtime: 0.75, data: 0.70 },
  Glo: { airtime: 0.72, data: 0.68 },
  "9mobile": { airtime: 0.70, data: 0.65 }
};

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const {
    type = "airtime",
    network,
    amount,
    bank,
    account,
    phone
  } = request.body || {};

  if (!network || !rates[network]) {
    return response.status(400).json({
      error: "Invalid network"
    });
  }

  if (!["airtime", "data"].includes(type)) {
    return response.status(400).json({
      error: "Invalid transaction type"
    });
  }

  const numericAmount = Number(amount);

  if (!numericAmount || numericAmount < 100) {
    return response.status(400).json({
      error: "Minimum amount is ₦100"
    });
  }

  if (!/^\d{11}$/.test(String(phone || ""))) {
    return response.status(400).json({
      error: "Invalid phone number"
    });
  }

  if (!/^\d{10}$/.test(String(account || ""))) {
    return response.status(400).json({
      error: "Invalid account number"
    });
  }

  if (!bank || bank === "Select bank") {
    return response.status(400).json({
      error: "Please select a bank"
    });
  }

  const rate = rates[network][type];
  const payout = numericAmount * rate;

  const reference =
    "OC-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    await sql`
      INSERT INTO transactions (
        reference,
        type,
        network,
        amount,
        rate,
        payout,
        bank,
        account_last4,
        phone,
        status
      )
      VALUES (
        ${reference},
        ${type},
        ${network},
        ${numericAmount},
        ${rate},
        ${payout},
        ${bank},
        ${String(account).slice(-4)},
        ${phone},
        'PENDING'
      )
    `;

    return response.status(201).json({
      success: true,
      transaction: {
        id: reference,
        type,
        network,
        amount: numericAmount,
        rate,
        payout,
        bank,
        account: String(account).slice(-4),
        status: "PENDING"
      }
    });
  } catch (error) {
    console.error("Database error:", error);

    return response.status(500).json({
      error: "Unable to save transaction"
    });
  }
}
