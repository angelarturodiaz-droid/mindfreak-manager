"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/**
 * Barras agrupadas genéricas para la sección de Comparaciones — misma
 * paleta y estilo que app/(dashboard)/dashboard/financial-flow-chart.tsx,
 * pero reutilizable para cualquier par/tripleta de series (ingresos vs
 * gastos, ventas vs cobros, actual vs anterior, etc.).
 */
export function ComparisonBarChart({
  data,
  xKey,
  bars,
  height = 280,
  formatValue,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  bars: { key: string; name: string; color: string }[];
  height?: number;
  formatValue: (v: number) => string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey={xKey}
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--brand-border)" }}
            stroke="var(--brand-muted)"
            interval={0}
            angle={data.length > 5 ? -20 : 0}
            textAnchor={data.length > 5 ? "end" : "middle"}
            height={data.length > 5 ? 50 : 30}
          />
          <YAxis
            fontSize={12}
            tickFormatter={(v) => formatValue(Number(v))}
            width={84}
            tickLine={false}
            axisLine={false}
            stroke="var(--brand-muted)"
          />
          <Tooltip
            formatter={(value) => formatValue(Number(Array.isArray(value) ? value[0] : value))}
            contentStyle={{
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--brand-border)",
              boxShadow: "var(--shadow-md)",
              fontSize: 13,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
