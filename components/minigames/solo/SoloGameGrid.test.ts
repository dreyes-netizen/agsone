import { createElement, type AnchorHTMLAttributes, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/hooks/useApiClient", () => ({ apiFetch: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    children: ReactNode;
    prefetch?: boolean;
  }) => createElement(
    "a",
    { ...props, "data-prefetch": String(prefetch) },
    children,
  ),
}));

import { SoloGameGrid } from "./SoloGameGrid";

describe("SoloGameGrid", () => {
  it("disables route prefetch for every solo card so sibling game routes stay demand-loaded", () => {
    const html = renderToStaticMarkup(createElement(SoloGameGrid));

    expect(html.match(/data-prefetch="false"/g)).toHaveLength(4);
  });
});
