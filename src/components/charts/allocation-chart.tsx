'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = [
  '#4F8EF7', '#10B981', '#a78bfa', '#f59e0b', '#F43F5E',
  '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#8b5cf6',
]

interface DataPoint {
  name: string
  value: number
}

export function AllocationChart({ data }: { data: DataPoint[] }) {
  const normalizedData = useMemo(
    () =>
      data
        .map((point) => ({
          name: point.name,
          value: typeof point.value === 'number' ? point.value : Number(point.value),
        }))
        .filter((point) => Number.isFinite(point.value) && point.value > 0),
    [data]
  )

  if (!normalizedData.length) {
    return (
      <div className="h-[220px] w-full flex items-center justify-center text-xs text-white/40 border border-white/10 rounded-xl bg-white/[0.02]">
        No allocation data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={normalizedData}
          cx="50%"
          cy="50%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {normalizedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: 'rgba(10,10,15,0.95)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            color: 'white',
            fontSize: '12px',
          }}
          formatter={(value) => [`${Number(value).toFixed(1)}%`, '']}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
