import "./style.css";

interface StickerData {
  id: string;
  text: string;
  isCustom: boolean;
}

const availableStickers: StickerData[] = [
  { id: "poo", text: "💩", isCustom: false },
  { id: "toilet", text: "🚽", isCustom: false },
  { id: "drop", text: "💧", isCustom: false },
];

let isDrawing = false;
let currentStroke: MarkerLine | StickerCommand | null = null;
let lines: Command[] = [];
let redoStack: Command[] = [];
let currentThickness: number = 2; //defaulted to thick lines (2)
let currentColor: string = "black"; // default to "black"
let currentRotation: number = 0; // default to 0 degrees
let currentPreview: ToolPreview | null = null;
let currentMousePos: Point | null = null;
let currentTool: "marker" | "sticker" = "marker";
let currentSticker: string = availableStickers[0]!.text;
const STICKER_SIZE = 30; //default (30) for rendering sticker

const HIGH_RES_SIZE = 1024;
const BASE_SIZE = 256;
const SCALE_FACTOR = HIGH_RES_SIZE / BASE_SIZE; // Should result in 4x size

interface Command {
  display(ctx: CanvasRenderingContext2D): void;
}

interface Point {
  x: number;
  y: number;
}

class MarkerLine implements Command {
  private points: Point[] = [];
  private lineWidth: number;
  private color: string;

  constructor(initialPoint: Point, lineWidth: number, color: string) {
    this.points.push(initialPoint);
    this.lineWidth = lineWidth;
    this.color = color;
  }

  public drag(x: number, y: number): void {
    this.points.push({ x, y });
  }

  public display(ctx: CanvasRenderingContext2D): void {
    const stroke = this.points;

    if (stroke.length === 0) return;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const startPoint = stroke[0];
    if (!startPoint) return;

    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
    }
    ctx.stroke();
    ctx.closePath();
  }
}

class StickerCommand implements Command {
  private x: number;
  private y: number;
  private text: string;
  private rotation: number;

  constructor(x: number, y: number, text: string, rotation: number) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.rotation = rotation;
  }

  public drag(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);

    ctx.font = `${STICKER_SIZE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

class ToolPreview implements Command {
  private x: number;
  private y: number;
  public toolType: "marker" | "sticker";
  public thicknessOrText: number | string;
  public color?: string;
  public rotation?: number;

  constructor(
    x: number,
    y: number,
    toolType: "marker" | "sticker",
    thicknessOrText: number | string,
    color?: string,
    rotation?: number,
  ) {
    this.x = x;
    this.y = y;
    this.toolType = toolType;
    this.thicknessOrText = thicknessOrText;
    this.color = color!;
    this.rotation = rotation!;
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (this.toolType === "marker") {
      const radius = (this.thicknessOrText as number) / 2;
      ctx.fillStyle = this.color || "black";
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();
    } else { // 'sticker'
      const text = this.thicknessOrText as string;

      ctx.save();
      ctx.globalAlpha = 0.5; // Make the preview slightly transparent
      if (this.rotation !== undefined && this.rotation !== 0) {
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
      }
      ctx.font = `${STICKER_SIZE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const drawX = (this.rotation !== undefined && this.rotation !== 0)
        ? 0
        : this.x;
      const drawY = (this.rotation !== undefined && this.rotation !== 0)
        ? 0
        : this.y;
      ctx.fillText(text, drawX, drawY);

      ctx.restore();
    }
  }
}

document.body.innerHTML = `
  <h1>Super Duper Sticker Board++</h1>
  <canvas id ="myCanvas" width = "256" height = "256"></canvas>
  <div class="controls">
    <div class="tool-group">
      <label>Marker:</label>
      <button id="toolThin">Thin</button>
      <button id="toolNormal">Normal</button>
      <button id="toolThick">Thick</button>
      <div class="color-picker-control">
        <input type="color" id="colorPicker" value="#000000">
        <label for="colorPicker">Color:</label>
      </div>
    </div>
    <div class="tool-group" id="rotation-group"> 
      <label for="rotationSlider">Rotation: <span id="rotationValue">0</span>°</label>
      <input type="range" id="rotationSlider" min="0" max="360" value="0">
    </div>

    <div class="tool-group">
      <label>Stickers:</label>
      <div id="stickerButtonContainer"></div> 
      <button id="customStickerButton">+ Custom</button>
    </div>
    <button id="undoButton">Undo</button>
    <button id="redoButton">Redo</button>
    <button id="clearButton">Clear</button>
    <button id="exportButton">Export Image</button>
  </div>
`;

