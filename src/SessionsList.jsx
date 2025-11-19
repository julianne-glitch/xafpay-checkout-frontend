import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export default function SessionsList() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/sessions.php`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === "ok") setSessions(data.data);
      })
      .catch(() => console.error("Failed to load sessions"));
  }, []);

  return (
    <div className="mt-8 bg-white p-4 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-3">Recent Sessions</h2>
      {sessions.length > 0 ? (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="border-b pb-2">
              <span className="font-bold">{s.carrier_code}</span> — {s.amount} {s.currency}
              <span className="text-gray-500 text-sm"> ({s.status})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No sessions found.</p>
      )}
    </div>
  );
}
