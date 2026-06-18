import { render, screen } from "@testing-library/react";
import CompatibilityIndicator from "../CompatibilityIndicator";

test("shows the percentage and the high-compat tier label", () => {
  render(<CompatibilityIndicator score={82} />);
  expect(screen.getByText("82%")).toBeInTheDocument();
  expect(screen.getByText("Compatibilidad alta")).toBeInTheDocument();
});

test("exposes an accessible progressbar with the score", () => {
  render(<CompatibilityIndicator score={60} />);
  const bar = screen.getByRole("progressbar");
  expect(bar).toHaveAttribute("aria-valuenow", "60");
  expect(screen.getByText("Compatibilidad media")).toBeInTheDocument();
});

test("clamps and labels a low score", () => {
  render(<CompatibilityIndicator score={10} />);
  expect(screen.getByText("Compatibilidad baja")).toBeInTheDocument();
});
