const rates = {
  MTN: { airtime: 0.75, data: 0.70 },
  Airtel: { airtime: 0.75, data: 0.70 },
  Glo: { airtime: 0.72, data: 0.68 },
  "9mobile": { airtime: 0.70, data: 0.65 }
};

export default function handler(request, response) {
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
    account
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

  if (!/^\d{10}$/.test(String(account || ""))) {
    return response.status(400).json({
      error: "Invalid account number"
    });
  }

  const rate = rates[network][type];
  const payout = numericAmount * rate;

  const transactionId =
    "OC-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 7).toUpperCase();

  return response.status(201).json({
    success: true,
    transaction: {
      id: transactionId,
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
}
