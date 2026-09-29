"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

type Point = { month: string; cobros: number; pagos: number };

function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAxis(amount: number) {
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function FinancialFlowChart({ data }: { data: Point[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="flow-cobros" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-success)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand-success)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="flow-pagos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-danger)" stopOpacity={0.1} />
              <stop offset="100%" stopColor="var(--brand-danger)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="month"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "var(--brand-border)" }}
            stroke="var(--brand-muted)"
          />
          <YAxis
            fontSize={11}
            tickFormatter={(v) => formatAxis(Number(v))}
            width={48}
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
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="cobros"
            name="Cobros"
            stroke="var(--brand-success)"
            strokeWidth={2.5}
            fill="url(#flow-cobros)"
            dot={{ r: 3, strokeWidth: 0, fill: "var(--brand-success)" }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="pagos"
            name="Pagos"
            stroke="var(--brand-danger)"
            strokeWidth={2}
            fill="url(#flow-pagos)"
            dot={{ r: 3, strokeWidth: 0, fill: "var(--brand-danger)" }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
