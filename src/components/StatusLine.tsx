import React, { useEffect } from "react";
import { Box, Text, useApp, useStdout } from "ink";
import type { CacheData } from "../lib/types.js";
import { COMPACT_AT, formatTokens } from "../lib/format.js";
import { isCacheVeryStale } from "../lib/cache.js";
import { getGitInfo } from "../lib/git.js";
import { Bar, ctxColor } from "./Bar.js";
import { ServiceBadge } from "./ServiceBadge.js";
import { UsageDisplay } from "./UsageDisplay.js";

const SEP = " │ ";

interface StatusLineProps {
  model: string;
  tokensUsed: number;
  cache: CacheData | null;
}

export function StatusLine({ model, tokensUsed, cache }: StatusLineProps) {
  const app = useApp();
  const { stdout } = useStdout();
  const termWidth = stdout?.columns ?? 80;

  useEffect(() => {
    app.exit();
  }, []);

  const ctxPct = Math.min(Math.round((tokensUsed / COMPACT_AT) * 100), 100);
  const git = getGitInfo();
  const riderUp = cache?.rider_running ?? false;
  const serenaUp = cache?.serena_running ?? false;
  const stale = isCacheVeryStale(cache);

  return (
    <Box flexDirection="column" width={termWidth}>
      {/* Line 1: Model, Git, Services */}
      <Box>
        <Text color="cyan" bold>⚡ {model}</Text>
        {git && (
          <>
            <Text dimColor>{SEP}</Text>
            <Text color="cyan"> {git}</Text>
          </>
        )}
        <Text dimColor>{SEP}</Text>
        <ServiceBadge name="Rider" up={riderUp} />
        <Text dimColor>{SEP}</Text>
        <ServiceBadge name="Serena" up={serenaUp} />
      </Box>

      {/* Divider */}
      <Text dimColor>{"─".repeat(termWidth)}</Text>

      {/* Line 2: Context bar, Usage bars */}
      <Box>
        <Text>Ctx </Text>
        <Bar value={ctxPct} color={ctxColor(ctxPct)} />
        <Text> {formatTokens(tokensUsed)}</Text>
        <Text dimColor>{SEP}</Text>
        <UsageDisplay usage={cache?.usage} stale={stale} />
      </Box>

      {/* Divider */}
      <Text dimColor>{"─".repeat(termWidth)}</Text>
    </Box>
  );
}
