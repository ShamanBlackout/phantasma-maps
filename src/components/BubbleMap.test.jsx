import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BubbleMap from "./BubbleMap";

const canvasContext = {
  arc: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  lineTo: vi.fn(),
  moveTo: vi.fn(),
  setTransform: vi.fn(),
  stroke: vi.fn(),
};
const originalCanvasGetContext = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "getContext",
);
const originalPointerEvent = window.PointerEvent;
const originalResizeObserver = global.ResizeObserver;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

describe("BubbleMap canvas renderer", () => {
  beforeEach(() => {
    window.PointerEvent = class PointerEventMock extends MouseEvent {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "mouse";
      }
    };
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => canvasContext),
    });
    global.ResizeObserver = class ResizeObserverMock {
      observe() {}
      disconnect() {}
    };
    window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
    window.cancelAnimationFrame = (frame) => window.clearTimeout(frame);
    Object.values(canvasContext).forEach((method) => method.mockClear());
  });

  afterEach(() => {
    if (originalCanvasGetContext) {
      Object.defineProperty(
        HTMLCanvasElement.prototype,
        "getContext",
        originalCanvasGetContext,
      );
    } else {
      delete HTMLCanvasElement.prototype.getContext;
    }
    window.PointerEvent = originalPointerEvent;
    if (originalResizeObserver) {
      global.ResizeObserver = originalResizeObserver;
    } else {
      delete global.ResizeObserver;
    }
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("draws the graph on a canvas and supports keyboard node selection", async () => {
    const onNodeClick = vi.fn();
    const nodes = [
      { id: "wallet-a", label: "Wallet A", value: 80, type: "dominant" },
      { id: "wallet-b", label: "Wallet B", value: 20, type: "minor" },
    ];
    const links = [{ source: "wallet-a", target: "wallet-b" }];
    const { rerender, unmount } = render(
      <BubbleMap
        nodes={nodes}
        links={links}
        onNodeClick={onNodeClick}
        onNodeHover={vi.fn()}
        selectedNodeId={null}
        currentSupply={100}
        colorTheme="dark"
      />,
    );
    const canvas = screen.getByRole("application", {
      name: /interactive wallet graph/i,
    });

    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith("2d");
    await waitFor(() => {
      expect(canvasContext.arc).toHaveBeenCalled();
      expect(canvasContext.moveTo).toHaveBeenCalled();
    });

    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "Enter" });
    expect(onNodeClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "wallet-a" }),
    );
    const simulation = canvas.__simulation;
    rerender(
      <BubbleMap
        nodes={nodes}
        links={links}
        onNodeClick={onNodeClick}
        onNodeHover={vi.fn()}
        selectedNodeId={null}
        currentSupply={200}
        colorTheme="dark"
      />,
    );
    expect(canvas.__simulation).toBe(simulation);

    onNodeClick.mockClear();
    const targetNode = canvas.__graphData.nodes[0];
    fireEvent.pointerDown(canvas, {
      button: 0,
      clientX: targetNode.x,
      clientY: targetNode.y,
      pointerId: 1,
      pointerType: "mouse",
    });
    fireEvent.pointerUp(canvas, {
      clientX: targetNode.x,
      clientY: targetNode.y,
      pointerId: 1,
      pointerType: "mouse",
    });
    expect(onNodeClick).toHaveBeenCalledWith(targetNode);
    unmount();
  });
});
