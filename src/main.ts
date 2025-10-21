import "./style.css";

enum StickerTool {
  Poop = "💩",
  Toilet = "🚽",
  Water = "💧",
}

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

  constructor(initialPoint: Point, lineWidth: number) {
    this.points.push(initialPoint);
    this.lineWidth = lineWidth;
  }

  public drag(x: number, y: number): void {
    this.points.push({ x, y });
  }

  public display(ctx: CanvasRenderingContext2D): void {
    const stroke = this.points;

    if (stroke.length === 0) return;

    ctx.strokeStyle = "black";
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

  constructor(x: number, y: number, text: string) {
    this.x = x;
    this.y = y;
    this.text = text;
  }

  public drag(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    ctx.font = `${STICKER_SIZE}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(this.text, this.x, this.y);
  }
}

class ToolPreview implements Command {
  private x: number;
  private y: number;
  public toolType: "marker" | "sticker";
  public thicknessOrText: number | string;

  constructor(
    x: number,
    y: number,
    toolType: "marker" | "sticker",
    thicknessOrText: number | string,
  ) {
    this.x = x;
    this.y = y;
    this.toolType = toolType;
    this.thicknessOrText = thicknessOrText;
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    if (this.toolType === "marker") {
      const radius = (this.thicknessOrText as number) / 2;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.closePath();
    } else { // 'sticker'
      const text = this.thicknessOrText as string;
      ctx.globalAlpha = 0.5; // Make the preview slightly transparent
      ctx.font = `${STICKER_SIZE}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, this.x, this.y);
      ctx.globalAlpha = 1.0;
    }
  }
}

let isDrawing = false;
let currentStroke: MarkerLine | StickerCommand | null = null;
let lines: Command[] = [];
let redoStack: Command[] = [];
let currentThickness: number = 2; //defaulted to thick lines (2)
let currentPreview: ToolPreview | null = null;
let currentMousePos: Point | null = null;
let currentTool: "marker" | "sticker" = "marker";
let currentSticker: StickerTool = StickerTool.Poop;
const STICKER_SIZE = 30; //default (30) for rendering sticker

document.body.innerHTML = `
  <h1>D2 assignment</h1>
  <canvas id ="myCanvas" width = "256" height = "256"></canvas>
  <div class="controls">
    <div class="tool-group">
        <label>Marker:</label>
        <button id="toolThin">Thin</button>
        <button id="toolThick">Thick</button>
    </div>
    <div class="tool-group">
        <label>Stickers:</label>
        <button id="toolPoop">${StickerTool.Poop}</button>
        <button id="toolStar">${StickerTool.Toilet}</button>
        <button id="toolWave">${StickerTool.Water}</button>
    </div>
    <button id="undoButton">Undo</button>
    <button id="redoButton">Redo</button>
    <button id="clearButton">Clear</button>
  </div>
`;

const myCanvas = document.getElementById("myCanvas") as HTMLCanvasElement;
const ctx = myCanvas.getContext("2d") as CanvasRenderingContext2D;
const undoButton = document.getElementById("undoButton") as HTMLButtonElement;
const redoButton = document.getElementById("redoButton") as HTMLButtonElement;
const clearButton = document.getElementById("clearButton") as HTMLButtonElement;
const toolThinButton = document.getElementById("toolThin") as HTMLButtonElement;
const toolThickButton = document.getElementById(
  "toolThick",
) as HTMLButtonElement;
const toolPoopButton = document.getElementById(
  "toolPoop",
) as HTMLButtonElement;
const toolStarButton = document.getElementById("toolStar") as HTMLButtonElement;
const toolWaveButton = document.getElementById("toolWave") as HTMLButtonElement;
const toolButtons: HTMLButtonElement[] = [
  toolThinButton,
  toolThickButton,
  toolPoopButton,
  toolStarButton,
  toolWaveButton,
];

function setSelectedTool(
  tool: "marker" | "sticker",
  value: number | StickerTool,
  selectedButton: HTMLButtonElement,
) {
  currentTool = tool;

  if (tool === "marker") {
    currentThickness = value as number;
  } else {
    currentSticker = value as StickerTool;
  }

  toolButtons.forEach((btn) => btn.classList.remove("selectedTool"));

  selectedButton.classList.add("selectedTool");

  if (currentMousePos) {
    if (currentTool === "marker") {
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        "marker",
        currentThickness,
      );
    } else {
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        "sticker",
        currentSticker,
      );
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function redrawCanvas() {
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);

  for (const command of lines) {
    command.display(ctx);
  }
  if (!isDrawing && currentPreview) {
    currentPreview.display(ctx);
  }
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

  if (currentTool === "marker") {
    currentStroke = new MarkerLine({ x, y }, currentThickness);
  } else { // 'sticker'
    currentStroke = new StickerCommand(x, y, currentSticker);
  }

  lines.push(currentStroke);
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
    const value = currentTool === "marker" ? currentThickness : currentSticker;

    if (!currentPreview) {
      currentPreview = new ToolPreview(x, y, currentTool, value);
    } else {
      currentPreview.updatePosition(x, y);
      if (
        currentPreview.toolType !== currentTool ||
        currentPreview.thicknessOrText !== value
      ) {
        currentPreview = new ToolPreview(x, y, currentTool, value);
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
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        currentTool,
        value,
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
toolThickButton.addEventListener(
  "click",
  () => setSelectedTool("marker", 2, toolThickButton),
);

toolPoopButton.addEventListener(
  "click",
  () => setSelectedTool("sticker", StickerTool.Poop, toolPoopButton),
);
toolStarButton.addEventListener(
  "click",
  () => setSelectedTool("sticker", StickerTool.Toilet, toolStarButton),
);
toolWaveButton.addEventListener(
  "click",
  () => setSelectedTool("sticker", StickerTool.Water, toolWaveButton),
);

myCanvas.addEventListener("drawing-changed", redrawCanvas);

setSelectedTool("marker", 2, toolThickButton);
