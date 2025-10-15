import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";

let isDrawing = false;
let x = 0;
let y = 0;

document.body.innerHTML = `
  <h1>D2 assignment</h1>
  <p>Example image asset: <img src="${exampleIconUrl}" class="icon" /></p>
  <canvas id ="myCanvas" width = "256" height = "256"></canvas>
  <button id = "clearButton">clear</button>
`;

const myCanvas = document.getElementById("myCanvas") as HTMLCanvasElement;
const ctx = myCanvas.getContext("2d") as CanvasRenderingContext2D;

myCanvas.addEventListener("mousedown", (e) => {
  x = e.offsetX;
  y = e.offsetY;
  isDrawing = true;
});

myCanvas.addEventListener("mousemove", (e) => {
  if (isDrawing) {
    drawLine(ctx, x, y, e.offsetX, e.offsetY);
    x = e.offsetX;
    y = e.offsetY;
  }
});

myCanvas.addEventListener("mouseup", (e) => {
  if (isDrawing) {
    drawLine(ctx, x, y, e.offsetX, e.offsetY);
    x = 0;
    y = 0;
    isDrawing = false;
  }
});

function drawLine(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  context.beginPath();
  context.strokeStyle = "black";
  context.lineWidth = 1;
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.closePath();
}

const clearButton = document.getElementById("clearButton")!;

clearButton.addEventListener("click", () => {
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
});
