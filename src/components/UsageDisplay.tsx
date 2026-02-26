import React from "react";
import { Text } from "ink";
import type { UsageData } from "../lib/types.js";
import { calcExpected, resetTimeLocal } from "../lib/format.js";
import { Bar, budgetColor } from "./Bar.js";

const WINDOW_5H = 5 * 3600;
const WINDOW_7D = 7 * 24 * 3600;
const SEP = " │ ";

interface UsageDisplayProps {
  usage: UsageData | undefined;
  stale: boolean;
}

export function UsageDisplay({ usage, stale }: UsageDisplayProps) {
  const stalePrefix = stale ? <Text dimColor>~</Text> : null;

  if (!usage) {
    return (
      <>
        {stalePrefix}
        <Text>🕐 ?</Text>
        <Text dimColor>{SEP}</Text>
        <Text>📅 ?</Text>
      </>
    );
  }

  const h5 = usage.five_hour;
  const d7 = usage.seven_day;
  const h5v = h5?.utilization != null ? Math.floor(h5.utilization) : null;
  const d7v = d7?.utilization != null ? Math.floor(d7.utilization) : null;

  if (h5v === null && d7v === null) {
    return (
      <>
        {stalePrefix}
        <Text>🕐 ?</Text>
        <Text dimColor>{SEP}</Text>
        <Text>📅 ?</Text>
      </>
    );
  }

  const h5Exp = calcExpected(h5?.resets_at, WINDOW_5H);
  const d7Exp = calcExpected(d7?.resets_at, WINDOW_7D, true);
  const resetTime = resetTimeLocal(h5?.resets_at);

  return (
    <>
      {stalePrefix}
      {h5v !== null ? (
        <>
          <Text>🕐 </Text>
          <Bar value={h5v} color={budgetColor(h5v, h5Exp)} cutoff={h5Exp} />
          <Text color={budgetColor(h5v, h5Exp)}> {h5v}</Text>
          <Text> ({h5Exp !== null ? Math.floor(h5Exp) : "?"})</Text>
        </>
      ) : (
        <Text>🕐 ?</Text>
      )}
      {resetTime && <Text> → {resetTime}</Text>}
      <Text dimColor>{SEP}</Text>
      {d7v !== null ? (
        <>
          <Text>📅 </Text>
          <Bar value={d7v} color={budgetColor(d7v, d7Exp)} cutoff={d7Exp} />
          <Text color={budgetColor(d7v, d7Exp)}> {d7v}</Text>
          <Text> ({d7Exp !== null ? Math.floor(d7Exp) : "?"})</Text>
        </>
      ) : (
        <Text>📅 ?</Text>
      )}
    </>
  );
}
