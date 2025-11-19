import React, { useEffect, useState } from "react";

export default function XafpayCheckout() {
  const [sessionData, setSessionData] = useState(null);
  const [carrier, setCarrier] = useState("MTN");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Step 1: Fetch session info automatically on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");

    if (!sessionId) {
      setStatus("❌ No checkout session found. Please return to merchant site.");
      return;
    }

    fetch(`http://localhost/xafpay-backend/api/session.php?session_id=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setSessionData(data.data);
        } else {
          setStatus("❌ " + (data.error || "Unable to load checkout details."));
        }
      })
      .catch((err) => {
        setStatus("❌ Network error while loading checkout: " + err.message);
      });
  }, []);

  // ✅ Step 2: Handle payment
  const handlePay = async () => {
    if (!sessionData) return;

    setLoading(true);
    setStatus("Initializing payment...");

    try {
      const res = await fetch(
        `http://localhost/xafpay-backend/api/pay.php?amount=${sessionData.amount}&currency=${sessionData.currency}&order_id=${sessionData.order_id}`
      );
      const data = await res.json();

      if (data.ok) {
        setStatus("✅ Payment initialized!\nReference ID: " + data.reference_id);
      } else {
        setStatus("❌ " + (data.error || "Payment failed"));
      }
    } catch (err) {
      setStatus("❌ Network error: " + err.message);
    }

    setLoading(false);
  };

  // ✅ Step 3: UI Rendering
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/logo.png" alt="XafPay" className="w-16 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-gray-800">XafPay Secure Checkout</h1>
        </div>

        {/* Order Summary */}
        {sessionData ? (
          <div className="border rounded-2xl p-4 bg-gray-50 mb-5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Order ID</span>
              <span className="font-semibold text-gray-800">{sessionData.order_id}</span>
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-600">
              <span>Amount</span>
              <span className="font-semibold text-gray-800">
                {parseFloat(sessionData.amount).toLocaleString()} {sessionData.currency}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">{status || "Loading..."}</p>
        )}

        {/* Payment Method */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setCarrier("MTN")}
              className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${
                carrier === "MTN"
                  ? "bg-yellow-400 text-white border-yellow-400"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              Pay with MTN MoMo
            </button>
            <button
              onClick={() => setCarrier("ORANGE")}
              className={`flex-1 py-2 rounded-xl border text-sm font-semibold ${
                carrier === "ORANGE"
                  ? "bg-orange-500 text-white border-orange-500"
                  : "border-gray-300 text-gray-700"
              }`}
            >
              Pay with Orange Money
            </button>
          </div>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={loading || !sessionData}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading
            ? "Processing..."
            : sessionData
            ? `Pay ${parseFloat(sessionData.amount).toLocaleString()} ${sessionData.currency}`
            : "Pay"}
        </button>

        {/* Status */}
        {status && (
          <div className="mt-5 p-3 rounded-xl bg-gray-50 text-sm text-gray-700 border border-gray-200 whitespace-pre-wrap">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
