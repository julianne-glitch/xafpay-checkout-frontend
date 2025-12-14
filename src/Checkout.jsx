import React, { useState, useEffect, useRef } from "react";

export default function Checkout() {
  const url = new URL(window.location.href);

  // ****************************************************
  // READ VALUES SENT FROM WOOCOMMERCE
  // ****************************************************
  const orderId = url.searchParams.get("order_id");
  const amountFromWC = Number(url.searchParams.get("amount"));
  const returnUrl = url.searchParams.get("return_url") || "/";

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
    async function ping() {
      try {
        const r = await fetch(`${API_BASE}/health.php`);
        setBackendStatus(r.ok ? "🟢 Backend Connected" : "🟠 Partial Connectivity");
      } catch {
        setBackendStatus("🔴 Backend Offline");
      }
    }
    ping();
  }, []);

  // ****************************************************
  // EMAIL VALIDATION
  // ****************************************************
  useEffect(() => {
    if (!email) return setEmailError("");

    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setEmailError(valid ? "" : "Enter a valid email");
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
  // POLLING FOR PAYMENT STATUS
  // ****************************************************
  const startPolling = (xfOrderId) => {
    polling.current = true;
    pollAttempts.current = 0;

    const poll = async () => {
      if (!polling.current) return;

      pollAttempts.current++;

      if (pollAttempts.current > 15) {
        polling.current = false;
        setStatus("⚠ Payment taking longer than expected. Check your phone.");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/check_payment.php?order_id=${xfOrderId}`);
        const data = await res.json();

        if (!data.ok) return;

        const st = (data.status || "").toUpperCase();

        // SUCCESS → Redirect immediately
        if (["SUCCESS", "SUCCESSFUL", "COMPLETED", "PAID"].includes(st)) {
          polling.current = false;
          setStatus("✅ Payment Successful!");
          window.location.href = returnUrl;
          return;
        }

        // FAIL
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
  // HANDLE PAY BUTTON CLICK
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
          phone: phoneNumber,
          email,
          carrier,
          wc_order_id: orderId, // ESSENTIAL FIX
        }),
      });

      const raw = await res.text();
      let data;

      try {
        data = JSON.parse(raw);
      } catch {
        setStatus("❌ Invalid server response. Please retry.");
        setLoading(false);
        return;
      }

      if (!data.ok) {
        setStatus("❌ " + (data.error || "Payment Error"));
        setLoading(false);
        return;
      }

      setStatus("🔁 Check your phone to approve the payment…");
      startPolling(data.order_id);

    } catch (err) {
      setStatus("❌ Network error. Check your connection.");
    }

    setLoading(false);
  };

  // ****************************************************
  // UI
  // ****************************************************
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">

        {/* LOGO + STATUS */}
        <div className="text-center mb-6">
          <img src="/logo.jpg" className="h-16 mx-auto mb-3" />
          <h1 className="text-2xl font-bold">XafPay Secure Checkout</h1>
          <p className="text-gray-500 text-sm mt-1">{backendStatus}</p>
        </div>

        {/* STATUS BOX */}
        {status && (
          <div className={`p-3 mb-4 rounded-lg text-sm ${
            status.startsWith("❌")
              ? "bg-red-100 text-red-700"
              : status.startsWith("⚠")
              ? "bg-yellow-100 text-yellow-700"
              : "bg-green-100 text-green-700"
          }`}>
            {status}
          </div>
        )}

        {/* AMOUNT (LOCKED) */}
        <div className="mb-4">
          <label>Amount Due (XAF)</label>
          <input
            value={amount}
            disabled
            className="w-full border p-3 rounded bg-gray-100 font-semibold"
          />
          <p className="text-xs text-gray-500 mt-1">
            This amount is from your WooCommerce order.
          </p>
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
            className={`flex-1 py-3 rounded-lg font-semibold ${
              carrier === "MTN"
                ? "bg-yellow-500 ring-4 ring-yellow-700"
                : "bg-yellow-300"
            }`}
          >
            MTN MoMo
          </button>

          <button
            onClick={() => setCarrier("ORANGE")}
            className={`flex-1 py-3 rounded-lg font-semibold ${
              carrier === "ORANGE"
                ? "bg-orange-400 ring-4 ring-orange-600"
                : "bg-orange-200"
            }`}
          >
            Orange Money
          </button>
        </div>

        {/* PAY BUTTON */}
        <button
          onClick={handlePay}
          disabled={!phoneValid || !emailValid || loading}
          className={`w-full mt-6 py-3 rounded-lg text-white text-xl font-bold ${
            loading ? "bg-gray-400" : "bg-red-600 hover:bg-red-700"
          }`}
        >
          {loading ? "Processing…" : `Pay ${amount} XAF`}
        </button>

      </div>
    </div>
  );
}
