# CMPM 121 D2 Project

## Features

- **Freehand Drawing:** Draw on the canvas using the mouse or touch input.

- **Observer-Driven Redrawing:** The canvas only redraws when a specific custom event (`drawing-changed`) is dispatched, ensuring high performance.

- **Undo/Redo History:** Full history management allows users to undo and redo individual strokes.

- **Responsive Canvas:** The drawing area resizes automatically with the browser window.

- **Type-Safe Code:** Uses TypeScript interfaces for reliable data handling.

---

## Core Architecture & Implementation

The application strictly separates data from presentation, which is key to its functionality:

### 1. Data Model (The State)

All drawing information is stored in two central arrays:

- `lines: Stroke[]`: The **main display list** (or undo stack). This array contains every stroke currently visible on the canvas.

- `redoStack: Stroke[]`: The **redo history**. This array holds strokes that have been recently undone.

### 2. Observer Pattern

Instead of drawing immediately when the mouse moves, the application follows this cycle:

| Action        | Handler                                             | Data Manipulation                          | Notification                                                   |
| :------------ | :-------------------------------------------------- | :----------------------------------------- | :------------------------------------------------------------- |
| **Draw/Move** | `mousemove`                                         | Adds a point to the `currentStroke` array. | Dispatches `drawing-changed` event.                            |
| **Clear**     | `clearButton`                                       | Sets `lines = []` and `redoStack = []`.    | Dispatches `drawing-changed` event.                            |
| **Observer**  | `myCanvas.addEventListener("drawing-changed", ...)` | N/A                                        | Calls `redrawCanvas()` (The only function that paints pixels). |

### 3. Undo/Redo System

The undo/redo functionality works by moving whole `Stroke` objects between the two history stacks:

- **`undoStroke()`:** Pops the last stroke from `lines` and pushes it onto `redoStack`.

- **`redoStroke()`:** Pops the last stroke from `redoStack` and pushes it back onto `lines`.

- **New Action:** Any new drawing action (`mousedown` or `clear`) automatically resets (`redoStack = []`) to prevent historical conflicts.
