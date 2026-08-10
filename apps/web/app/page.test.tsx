import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import Home from "./page";

test("renders homepage titles correctly", () => {
  render(<Home />);

  // Check main heading "PGS HUB" is rendered
  const heading = screen.getByRole("heading", { level: 1, name: /PGS HUB/i });
  expect(heading).toBeDefined();

  // Check description "Hệ thống quản trị vận hành PGS Agency" is rendered
  const description = screen.getByText(
    /Hệ thống quản trị vận hành PGS Agency/i,
  );
  expect(description).toBeDefined();
});

test("does not expose sensitive supabase credentials on homepage", () => {
  render(<Home />);

  const bodyText = document.body.innerHTML;

  // Ensure sensitive keywords are not exposed in HTML
  expect(bodyText).not.toContain("supabase.co");
  expect(bodyText).not.toContain("sb_publishable_");
  expect(bodyText).not.toContain("sb_secret_");
  expect(bodyText).not.toContain("service_role");
});
