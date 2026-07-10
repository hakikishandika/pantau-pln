"use client";

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";

import type { AreaRankingRow } from "@/lib/public-dashboard";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export function AreaRankingChart({ ranking }: { ranking: AreaRankingRow[] }) {
  const topEight = ranking.slice(0, 8);

  if (topEight.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-sm text-gray-400 sm:px-5">
        Tidak ada data untuk chart
      </p>
    );
  }

  const data = {
    labels: topEight.map((row) =>
      row.nama.length > 28 ? `${row.nama.slice(0, 28)}…` : row.nama,
    ),
    datasets: [
      {
        label: "Total Jam",
        data: topEight.map((row) => row.total_jam),
        backgroundColor: "rgba(37, 99, 235, 0.75)",
        borderRadius: 6,
      },
    ],
  };

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#111827",
        titleColor: "#f9fafb",
        bodyColor: "#9ca3af",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(55, 65, 81, 0.5)" },
        ticks: { color: "#9ca3af" },
      },
      y: {
        grid: { display: false },
        ticks: { color: "#d1d5db", font: { size: 11 } },
      },
    },
  };

  return (
    <div className="h-72 px-4 py-4 sm:h-80 sm:px-5">
      <Bar data={data} options={options} />
    </div>
  );
}
