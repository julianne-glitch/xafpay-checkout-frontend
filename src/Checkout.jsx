import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const [amount, setAmount] = useState(2000);
  const [carrier, setCarrier] = useState("MTN");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");                 // ⭐ NEW
  const [emailError, setEmailError] = useState("");       // ⭐ NEW
  const [phoneError, setPhoneError] = useState("");
  const [backendStatus, setBackendStatus] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE = import.meta.env.VITE_API_BASE;

  // Polling refs
  const polling = useRef(false);
  const pollAttempts = useRef(0);
  const currentOrderId = useRef(null);

  // -----------------------------
  // BACKEND HEALTH CHECK
  // -----------------------------
  useEffect(() => {
    async function ping() {
      try {
        const r = await fetch(`${API_BASE}/health.php`);
        setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Error Connecting");
      } catch {
        setBackendStatus("🔴 Backend Offline");
      }
    }
    ping();
  }, [API_BASE]);

  // -----------------------------
  // EMAIL VALIDATION (NEW)
  // -----------------------------
  useEffect(() => {
    if (!email) return setEmailError("");

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setEmailError(valid ? "" : "Invalid email format");
  }, [email]);

  const emailValid = email && emailError === "";

  // -----------------------------
  // PHONE VALIDATION
  // -----------------------------
  useEffect(() => {
    if (!phoneNumber) return setPhoneError("");

    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length !== 9) return setPhoneError("Phone must be 9 digits");

    if (carrier === "MTN" && !/^6(5|6|7|8)/.test(clean))
      return setPhoneError("MTN numbers start with 65, 66, 67, 68");

    if (carrier === "ORANGE" && !/^69/.test(clean))
      return setPhoneError("Orange numbers start with 69");

    setPhoneError("");
  }, [phoneNumber, carrier]);

  const phoneValid =
    phoneError === "" && phoneNumber.replace(/\D/g, "").length === 9;

  // -----------------------------
  // POLLING HANDLER (same)
  // -----------------------------
  const startPolling = (orderId) => {
    polling.current = true;
    pollAttempts.current = 0;
    currentOrderId.current = orderId;

    const poll = async () => {
      if (!polling.current) return;

      pollAttempts.current++;

      if (pollAttempts.current > 20) {
        polling.current = false;
        setStatus(
          "⚠ Payment taking longer than expected. Please check your phone."
        );
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/check_payment.php?order_id=${orderId}`
        );
        const data = await res.json();

        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        if (
          st === "SUCCESSFUL" ||
          st === "SUCCESS" ||
          st === "COMPLETED" ||
          st === "PAID"
        ) {
          polling.current = false;
          setStatus("✅ Payment SUCCESSFUL!");
          return;
        }

        if (st === "FAILED") {
          polling.current = false;
          setStatus("❌ Payment FAILED.");
          return;
        }

        if (st === "CANCELED" || st === "CANCELLED") {
          polling.current = false;
          setStatus("⚠ Payment was CANCELED.");
          return;
        }

        if (st === "EXPIRED") {
          polling.current = false;
          setStatus("⚠ Payment EXPIRED.");
          return;
        }
      } catch {}

      setTimeout(poll, 3000);
    };

    poll();
  };

  // -----------------------------
  // HANDLE PAY  (NOW SENDS EMAIL)
  // -----------------------------
  const handlePay = async () => {
    if (!phoneValid || !emailValid) return;

    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`${API_BASE}/pay.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          phone: phoneNumber,
          email,                             // ⭐ NEW
          carrier,
        }),
      });

      const rawText = await res.text();
      let data;

      try {
        data = JSON.parse(rawText);
      } catch {
        setStatus("❌ Backend returned invalid JSON");
        setLoading(false);
        return;
      }

      if (!data.ok) {
        setStatus("❌ Error: " + (data.error || "Unknown error"));
        setLoading(false);
        return;
      }

      const orderId = data.order_id;

      // Redirect mode
      if (data.mode === "REDIRECT" && data.payment_url) {
        setStatus("🔁 Redirecting…");
        window.location.href = data.payment_url;
        return;
      }

      // Direct MoMo push
      setStatus(
        `🔁 Payment Started\nRequest ID: ${data.tranzak_request_id}\nWaiting for confirmation…`
      );

      startPolling(orderId);
    } catch (err) {
      setStatus("❌ Network error: " + err.message);
    }

    setLoading(false);
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-gray-100">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/logo.jpg" className="h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm">{backendStatus}</p>
        </div>

        {/* Status Box */}
        {status && (
          <div
            className={`p-3 mb-4 rounded text-sm whitespace-pre-wrap ${
              status.startsWith("❌")
                ? "bg-red-100 text-red-600 border border-red-300"
                : status.startsWith("⚠")
                ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
                : "bg-green-100 text-green-700 border border-green-300"
            }`}
          >
            {status}
          </div>
        )}

        {/* Amount */}
        <div className="mb-4">
          <label>Amount (XAF)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full border p-3 rounded"
          />
        </div>

        {/* Email */}
        <div className="mb-4">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full border p-3 rounded ${
              emailError ? "border-red-500" : ""
            }`}
          />
          {emailError && <p className="text-red-500 text-sm">{emailError}</p>}
        </div>

        {/* Phone */}
        <div className="mb-4">
          <label>Mobile Money Number</label>
          <input
            type="tel"
            placeholder="6XX XXX XXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className={`w-full border p-3 rounded ${
              phoneError ? "border-red-500" : ""
            }`}
          />
          {phoneError && <p className="text-red-500 text-sm">{phoneError}</p>}
        </div>

        {/* Carrier Buttons */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => setCarrier("MTN")}
            className={`flex-1 py-3 rounded-lg font-semibold bg-yellow-400 ${
              carrier === "MTN" ? "ring-4 ring-yellow-600" : ""
            }`}
          >
            MTN MoMo
          </button>

          <button
            onClick={() => setCarrier("ORANGE")}
            className={`flex-1 py-3 rounded-lg font-semibold bg-orange-300 ${
              carrier === "ORANGE" ? "ring-4 ring-orange-600" : ""
            }`}
          >
            Orange Money
          </button>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={!phoneValid || !emailValid || loading}
          className={`w-full mt-6 py-3 rounded-lg text-white text-lg font-bold ${
            loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Processing…" : `Pay ${amount} XAF`}
        </button>
      </div>
    </div>
  );
}