const myCanvas = document.getElementById("myCanvas") as HTMLCanvasElement;
const ctx = myCanvas.getContext("2d") as CanvasRenderingContext2D;
const undoButton = document.getElementById("undoButton") as HTMLButtonElement;
const redoButton = document.getElementById("redoButton") as HTMLButtonElement;
const clearButton = document.getElementById("clearButton") as HTMLButtonElement;
const toolThinButton = document.getElementById("toolThin") as HTMLButtonElement;
const toolNormalButton = document.getElementById(
  "toolNormal",
) as HTMLButtonElement;
const toolThickButton = document.getElementById(
  "toolThick",
) as HTMLButtonElement;
const colorPicker = document.getElementById("colorPicker") as HTMLInputElement;
const stickerButtonContainer = document.getElementById(
  "stickerButtonContainer",
) as HTMLDivElement;
const customStickerButton = document.getElementById(
  "customStickerButton",
) as HTMLButtonElement;
const exportButton = document.getElementById(
  "exportButton",
) as HTMLButtonElement;
const rotationSlider = document.getElementById(
  "rotationSlider",
) as HTMLInputElement;
const rotationValueSpan = document.getElementById(
  "rotationValue",
) as HTMLSpanElement;
const rotationGroup = document.getElementById(
  "rotation-group",
) as HTMLDivElement;

let toolButtons: HTMLButtonElement[] = [
  toolThinButton,
  toolNormalButton,
  toolThickButton,
  customStickerButton,
];

function updateRotationDisplay() {
  rotationValueSpan.textContent = currentRotation.toString();
}

function updateToolVisibility() {
  rotationGroup.style.display = currentTool === "sticker" ? "flex" : "none";
}

