import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it } from "vitest";
import { Alert, CursorPagination, EmptyState, LoadingSkeleton, StatusBadge } from "./admin-ui";

describe("Control Centre accessible primitives", () => {
  it("renders semantic loading, empty and error states", () => {
    const loading = renderToStaticMarkup(<LoadingSkeleton rows={2} />);
    const empty = renderToStaticMarkup(
      <EmptyState title="No users" description="Try another filter." />,
    );
    const alert = renderToStaticMarkup(<Alert>Access failed.</Alert>);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('aria-label="Loading"');
    expect(empty).toContain("No users");
    expect(alert).toContain('role="alert"');
  });

  it("exposes deterministic pagination controls and readable statuses", () => {
    const pagination = renderToStaticMarkup(
      <CursorPagination
        canGoBack={false}
        hasNext={true}
        onBack={() => undefined}
        onNext={() => undefined}
      />,
    );
    const status = renderToStaticMarkup(<StatusBadge value="BLOCKED_CONFIGURATION" />);
    expect(pagination).toContain('aria-label="Pagination"');
    expect(pagination).toContain("disabled");
    expect(status).toContain("BLOCKED CONFIGURATION");
  });
});
