import type { ReactNode } from "react";
import { CounsellorShell } from "../../components/counsellor-shell";

export default function CounsellorLayout({ children }: { children: ReactNode }) {
  return <CounsellorShell>{children}</CounsellorShell>;
}
