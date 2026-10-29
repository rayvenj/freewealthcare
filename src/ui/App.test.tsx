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

describe("templates", () => {
  it("applies the contractor template and suggests a tax set-aside from new income", async () => {
    vi.stubGlobal("confirm", () => true);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Templates & data" }));
    fireEvent.click(screen.getByRole("button", { name: "Add to my budget" }));
    expect(await screen.findByText(/Applied "1099 Contractor Starter"/)).toBeTruthy();

    // Re-applying changes nothing.
    fireEvent.click(screen.getByRole("button", { name: "Add to my budget" }));
    expect(await screen.findByText(/already in your budget/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Accounts" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Business Checking" } });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    await screen.findByText("Business Checking");

    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    fireEvent.change(screen.getByLabelText("Payee"), { target: { value: "Client invoice" } });
    fireEvent.click(screen.getByLabelText(/Money in/));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "4,000" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await screen.findByText("Client invoice");

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    expect(await screen.findByText("Quarterly Estimated Taxes")).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Assign $1,000.00" }));
    expect(await screen.findByText("Covered")).toBeTruthy();
    expect((screen.getByLabelText("Assigned to Quarterly Estimated Taxes") as HTMLInputElement).value).toBe("1000.00");
  });
});

describe("credit cards", () => {
  it("tracks what you owe and pays the card without touching the budget", async () => {
    vi.stubGlobal("confirm", () => true);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Accounts" }));

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Card Checking" } });
    fireEvent.change(screen.getByLabelText("Current balance"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    await screen.findByText("Card Checking");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Visa" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "credit" } });
    fireEvent.change(screen.getByLabelText("Amount owed"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Add account" }));
    expect(await screen.findByText("Owed $500.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    const rtaBefore = (await screen.findByText("Ready to assign")).parentElement!.textContent;

    fireEvent.click(screen.getByRole("button", { name: "Accounts" }));
    fireEvent.change(await screen.findByLabelText("Pay Visa from"), {
      target: { value: screen.getByRole("option", { name: "Card Checking" }).getAttribute("value") },
    });
    fireEvent.change(screen.getByLabelText("Payment amount for Visa"), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Pay card" }));
    expect(await screen.findByText("Owed $300.00")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Budget" }));
    expect((await screen.findByText("Ready to assign")).parentElement!.textContent).toBe(rtaBefore);

    fireEvent.click(screen.getByRole("button", { name: "Transactions" }));
    expect((await screen.findAllByText("Card Checking → Visa")).length).toBe(2);
  });
});
