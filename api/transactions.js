import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const rates = {
  MTN: { airtime: 0.75, data: 0.70 },
  Airtel: { airtime: 0.75, data: 0.70 },
  Glo: { airtime: 0.72, data: 0.68 },
  "9mobile": { airtime: 0.70, data: 0.65 }
};

async function checkRateLimit(ipAddress) {
  const rateLimitKey = `transactions:${ipAddress}`;
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60 * 1000);
  const expiresAt = new Date(now.getTime() + 60 * 1000);

  const result = await sql`
    INSERT INTO api_rate_limits (
      rate_limit_key,
      window_start,
      request_count,
      expires_at
    )
    VALUES (
      ${rateLimitKey},
      ${now},
      1,
      ${expiresAt}
    )
    ON CONFLICT (rate_limit_key)
    DO UPDATE SET
      window_start = CASE
        WHEN api_rate_limits.window_start <= ${windowStart}
        THEN ${now}
        ELSE api_rate_limits.window_start
      END,
      request_count = CASE
        WHEN api_rate_limits.window_start <= ${windowStart}
        THEN 1
        ELSE api_rate_limits.request_count + 1
      END,
      expires_at = CASE
        WHEN api_rate_limits.window_start <= ${windowStart}
        THEN ${expiresAt}
        ELSE api_rate_limits.expires_at
      END
    RETURNING request_count, expires_at
  `;

  const requestCount = Number(result[0].request_count);
  const currentExpiresAt = new Date(result[0].expires_at);

  return {
    allowed: requestCount <= 10,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil(
        (currentExpiresAt.getTime() - now.getTime()) / 1000
      )
    )
  };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Method not allowed"
    });
  }

  const forwardedFor = request.headers["x-forwarded-for"];

  const ipAddress =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers["x-real-ip"] ||
    "unknown";

  try {
    const rateLimit = await checkRateLimit(ipAddress);

    if (!rateLimit.allowed) {
      response.setHeader(
        "Retry-After",
        String(rateLimit.retryAfterSeconds)
      );

      response.setHeader("Cache-Control", "no-store");

      return response.status(429).json({
        error: "Too many requests. Please try again later."
      });
    }
  } catch (error) {
    console.error("Rate limit error:", error);

    return response.status(500).json({
      error: "Unable to process request"
    });
  }

  const {
    type = "airtime",
    network,
    amount,
    bank,
    account,
    phone,
    idempotencyKey
  } = request.body || {};

  if (
    !idempotencyKey ||
    !/^[a-zA-Z0-9-]{16,64}$/.test(idempotencyKey)
  ) {
    return response.status(400).json({
      error: "Invalid idempotency key"
    });
  }

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

  try {
    const existingTransaction = await sql`
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
      WHERE idempotency_key = ${idempotencyKey}
      LIMIT 1
    `;

    if (existingTransaction.length > 0) {
      const transaction = existingTransaction[0];

      response.setHeader("Cache-Control", "no-store");

      return response.status(200).json({
        success: true,
        duplicate: true,
        transaction: {
          id: transaction.reference,
          type: transaction.type,
          network: transaction.network,
          amount: Number(transaction.amount),
          rate: Number(transaction.rate),
          payout: Number(transaction.payout),
          bank: transaction.bank,
          account: transaction.account_last4,
          status: transaction.status
        }
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
          status,
          idempotency_key
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
          'PENDING',
          ${idempotencyKey}
        )
      `;
    } catch (error) {
      if (error.code === "23505") {
        const duplicateTransaction = await sql`
          SELECT
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
          WHERE idempotency_key = ${idempotencyKey}
          LIMIT 1
        `;

        if (duplicateTransaction.length > 0) {
          const transaction = duplicateTransaction[0];

          response.setHeader("Cache-Control", "no-store");

          return response.status(200).json({
            success: true,
            duplicate: true,
            transaction: {
              id: transaction.reference,
              type: transaction.type,
              network: transaction.network,
              amount: Number(transaction.amount),
              rate: Number(transaction.rate),
              payout: Number(transaction.payout),
              bank: transaction.bank,
              account: transaction.account_last4,
              status: transaction.status
            }
          });
        }
      }

      throw error;
    }

    response.setHeader("Cache-Control", "no-store");

    return response.status(201).json({
      success: true,
      duplicate: false,
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
