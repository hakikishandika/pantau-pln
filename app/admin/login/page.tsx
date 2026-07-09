"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(
          error.message === "Invalid login credentials"
            ? "Email atau password salah. Silakan coba lagi."
            : `Login gagal: ${error.message}`,
        );
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setErrorMessage(
        "Koneksi gagal. Periksa internet Anda dan coba lagi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
            Login Admin
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Pantau Pemadaman PLN Banjarbaru
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-800"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-800"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isLoading}
              className="mt-1.5 block w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 outline-none ring-blue-500 focus:border-blue-500 focus:ring-2 disabled:cursor-not-allowed disabled:bg-zinc-50"
              placeholder="••••••••"
            />
          </div>

          {errorMessage && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isLoading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden="true"
                />
                Memproses...
              </>
            ) : (
              "Masuk"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
