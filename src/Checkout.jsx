import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const url = new URL(window.location.href);

  // ****************************************************
  // READ VALUES SENT FROM WOOCOMMERCE (STRICT – NO FALLBACKS)
  // ****************************************************
  const wcOrderId = url.searchParams.get("order_id");
  const amountFromWC = Number(url.searchParams.get("amount"));
  const rawReturnUrl = url.searchParams.get("return_url");

  if (!wcOrderId || !rawReturnUrl || !amountFromWC) {
    throw new Error("Invalid checkout entry: missing WooCommerce parameters");
  }

  const returnUrl = decodeURIComponent(rawReturnUrl);

  // ****************************************************
  // STATE
  // ****************************************************
  const [amount] = useState(amountFromWC);
  const [carrier, setCarrier] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [backendStatus, setBackendStatus] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE;
  const polling = useRef(false);
  const pollAttempts = useRef(0);

  // ****************************************************
  // BACKEND HEALTH CHECK
  // ****************************************************
  useEffect(() => {
    fetch(`${API_BASE}/health.php`)
      .then(r => setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Partial Connectivity"))
      .catch(() => setBackendStatus("🔴 Backend Offline"));
  }, []);

  // ****************************************************
  // VALIDATION
  // ****************************************************
  useEffect(() => {
    if (!email) return setEmailError("");
    setEmailError(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "Enter a valid email");
  }, [email]);

  useEffect(() => {
    if (!phoneNumber) return setPhoneError("");
    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length !== 9) return setPhoneError("Phone must be 9 digits");

    if (carrier === "MTN" && !/^6(5|6|7|8)/.test(clean))
      return setPhoneError("MTN MoMo starts with 65 / 66 / 67 / 68");

    if (carrier === "ORANGE" && !/^69/.test(clean))
      return setPhoneError("Orange Money starts with 69");

    setPhoneError("");
  }, [phoneNumber, carrier]);

  // ****************************************************
  // POLLING
  // ****************************************************
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
        const res = await fetch(`${API_BASE}/check_payment.php?order_id=${xfOrderId}`);
        const data = await res.json();
        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(st)) {
          polling.current = false;
          setStatus("✅ Payment Successful! Redirecting…");
          window.location.href = returnUrl;
          return;
        }

        if (["FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(st)) {
          polling.current = false;
          setStatus("❌ Payment Failed.");
          return;
        }
      } catch {}

      setTimeout(poll, 3000);
    };

    poll();
  };

  // ****************************************************
  // PAY
  // ****************************************************
  const handlePay = async () => {
    if (!email || emailError || phoneError) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/pay.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: phoneNumber,
          email,
          carrier,
          wc_order_id: wcOrderId
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      setStatus("🔁 Check your phone to approve payment…");
      startPolling(data.order_id);
    } catch (e) {
      setStatus("❌ Payment error. Please retry.");
    }

    setLoading(false);
  };

  // ****************************************************
  // UI
  // ****************************************************
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">

        <div className="text-center mb-6">
          <img src="/logo.jpg" className="h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm">{backendStatus}</p>
        </div>

        {status && (
          <div className="p-3 mb-4 rounded bg-green-100 text-green-700 text-sm">
            {status}
          </div>
        )}

        <input disabled value={amount} className="w-full p-3 border rounded mb-4 bg-gray-100" />

        <input type="email" placeholder="Email" value={email}
          onChange={e => setEmail(e.target.value)} className="w-full p-3 border rounded mb-2" />

        <input type="tel" placeholder="6XX XXX XXX" value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)} className="w-full p-3 border rounded mb-2" />

        <div className="flex gap-3">
          <button onClick={() => setCarrier("MTN")} className="flex-1 bg-yellow-400 py-2 rounded">MTN</button>
          <button onClick={() => setCarrier("ORANGE")} className="flex-1 bg-orange-400 py-2 rounded">ORANGE</button>
        </div>

        <button onClick={handlePay} disabled={loading}
          className="w-full mt-4 py-3 bg-red-600 text-white rounded text-lg">
          {loading ? "Processing…" : `Pay ${amount} XAF`}
        </button>

      </div>
    </div>
  );
}
