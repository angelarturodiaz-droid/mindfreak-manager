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
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--brand-border)" }}
            stroke="var(--brand-muted)"
          />
          <YAxis
            fontSize={12}
            tickFormatter={(v) => formatMoney(v)}
            width={84}
            tickLine={false}
            axisLine={false}
            stroke="var(--brand-muted)"
          />
          <Tooltip
            formatter={(value) => formatMoney(Number(Array.isArray(value) ? value[0] : value))}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--brand-border)",
              boxShadow: "var(--shadow-md)",
              fontSize: 13,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Line
            type="monotone"
            dataKey="cobros"
            name="Cobros"
            stroke="var(--chart-2)"
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--chart-2)" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="pagos"
            name="Pagos"
            stroke="var(--chart-4)"
            strokeWidth={2.5}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--chart-4)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
