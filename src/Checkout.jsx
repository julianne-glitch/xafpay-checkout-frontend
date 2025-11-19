import React, { useState, useEffect } from "react";

export default function CheckoutPage() {
  const [amount, setAmount] = useState(2000);
  const [carrier, setCarrier] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState("");
  const [backendStatus, setBackendStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL;
  console.log("Loaded API_BASE:", API_BASE);

  // ------------------------------------------
  // Backend connectivity check
  // ------------------------------------------
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE}/health.php`);
        setBackendStatus(res.ok ? "🟢 Backend Connected" : "🟠 Backend Error");
      } catch (err) {
        setBackendStatus("🔴 Backend Unreachable");
      }
    };
    checkBackend();
  }, [API_BASE]);

  // ------------------------------------------
  // Phone number validation
  // ------------------------------------------
  useEffect(() => {
    if (!phoneNumber) {
      setPhoneError("");
      return;
    }

    const cleaned = phoneNumber.replace(/\D/g, "");

    if (cleaned.length !== 9) {
      setPhoneError("Phone number must be exactly 9 digits.");
      return;
    }

    // MTN Cameroon: 650–659, 670–679, 680–689
    if (
      carrier === "MTN" &&
      !/^6(5\d|7\d|8\d)/.test(cleaned)
    ) {
      setPhoneError("MTN numbers must start with 65, 67, or 68.");
      return;
    }

    // Orange: 690–699
    if (carrier === "Orange" && !/^69/.test(cleaned)) {
      setPhoneError("Orange numbers must start with 69.");
      return;
    }

    setPhoneError("");
  }, [phoneNumber, carrier]);

  const phoneValid = phoneError === "" && phoneNumber.length === 9;

  // ------------------------------------------
  // PAYMENT FLOW
  // ------------------------------------------
  const handleCheckout = async () => {
    if (!phoneValid) return;

    setLoading(true);
    setError("");

    try {
      // 1️⃣ Create session
      const sessionRes = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carrier_code: carrier,
          amount: amount,
          phone_number: phoneNumber,
        }),
      });

      const session = await sessionRes.json();

      if (!session.ok || !session.order_id) {
        setError(session.error || "Failed to create checkout session.");
        setLoading(false);
        return;
      }

      setSessionData(session);

      // 2️⃣ Request MTN payment
      const payRes = await fetch(`${API_BASE}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: session.amount,
          currency: "XAF",
          order_id: session.order_id,
        }),
      });

      const pay = await payRes.json();

      if (!pay.ok) {
        setError("MTN Payment failed to initialize.");
        setLoading(false);
        return;
      }

      // 3️⃣ Start status polling
      pollStatus(pay.status_url);

    } catch (err) {
      setError("Network error: " + err.message);
    }

    setLoading(false);
  };

  // ------------------------------------------
  // STATUS POLLING
  // ------------------------------------------
  const pollStatus = (url) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.status !== "PENDING") {
          clearInterval(interval);
          setPaymentStatus(data.status);
        }
      } catch (err) {
        console.log("Polling error:", err);
      }
    }, 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-gray-100">

        <div className="text-center mb-6">
          <img src="/logo.jpg" alt="XafPay" className="mx-auto h-14 mb-3" />
          <h1 className="text-2xl font-bold text-gray-800">XafPay Secure Checkout</h1>
          <p className="text-sm text-gray-500">Safe & Encrypted Payment</p>
        </div>

        <p className="text-center text-sm mb-4">{backendStatus}</p>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-md mb-4">
            ❌ {error}
          </div>
        )}

        {paymentStatus && (
          <div className="mt-6 text-center">
            {paymentStatus === "SUCCESS" && (
              <p className="text-green-600 text-lg font-bold">
                Payment Successful 🎉
              </p>
            )}

            {paymentStatus === "FAILED" && (
              <p className="text-red-600 text-lg font-bold">
                Payment Failed ❌
              </p>
            )}
          </div>
        )}

        {sessionData && !paymentStatus && (
          <div className="text-center space-y-3">
            <p><strong>Order ID:</strong> {sessionData.order_id}</p>
            <p><strong>Amount:</strong> {sessionData.amount} XAF</p>
            <p><strong>Carrier:</strong> {carrier}</p>
            <p><strong>Phone:</strong> {phoneNumber}</p>

            <div className="bg-green-50 text-green-700 p-3 rounded-md mt-4">
              Waiting for MTN MoMo confirmation...
            </div>
          </div>
        )}

        {!sessionData && (
          <>
            {/* Amount */}
            <div className="mb-4">
              <label className="block text-gray-600 mb-2">Amount (XAF)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full border rounded-lg p-3 focus:outline-none focus:ring focus:ring-blue-200"
              />
            </div>

            {/* Phone */}
            <div className="mb-4">
              <label className="block text-gray-600 mb-2">Mobile Money Number</label>
              <input
                type="tel"
                placeholder="6XX XXX XXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className={`w-full border rounded-lg p-3 focus:outline-none ${
                  phoneError ? "border-red-500 ring-red-200" : "focus:ring focus:ring-blue-200"
                }`}
              />
              {phoneError && (
                <p className="text-red-500 text-sm mt-1">{phoneError}</p>
              )}
            </div>

            {/* Payment Method */}
            <p className="font-semibold mb-2 text-gray-700">Payment Method</p>

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setCarrier("MTN")}
                className={`flex-1 py-3 rounded-lg font-semibold bg-yellow-400 hover:bg-yellow-500 ${
                  carrier === "MTN" ? "ring-4 ring-yellow-600" : ""
                }`}
              >
                Pay with MTN MoMo
              </button>

              <button
                onClick={() => setCarrier("Orange")}
                className={`flex-1 py-3 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 ${
                  carrier === "Orange" ? "ring-4 ring-orange-600" : ""
                }`}
              >
                Pay with Orange Money
              </button>
            </div>

            <button
              onClick={handleCheckout}
              disabled={!phoneValid || loading}
              className={`w-full mt-6 py-3 rounded-lg text-white text-lg font-bold ${
                !phoneValid || loading ? "bg-red-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Processing..." : `Pay ${amount} XAF`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
