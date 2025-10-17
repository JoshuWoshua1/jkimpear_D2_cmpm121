import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

let isDrawing = false;
let currentStroke: Stroke | null = null;

document.body.innerHTML = `
  <h1>D2 assignment</h1>
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
  <canvas id ="myCanvas" width = "256" height = "256"></canvas>
  <button id = "clearButton">clear</button>
`;

const myCanvas = document.getElementById("myCanvas") as HTMLCanvasElement;
const ctx = myCanvas.getContext("2d") as CanvasRenderingContext2D;

let lines: Stroke[] = [];

function redrawCanvas() {
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
  ctx.strokeStyle = "black";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of lines) {
    if (stroke.length === 0) continue;

    const startPoint = stroke[0];
    if (!startPoint) continue;

    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i]!.x, stroke[i]!.y);
    }
    ctx.stroke();
    ctx.closePath();
  }
}

myCanvas.addEventListener("mousedown", (e: MouseEvent) => {
  isDrawing = true;
  currentStroke = [{ x: e.offsetX, y: e.offsetY }];
  lines.push(currentStroke);
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

myCanvas.addEventListener("mousemove", (e: MouseEvent) => {
  if (!isDrawing || !currentStroke) return;
  currentStroke.push({ x: e.offsetX, y: e.offsetY });
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

myCanvas.addEventListener("mouseup", () => {
  if (isDrawing) {
    isDrawing = false;
    currentStroke = null;
  }
});

myCanvas.addEventListener("mouseleave", () => {
  if (isDrawing) {
    isDrawing = false;
    currentStroke = null;
  }
});

const clearButton = document.getElementById("clearButton")!;

clearButton.addEventListener("click", () => {
  lines = [];
  myCanvas.dispatchEvent(new Event("drawing-changed"));
});

myCanvas.addEventListener("drawing-changed", redrawCanvas);
