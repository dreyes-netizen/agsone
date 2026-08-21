import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArcadeChampionships } from "./ArcadeChampionships";

describe("ArcadeChampionships", () => {
  it("renders company and department wins from the same week as distinct weekly arcade championships", () => {
    const html = renderToStaticMarkup(
      createElement(ArcadeChampionships, {
        championships: [
          {
            id: "company-win",
            gameType: "TYPING",
            scope: "COMPANY",
            departmentNameSnapshot: null,
            weekStart: "2026-08-17T00:00:00.000Z",
            primaryScore: 82,
            secondaryScore: 9_750,
          },
          {
            id: "department-win",
            gameType: "TYPING",
            scope: "DEPARTMENT",
            departmentNameSnapshot: "Operations",
            weekStart: "2026-08-17T00:00:00.000Z",
            primaryScore: 82,
            secondaryScore: 9_750,
          },
        ],
      }),
    );

    expect(html).toContain("Weekly arcade championships");
    expect(html).toContain("Company Champion");
    expect(html).toContain("Operations Department Champion");
    expect(html.match(/Typing Sprint/g)).toHaveLength(2);
    expect(html.match(/Company scope/g)).toHaveLength(1);
    expect(html.match(/Department scope/g)).toHaveLength(1);
    expect(html.match(/week of Aug 17, 2026/g)).toHaveLength(2);
    expect(html.match(/82 WPM/g)).toHaveLength(2);
    expect(html).not.toContain("AGS Points");
    expect(html).not.toContain("performance award");
  });
});
