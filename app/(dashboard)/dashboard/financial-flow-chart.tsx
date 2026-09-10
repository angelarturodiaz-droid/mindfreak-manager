"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Point = { month: string; cobros: number; pagos: number };

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FinancialFlowChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full max-w-3xl">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" fontSize={12} />
          <YAxis fontSize={12} tickFormatter={(v) => formatMoney(v)} width={80} />
          <Tooltip
            formatter={(value) => formatMoney(Number(Array.isArray(value) ? value[0] : value))}
          />
          <Legend />
          <Line type="monotone" dataKey="cobros" name="Cobros" stroke="#17a6b8" strokeWidth={2} />
          <Line type="monotone" dataKey="pagos" name="Pagos" stroke="#dc2626" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
