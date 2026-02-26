import React from "react";
import { Text } from "ink";

interface ServiceBadgeProps {
  name: string;
  up: boolean;
}

export function ServiceBadge({ name, up }: ServiceBadgeProps) {
  return <Text color={up ? "green" : undefined} dimColor={!up}>▣ {name}</Text>;
}