function setSelectedTool(
  tool: "marker" | "sticker",
  value: number | string,
  selectedButton: HTMLButtonElement,
) {
  currentTool = tool;

  if (tool === "marker") {
    currentThickness = value as number;
  } else {
    currentSticker = value as string;
  }

  updateToolVisibility();

  toolButtons.forEach((btn) => btn.classList.remove("selectedTool"));

  selectedButton.classList.add("selectedTool");

  if (currentMousePos) {
    if (currentTool === "marker") {
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        "marker",
        currentThickness,
        currentColor,
      );
    } else {
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        "sticker",
        currentSticker,
        undefined,
        currentRotation,
      );
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function createStickerButtons() {
  stickerButtonContainer.innerHTML = "";

  toolButtons = toolButtons.filter((btn) =>
    !btn.classList.contains("sticker-tool")
  );

  availableStickers.forEach((sticker) => {
    const button = document.createElement("button");
    button.id = `tool${sticker.id}`;
    button.textContent = sticker.text;
    button.classList.add("sticker-tool");

    button.addEventListener("click", () => {
      setSelectedTool("sticker", sticker.text, button);
    });

    stickerButtonContainer.appendChild(button);
    toolButtons.push(button);
  });
}

function handleCustomSticker() {
  const stickerText = prompt("Enter text for your custom sticker:", "✨");

  if (stickerText && stickerText.trim().length > 0) {
    const newSticker: StickerData = {
      id: `custom${Date.now()}`,
      text: stickerText.trim().substring(0, 3),
      isCustom: true,
    };

    availableStickers.push(newSticker);

    createStickerButtons();

    const newButton = document.getElementById(
      `tool${newSticker.id}`,
    ) as HTMLButtonElement;
    if (newButton) {
      setSelectedTool("sticker", newSticker.text, newButton);
    }
  } else if (stickerText !== null) {
    alert("Sticker text cannot be empty.");
  }
}

function handleExport() {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = HIGH_RES_SIZE;
  exportCanvas.height = HIGH_RES_SIZE;
  const exportCtx = exportCanvas.getContext("2d");

  if (!exportCtx) {
    console.error("Could not get context for export canvas.");
    return;
  }

  exportCtx.fillStyle = "white";
  exportCtx.fillRect(0, 0, HIGH_RES_SIZE, HIGH_RES_SIZE);

  exportCtx.scale(SCALE_FACTOR, SCALE_FACTOR);

  replayCommands(exportCtx, false);

  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad-highres.png";
  anchor.click();
}

function replayCommands(
  context: CanvasRenderingContext2D,
  includePreview: boolean,
) {
  for (const command of lines) {
    command.display(context);
  }

  if (includePreview && !isDrawing && currentPreview) {
    currentPreview.display(context);
  }
}

function redrawCanvas() {
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
  replayCommands(ctx, true);
  updateButtonStates();
}

function updateButtonStates() {
  undoButton.disabled = lines.length === 0;
  redoButton.disabled = redoStack.length === 0;
}

function undoStroke() {
  if (lines.length > 0) {
    const undoneStroke = lines.pop();

    if (undoneStroke) {
      redoStack.push(undoneStroke);
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function redoStroke() {
  if (redoStack.length > 0) {
    const redoneStroke = redoStack.pop();

    if (redoneStroke) {
      lines.push(redoneStroke);
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function handleStartDrawing(x: number, y: number) {
  redoStack = [];
  isDrawing = true;

  let newCommand: Command;

  if (currentTool === "marker") {
    newCommand = new MarkerLine({ x, y }, currentThickness, currentColor);
  } else { // 'sticker'
    newCommand = new StickerCommand(x, y, currentSticker, currentRotation);
  }

  currentStroke = newCommand as (MarkerLine | StickerCommand);
  lines.push(newCommand);

  currentPreview = null; // Hide preview while drawing

  myCanvas.dispatchEvent(new Event("drawing-changed"));
}

function handleDrawing(x: number, y: number) {
  if (isDrawing && currentStroke) {
    currentStroke.drag(x, y);
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }

  currentMousePos = { x, y };

  if (!isDrawing) {
    const value: number | string = currentTool === "marker"
      ? currentThickness
      : currentSticker;

    const color = currentTool === "marker" ? currentColor : undefined;
    const rotation = currentTool === "sticker" ? currentRotation : undefined;

    if (!currentPreview) {
      currentPreview = new ToolPreview(x, y, currentTool, value, color);
    } else {
      currentPreview.updatePosition(x, y);

      if (
        currentPreview.toolType !== currentTool ||
        currentPreview.thicknessOrText !== value ||
        currentPreview.color !== color ||
        currentPreview.rotation !== rotation
      ) {
        currentPreview = new ToolPreview(
          x,
          y,
          currentTool,
          value,
          color,
          rotation,
        );
      }
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function handleStopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    currentStroke = null;

    if (currentMousePos) {
      const value = currentTool === "marker"
        ? currentThickness
        : currentSticker;
      const color = currentTool === "marker" ? currentColor : undefined;
      const rotation = currentTool === "sticker" ? currentRotation : undefined;
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        currentTool,
        value,
        color,
        rotation,
      );
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function handleMouseLeave() {
  handleStopDrawing();

  currentPreview = null;
  myCanvas.dispatchEvent(new Event("drawing-changed"));
}

myCanvas.addEventListener("mousedown", (e: MouseEvent) => {
  handleStartDrawing(e.offsetX, e.offsetY);
});

myCanvas.addEventListener("mousemove", (e: MouseEvent) => {
  handleDrawing(e.offsetX, e.offsetY);
});

myCanvas.addEventListener("mouseup", handleStopDrawing);
myCanvas.addEventListener("mouseleave", handleMouseLeave);

myCanvas.addEventListener("touchstart", (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;
  const rect = myCanvas.getBoundingClientRect();
  handleStartDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

myCanvas.addEventListener("touchmove", (e: TouchEvent) => {
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;
  const rect = myCanvas.getBoundingClientRect();
  handleDrawing(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

myCanvas.addEventListener("touchend", handleStopDrawing);

clearButton.addEventListener("click", () => {
  lines = [];
  redoStack = [];
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

undoButton.addEventListener("click", undoStroke);
redoButton.addEventListener("click", redoStroke);

toolThinButton.addEventListener(
  "click",
  () => setSelectedTool("marker", 1, toolThinButton),
);
toolNormalButton.addEventListener(
  "click",
  () => setSelectedTool("marker", 2, toolNormalButton),
);
toolThickButton.addEventListener(
  "click",
  () => setSelectedTool("marker", 4, toolThickButton),
);
customStickerButton.addEventListener("click", handleCustomSticker);
exportButton.addEventListener("click", handleExport);

myCanvas.addEventListener("drawing-changed", redrawCanvas);

colorPicker.addEventListener("input", () => {
  currentColor = colorPicker.value;
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

rotationSlider.addEventListener("input", () => {
  currentRotation = parseInt(rotationSlider.value);
  updateRotationDisplay();
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

setSelectedTool("marker", 2, toolNormalButton);
createStickerButtons();
updateRotationDisplay();
updateToolVisibility();
