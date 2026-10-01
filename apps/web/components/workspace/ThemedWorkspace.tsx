"use client";

import { ThemeProvider } from "../theme/ThemeProvider";
import { Workspace } from "./Workspace";

export function ThemedWorkspace() {
  return (
    <ThemeProvider>
      <Workspace />
    </ThemeProvider>
  );
}
