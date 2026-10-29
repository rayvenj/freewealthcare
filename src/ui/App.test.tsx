import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("links to the newsletter without leaking the opener or referrer", async () => {
    render(<App />);
    const link = await screen.findByRole("link", { name: "Universal WealthCare" });
    expect(link.getAttribute("href")).toBe("https://universalwealthcare.substack.com/");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps transaction history visible after the last account is archived", async () => {
    vi.stubGlobal("confirm", () => true);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Accounts" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Old Bank" } });
    fireEvent.change(screen.getByLabelText("Current balance"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    // Archive every active account (earlier tests share this browser database).
    await screen.findByText("Old Bank");
    for (let left = screen.queryAllByRole("button", { name: "Archive" }); left.length; ) {
      const before = left.length;
      fireEvent.click(left[0]!);
      await waitFor(() => expect(screen.queryAllByRole("button", { name: "Archive" }).length).toBeLessThan(before));
      left = screen.queryAllByRole("button", { name: "Archive" });
    }

    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect(await screen.findByText(/Add an account on the Accounts tab/)).toBeTruthy();
    expect(screen.getAllByText("Starting balance").length).toBeGreaterThan(0);
  });
});
