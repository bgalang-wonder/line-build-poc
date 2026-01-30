'use client';

import { CopilotKit } from '@copilotkit/react-core';
import '@copilotkit/react-ui/styles.css';

interface CopilotKitProviderProps {
  children: React.ReactNode;
  runtimeUrl?: string;
}

export function CopilotKitProvider({
  children,
  runtimeUrl = '/api/copilotkit'
}: CopilotKitProviderProps) {
  return (
    <CopilotKit runtimeUrl={runtimeUrl}>
      {children}
    </CopilotKit>
  );
}
