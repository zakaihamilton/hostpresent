import { render } from "@testing-library/react";
import { ServiceWorkerRegistration } from "./ServiceWorkerRegistration";

describe("ServiceWorkerRegistration", () => {
  it("renders nothing", () => {
    const register = jest.fn().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    const { container } = render(<ServiceWorkerRegistration />);
    expect(container).toBeEmptyDOMElement();
  });
});
