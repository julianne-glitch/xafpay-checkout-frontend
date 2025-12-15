import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const url = new URL(window.location.href);

  // ****************************************************
  // READ CHECKOUT PARAMS (SAFE + BACKWARD COMPATIBLE)
  // ****************************************************
  const orderId =
    url.searchParams.get("order_id") ||
    url.searchParams.get("reference"); // future merchants

  const amountFromUrl = Number(url.searchParams.get("amount"));
  const currency = url.searchParams.get("currency") || "XAF";

  const rawReturnUrl = url.searchParams.get("return_url");
  const returnUrl = rawReturnUrl ? decodeURIComponent(rawReturnUrl) : "/";

  // ❗ DO NOT THROW, DO NOT useEffect
  const invalidEntry = !orderId || !amountFromUrl;

  // ****************************************************
  // STATE
  // ****************************************************
  const [amount] = useState(amountFromUrl || 0);
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
      .then(r =>
        setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Partial Connectivity")
      )
      .catch(() => setBackendStatus("🔴 Backend Offline"));
  }, []);

  // ****************************************************
  // EMAIL VALIDATION
  // ****************************************************
  useEffect(() => {
    if (!email) return setEmailError("");
    setEmailError(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? ""
        : "Enter a valid email"
    );
  }, [email]);

  const emailValid = email && !emailError;

  // ****************************************************
  // PHONE VALIDATION
  // ****************************************************
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

  const phoneValid = !phoneError && phoneNumber.length >= 9;

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
        const res = await fetch(
          `${API_BASE}/check_payment.php?order_id=${xfOrderId}`
        );
        const data = await res.json();
        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(st)) {
          polling.current = false;
          setStatus("✅ Payment Successful!");
          window.location.href = returnUrl;
          return;
        }

        if (["FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(st)) {
          polling.current = false;
          setStatus("❌ Payment Failed. Try again.");
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
    if (!emailValid || !phoneValid) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/pay.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency,
          phone: phoneNumber,
          email,
          carrier,
          reference: orderId,     // 🔑 generic
          return_url: returnUrl
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error();

      setStatus("🔁 Check your phone to approve payment…");
      startPolling(data.order_id);
    } catch {
      setStatus("❌ Network or payment error.");
    }

    setLoading(false);
  };

  // ****************************************************
  // INVALID ENTRY UI (NO FLICKER)
  // ****************************************************
  if (invalidEntry) {
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

  // ****************************************************
  // UI (UNCHANGED FEEL)
  // ****************************************************
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">

        <div className="text-center mb-6">
          <img src="/logo.jpg" className="h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm mt-1">{backendStatus}</p>
        </div>

        {status && (
          <div className="p-3 mb-4 rounded-lg text-sm bg-green-100 text-green-700">
            {status}
          </div>
        )}

        <input
          disabled
          value={`${amount} ${currency}`}
          className="w-full border p-3 rounded bg-gray-100 font-semibold mb-4"
        />

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border p-3 rounded mb-2"
        />

        <input
          type="tel"
          placeholder="6XX XXX XXX"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="w-full border p-3 rounded mb-3"
        />

        <div className="flex gap-3">
          <button
            onClick={() => setCarrier("MTN")}
            className={`flex-1 py-3 rounded ${
              carrier === "MTN" ? "bg-yellow-500" : "bg-yellow-300"
            }`}
          >
            MTN MoMo
          </button>
          <button
            onClick={() => setCarrier("ORANGE")}
            className={`flex-1 py-3 rounded ${
              carrier === "ORANGE" ? "bg-orange-400" : "bg-orange-200"
            }`}
          >
            Orange Money
          </button>
        </div>

        <button
          onClick={handlePay}
          disabled={!phoneValid || !emailValid || loading}
          className="w-full mt-6 py-3 rounded bg-red-600 text-white text-xl font-bold"
        >
          {loading ? "Processing…" : `Pay ${amount} ${currency}`}
        </button>

      </div>
    </div>
  );
}

