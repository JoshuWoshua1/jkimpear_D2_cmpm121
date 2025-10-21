import "./style.css";

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

class ToolPreview implements Command {
  private x: number;
  private y: number;
  private radius: number;

  constructor(x: number, y: number, lineWidth: number) {
    this.x = x;
    this.y = y;
    this.radius = lineWidth / 2;
  }

  public updatePosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  public display(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "grey";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();
  }
}

let isDrawing = false;
let currentStroke: MarkerLine | null = null;
let lines: Command[] = [];
let redoStack: Command[] = [];
let currentThickness: number = 2; //defaulted to thick lines (2)
let currentPreview: ToolPreview | null = null;
let currentMousePos: Point | null = null;

document.body.innerHTML = `
  <h1>D2 assignment</h1>
  <canvas id ="myCanvas" width = "256" height = "256"></canvas>
  <div class="controls">
    <button id="toolThin">Thin Marker</button>
    <button id="toolThick">Thick Marker</button>
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

function setSelectedTool(thickness: number, selectedButton: HTMLButtonElement) {
  currentThickness = thickness;

  // Clear the selected class from all tool buttons
  toolThinButton.classList.remove("selectedTool");
  toolThickButton.classList.remove("selectedTool");

  // Add the selected class to the active button
  selectedButton.classList.add("selectedTool");

  if (currentMousePos) {
    currentPreview = new ToolPreview(
      currentMousePos.x,
      currentMousePos.y,
      currentThickness,
    );
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
  currentStroke = new MarkerLine({ x, y }, currentThickness);
  lines.push(currentStroke);
  currentPreview = null;

  myCanvas.dispatchEvent(new Event("drawing-changed"));
}

function handleDrawing(x: number, y: number) {
  if (isDrawing && currentStroke) {
    currentStroke.drag(x, y);
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }

  currentMousePos = { x, y };

  if (!isDrawing) {
    if (!currentPreview) {
      currentPreview = new ToolPreview(x, y, currentThickness);
    } else {
      currentPreview.updatePosition(x, y);
    }
    myCanvas.dispatchEvent(new Event("drawing-changed"));
  }
}

function handleStopDrawing() {
  if (isDrawing) {
    isDrawing = false;
    currentStroke = null;

    if (currentMousePos) {
      currentPreview = new ToolPreview(
        currentMousePos.x,
        currentMousePos.y,
        currentThickness,
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
  () => setSelectedTool(1, toolThinButton),
); // Thin line width 1
toolThickButton.addEventListener(
  "click",
  () => setSelectedTool(2, toolThickButton),
); // Thick line width 2

myCanvas.addEventListener("drawing-changed", redrawCanvas);

setSelectedTool(2, toolThickButton);
