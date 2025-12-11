import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const url = new URL(window.location.href);

  // ⭐ READ VALUES SENT FROM WOOCOMMERCE
  const orderId = url.searchParams.get("order_id");
  const amountFromWC = Number(url.searchParams.get("amount")); // locked amount
  const returnUrl = url.searchParams.get("return_url") || "/";

  const [amount, setAmount] = useState(amountFromWC);
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
  const tranzakOrderId = useRef(null);

  // ------------------------------------------------------------
  // BACKEND HEALTH CHECK
  // ------------------------------------------------------------
  useEffect(() => {
    async function ping() {
      try {
        const r = await fetch(`${API_BASE}/health.php`);
        setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Partial Connectivity");
      } catch {
        setBackendStatus("🔴 Backend Offline");
      }
    }
    ping();
  }, [API_BASE]);

  // ------------------------------------------------------------
  // EMAIL VALIDATION
  // ------------------------------------------------------------
  useEffect(() => {
    if (!email) return setEmailError("");

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setEmailError(valid ? "" : "Invalid email format");
  }, [email]);

  const emailValid = email && emailError === "";

  // ------------------------------------------------------------
  // PHONE VALIDATION
  // ------------------------------------------------------------
  useEffect(() => {
    if (!phoneNumber) return setPhoneError("");

    const clean = phoneNumber.replace(/\D/g, "");
    if (clean.length !== 9) return setPhoneError("Phone must be 9 digits");

    if (carrier === "MTN" && !/^6(5|6|7|8)/.test(clean))
      return setPhoneError("MTN numbers start with 65/66/67/68");

    if (carrier === "ORANGE" && !/^69/.test(clean))
      return setPhoneError("Orange numbers start with 69");

    setPhoneError("");
  }, [phoneNumber, carrier]);

  const phoneValid = phoneError === "" && phoneNumber.replace(/\D/g, "").length === 9;

  // ------------------------------------------------------------
  // START POLLING PAYMENT STATUS
  // ------------------------------------------------------------
  const startPolling = (xfOrderId) => {
    polling.current = true;
    pollAttempts.current = 0;
    tranzakOrderId.current = xfOrderId;

    const poll = async () => {
      if (!polling.current) return;

      pollAttempts.current++;

      if (pollAttempts.current > 20) {
        polling.current = false;
        setStatus("⚠ Payment taking long. Please check your phone.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/check_payment.php?order_id=${xfOrderId}`);
        const data = await res.json();

        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        // --------------------------
        // PAYMENT SUCCESS
        // --------------------------
        if (["SUCCESSFUL", "SUCCESS", "COMPLETED", "PAID"].includes(st)) {
          polling.current = false;

          setStatus("✅ Payment SUCCESSFUL! Redirecting…");

          // ⭐ CALL WOO WEBHOOK
          await fetch("/wp-json/xafpay/v1/webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              order_id: orderId,
              status: "SUCCESS",
              transaction_id: data.transaction_id || xfOrderId,
            }),
          });

          // ⭐ REDIRECT CUSTOMER BACK TO WOO ORDER RECEIVED PAGE
          window.location.href = returnUrl;
          return;
        }

        // --------------------------
        // FAILED / CANCELLED
        // --------------------------
        if (["FAILED", "CANCELED", "CANCELLED", "EXPIRED"].includes(st)) {
          polling.current = false;
          setStatus("❌ Payment Failed or Cancelled.");
          return;
        }
      } catch {}

      setTimeout(poll, 3000);
    };

    poll();
  };

  // ------------------------------------------------------------
  // HANDLE PAY CLICK
  // ------------------------------------------------------------
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
          phone: phoneNumber,
          email,
          carrier,
          order_id: orderId, // ⭐ NEW: link WooCommerce order to backend
        }),
      });

      const raw = await res.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        setStatus("❌ Error: Backend returned invalid JSON");
        setLoading(false);
        return;
      }

      if (!data.ok) {
        setStatus("❌ Error: " + (data.error || "Unknown"));
        setLoading(false);
        return;
      }

      // --------------------------
      // DIRECT MOMO PUSH
      // --------------------------
      setStatus("🔁 Payment Started… Check your phone.");
      startPolling(data.order_id);
    } catch (err) {
      setStatus("❌ Network error: " + err.message);
    }

    setLoading(false);
  };

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md border border-gray-100">
        
        <div className="text-center mb-6">
          <img src="/logo.jpg" className="h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm">{backendStatus}</p>
        </div>

        {status && (
          <div className={`p-3 mb-4 rounded text-sm whitespace-pre-wrap ${
            status.startsWith("❌")
              ? "bg-red-100 text-red-600 border border-red-300"
              : status.startsWith("⚠")
              ? "bg-yellow-100 text-yellow-700 border border-yellow-300"
              : "bg-green-100 text-green-700 border border-green-300"
          }`}>
            {status}
          </div>
        )}

        {/* AMOUNT (LOCKED) */}
        <div className="mb-4">
          <label>Amount Due (XAF)</label>
          <input
            type="number"
            value={amount}
            disabled
            className="w-full border p-3 rounded bg-gray-100"
          />
          <p className="text-xs text-gray-500 mt-1">Amount comes from your WooCommerce order.</p>
        </div>

        {/* EMAIL */}
        <div className="mb-4">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full border p-3 rounded ${emailError ? "border-red-500" : ""}`}
          />
          {emailError && <p className="text-red-500 text-sm">{emailError}</p>}
        </div>

        {/* PHONE */}
        <div className="mb-4">
          <label>Mobile Money Number</label>
          <input
            type="tel"
            placeholder="6XX XXX XXX"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className={`w-full border p-3 rounded ${phoneError ? "border-red-500" : ""}`}
          />
          {phoneError && <p className="text-red-500 text-sm">{phoneError}</p>}
        </div>

        {/* CARRIER SELECT */}
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

        {/* PAY BTN */}
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
