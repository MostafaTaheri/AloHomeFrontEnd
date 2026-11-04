import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CurrentUserLabel } from "./current-user";

describe("CurrentUserLabel", () => {
  it("shows the name next to the mobile", () => {
    render(<CurrentUserLabel fullName="Sara Ahmadi" phoneNumber="+989121234567" />);
    const label = screen.getByTestId("current-user");
    expect(label.textContent).toContain("Sara Ahmadi");
    expect(label.textContent).toContain("+989121234567");
  });

  it("shows only the mobile when the user has no name", () => {
    render(<CurrentUserLabel fullName={null} phoneNumber="+989121234567" />);
    expect(screen.getByTestId("current-user").textContent).toBe("+989121234567");
  });

  it("renders nothing without a name or a mobile", () => {
    const { container } = render(<CurrentUserLabel fullName="  " phoneNumber={null} />);
    expect(container.firstChild).toBeNull();
  });
});
