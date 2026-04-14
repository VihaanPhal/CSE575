"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  contentStyle: {
    background: "#fff",
    border: "1px solid #dbe3f4",
    borderRadius: 18,
    boxShadow: "0 20px 45px rgba(30, 64, 175, 0.12)",
  },
  labelStyle: {
    color: "#0f172a",
    fontWeight: 600,
  },
};

export function DistributionChart({ data, height = 260, color = "#1d4ed8" }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="rating" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey="count" fill={color} radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({
  data,
  height = 260,
  dataKey = "averageRating",
  yDomain = ["auto", "auto"],
  color = "#0f766e",
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis domain={yDomain} tick={{ fill: "#64748b", fontSize: 12 }} />
        <Tooltip {...tooltipStyle} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={3}
          dot={{ fill: color, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GenreRadarChart({ data, height = 300 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="#dbe3f4" />
        <PolarAngleAxis dataKey="genre" tick={{ fill: "#475569", fontSize: 11 }} />
        <PolarRadiusAxis tick={{ fill: "#94a3b8", fontSize: 10 }} domain={[0, 5]} />
        <Radar
          name="Preference"
          dataKey="averageRating"
          stroke="#1d4ed8"
          fill="#3b82f6"
          fillOpacity={0.18}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function GenreBarChart({ data, dataKey = "totalRatings", height = 320 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} />
        <YAxis
          type="category"
          dataKey="genre"
          width={88}
          tick={{ fill: "#475569", fontSize: 11 }}
        />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={dataKey} radius={[0, 12, 12, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.genre}
              fill={dataKey === "averageRating" ? "#f59e0b" : "#1d4ed8"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
