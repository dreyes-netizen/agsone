import { describe, expect, it, vi } from "vitest";

// Mock the Firebase client module since it can't initialize in Node environment
vi.mock("@/lib/firebase/client", () => ({
  auth: {},
}));

import { extractErrorMessage } from "./useApiClient";

describe("extractErrorMessage", () => {
  it("returns a plain string error as-is", () => {
    expect(extractErrorMessage({ error: "Alexa: This doesn't meet our community guidelines." }, 400))
      .toBe("Alexa: This doesn't meet our community guidelines.");
  });

  it("extracts the first fieldErrors message from a zod flatten() shape", () => {
    const err = { error: { formErrors: [], fieldErrors: { title: ["Title is required"] } } };
    expect(extractErrorMessage(err, 400)).toBe("Title is required");
  });

  it("falls back to formErrors when fieldErrors is empty", () => {
    const err = { error: { formErrors: ["Something is wrong"], fieldErrors: {} } };
    expect(extractErrorMessage(err, 400)).toBe("Something is wrong");
  });

  it("uses the message field when error is missing entirely", () => {
    expect(extractErrorMessage({ message: "custom failure" }, 500)).toBe("custom failure");
  });

  it("falls back to a generic message for an unrecognized error shape", () => {
    expect(extractErrorMessage({}, 400)).toBe("Request failed (400)");
  });

  it("falls back to a generic message when fieldErrors and formErrors are both empty", () => {
    const err = { error: { formErrors: [], fieldErrors: {} } };
    expect(extractErrorMessage(err, 422)).toBe("Request failed (422)");
  });
});
