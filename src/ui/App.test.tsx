import { fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("adds an account and shows its starting balance as ready to assign", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Accounts" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Checking" } });
    fireEvent.change(screen.getByLabelText("Current balance"), { target: { value: "1,500.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    const list = await screen.findByRole("list");
    expect(within(list).getByText("$1,500.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    expect(await screen.findByText("$1,500.00")).toBeTruthy();
    expect(screen.getByText("Ready to assign")).toBeTruthy();
  });
});
