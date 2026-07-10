"use client";

import { useState } from "react";

const STORAGE_KEY = "disclaimer_dismissed";

const DISCLAIMER_TEXT =
  "Data pemadaman di aplikasi ini diekstrak dari poster PLN menggunakan bantuan AI (kecerdasan buatan). Proses ekstraksi ini sudah melalui pemeriksaan admin sebelum tayang, namun tetap ada kemungkinan kekeliruan. Mohon gunakan data ini sebagai referensi, bukan acuan mutlak, dan silakan konfirmasi ke PLN untuk kepastian.";

function getInitialOpenState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return !localStorage.getItem(STORAGE_KEY);
}

export function DisclaimerModal() {
  const [isOpen, setIsOpen] = useState(getInitialOpenState);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setIsOpen(false);
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl"
      >
        <h2
          id="disclaimer-title"
          className="text-lg font-semibold text-gray-50"
        >
          Penting untuk Diketahui
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-gray-400">
          {DISCLAIMER_TEXT}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-6 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Mengerti
        </button>
      </div>
    </div>
  );
}
