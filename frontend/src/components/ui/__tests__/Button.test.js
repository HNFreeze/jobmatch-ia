import { render, screen, fireEvent } from "@testing-library/react";
import Button from "../Button";

test("renders its label and fires onClick", () => {
  const onClick = jest.fn();
  render(<Button onClick={onClick}>Guardar</Button>);
  const btn = screen.getByRole("button", { name: "Guardar" });
  fireEvent.click(btn);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("does not fire onClick when disabled", () => {
  const onClick = jest.fn();
  render(<Button onClick={onClick} disabled>Guardar</Button>);
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
  expect(onClick).not.toHaveBeenCalled();
});
