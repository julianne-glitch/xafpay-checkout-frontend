import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const url = new URL(window.location.href);

  // ====================================================
  // READ GENERIC CHECKOUT PARAMS (PLATFORM-AGNOSTIC)
  // ====================================================
  const amount = Number(url.searchParams.get("amount"));
  const currency = url.searchParams.get("currency") || "XAF";
  const reference =
    url.searchParams.get("reference") ||
    url.searchParams.get("order_id"); // backward compatible
  const rawReturnUrl = url.searchParams.get("return_url");

  const [fatalError, setFatalError] = useState(false);

  useEffect(() => {
    if (!amount || !reference || !rawReturnUrl) {
      setFatalError(true);
    }
  }, []);

  if (fatalError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center">
        <div>
          <h1 className="text-2xl font-bold text-red-600">
            Invalid Checkout Link
          </h1>
          <p className="text-gray-600 mt-2">
            Please return to the merchant and try again.
          </p>
        </div>
      </div>
    );
  }

  const returnUrl = decodeURIComponent(rawReturnUrl);

  // ====================================================
  // STATE
  // ====================================================
  const [carrier, setCarrier] = useState("MTN");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE;
  const polling = useRef(false);
  const pollAttempts = useRef(0);

  // ====================================================
  // BACKEND HEALTH
  // ====================================================
  useEffect(() => {
    fetch(`${API_BASE}/health.php`)
      .then((r) =>
        setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Backend Issue")
      )
      .catch(() => setBackendStatus("🔴 Backend Offline"));
  }, []);

  // ====================================================
  // POLLING
  // ====================================================
  const startPolling = (xfOrderId) => {
    polling.current = true;
    pollAttempts.current = 0;

    const poll = async () => {
      if (!polling.current) return;
      if (++pollAttempts.current > 15) {
        polling.current = false;
        setStatus("⚠ Payment taking longer than expected.");
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/check_payment.php?order_id=${xfOrderId}`
        );
        const data = await res.json();
        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(st)) {
          polling.current = false;
          setStatus("✅ Payment Successful. Redirecting…");
          setTimeout(() => {
            window.location.href = returnUrl;
          }, 800);
          return;
        }

        if (["FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(st)) {
          polling.current = false;
          setStatus("❌ Payment failed.");
          return;
        }
      } catch {}

      setTimeout(poll, 3000);
    };

    poll();
  };

  // ====================================================
  // PAY
  // ====================================================
  const handlePay = async () => {
    if (!phone || !email) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/pay.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          phone,
          email,
          carrier,
          reference,     // 🔑 merchant reference
          return_url: returnUrl
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setStatus("🔁 Check your phone to approve payment…");
      startPolling(data.order_id);
    } catch {
      setStatus("❌ Payment error. Please retry.");
    }

    setLoading(false);
  };

  // ====================================================
  // UI
  // ====================================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm">{backendStatus}</p>
        </div>

        {status && (
          <div className="p-3 mb-4 rounded bg-green-100 text-green-700 text-sm">
            {status}
          </div>
        )}

        <input
          disabled
          value={`${amount} ${currency}`}
          className="w-full p-3 border rounded mb-4 bg-gray-100 font-semibold"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded mb-2"
        />

        <input
          type="tel"
          placeholder="6XXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-3 border rounded mb-3"
        />

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => setCarrier("MTN")}
            className={`flex-1 py-2 rounded ${
              carrier === "MTN" ? "bg-yellow-400" : "bg-yellow-200"
            }`}
          >
            MTN
          </button>
          <button
            onClick={() => setCarrier("ORANGE")}
            className={`flex-1 py-2 rounded ${
              carrier === "ORANGE" ? "bg-orange-400" : "bg-orange-200"
            }`}
          >
            ORANGE
          </button>
        </div>

        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-3 bg-red-600 text-white rounded text-lg"
        >
          {loading ? "Processing…" : `Pay ${amount} ${currency}`}
        </button>
      </div>
    </div>
  );
}
