let type = "airtime";

const rates = {
  MTN: { airtime: 0.75, data: 0.70 },
  Airtel: { airtime: 0.75, data: 0.70 },
  Glo: { airtime: 0.72, data: 0.68 },
  "9mobile": { airtime: 0.70, data: 0.65 }
};

function setType(t) {
  type = t;

  document.getElementById("airTab").classList.toggle("active", t === "airtime");
  document.getElementById("dataTab").classList.toggle("active", t === "data");

  document.getElementById("amountLabel").textContent =
    t === "airtime" ? "Airtime amount (₦)" : "Data value (₦)";

  calculate();
}

function calculate() {
  const network = document.getElementById("network").value;
  const amount = parseFloat(document.getElementById("amount").value) || 0;

  const cash = amount * rates[network][type];

  document.getElementById("cash").textContent =
    "₦" +
    cash.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
}

document.getElementById("network").addEventListener("change", calculate);

async function submitConversion() {
  const network = document.getElementById("network").value;
  const amount = Number(document.getElementById("amount").value);
  const bank = document.getElementById("bank").value;
  const phone = document.getElementById("phone").value.trim();
  const account = document.getElementById("account").value.trim();

  if (!amount || amount < 100) {
    return alert("Please enter an amount of at least ₦100.");
  }

  if (!/^\d{11}$/.test(phone)) {
    return alert("Please enter a valid 11-digit Nigerian phone number.");
  }

  if (bank === "Select bank") {
    return alert("Please select your bank.");
  }

  if (!/^\d{10}$/.test(account)) {
    return alert("Please enter a valid 10-digit account number.");
  }

  try {
    const response = await fetch("/api/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type,
        network,
        amount,
        bank,
        phone,
        account
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to create transaction.");
    }

    alert(
      "Transaction created successfully!\n\n" +
      "Reference: " + data.transaction.id + "\n" +
      "Estimated payout: ₦" +
      data.transaction.payout.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) +
      "\nStatus: " +
      data.transaction.status
    );
  } catch (error) {
    alert("Something went wrong: " + error.message);
  }
}

function openModal() {
  document.getElementById("modal").classList.add("show");
}

function closeModal() {
  document.getElementById("modal").classList.remove("show");
}
