import recognition from "../recognition.js";

function validCorners(points) {
  return points.every((point, index, all) => {
    const b = all[(index + 1) % 4], c = all[(index + 2) % 4];
    return (b.x - point.x) * (c.y - b.y) - (b.y - point.y) * (c.x - b.x) >= 1;
  });
}

export function createAlignment(root, { getMedia, getKind, isBusy }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const canvas = $("preview");
  let crop = { x: 25, y: 23, w: 26, h: 40 };
  let corners = null;
  let selecting = false;
  let points = [];
  let draggedCorner = null;
  let dragStart = null;

  function drawDivider(ctx, topLeft, topRight, bottomRight, bottomLeft) {
    if (getKind() !== "inventory" || !$("two-columns").checked) return;
    const split = Math.max(35, Math.min(65, Number($("column-split").value) || 52)) / 100;
    ctx.setLineDash([6, 6]); ctx.beginPath();
    ctx.moveTo(
      (topLeft.x + (topRight.x - topLeft.x) * split) / 100 * canvas.width,
      (topLeft.y + (topRight.y - topLeft.y) * split) / 100 * canvas.height,
    );
    ctx.lineTo(
      (bottomLeft.x + (bottomRight.x - bottomLeft.x) * split) / 100 * canvas.width,
      (bottomLeft.y + (bottomRight.y - bottomLeft.y) * split) / 100 * canvas.height,
    );
    ctx.stroke();
  }

  function draw() {
    const media = getMedia();
    if (!media) return;
    const width = media.videoWidth || media.naturalWidth;
    const height = media.videoHeight || media.naturalHeight;
    canvas.width = Math.min(1000, width);
    canvas.height = Math.round(canvas.width * height / width);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#8be2c9"; ctx.lineWidth = 2; ctx.fillStyle = "#8be2c9";
    if (corners || selecting) {
      const visiblePoints = selecting ? points : corners;
      if (!visiblePoints.length) return;
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x / 100 * canvas.width, visiblePoints[0].y / 100 * canvas.height);
      for (const point of visiblePoints.slice(1)) ctx.lineTo(point.x / 100 * canvas.width, point.y / 100 * canvas.height);
      if (!selecting) ctx.closePath();
      ctx.stroke();
      for (const [index, point] of visiblePoints.entries()) {
        ctx.beginPath(); ctx.arc(point.x / 100 * canvas.width, point.y / 100 * canvas.height, 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = "bold 18px system-ui";
        ctx.fillText(String(index + 1), point.x / 100 * canvas.width + 10, point.y / 100 * canvas.height - 8);
      }
      if (!selecting) drawDivider(ctx, ...visiblePoints);
      return;
    }
    const x = crop.x / 100 * canvas.width, y = crop.y / 100 * canvas.height;
    const w = crop.w / 100 * canvas.width, h = crop.h / 100 * canvas.height;
    ctx.fillStyle = "#0008";
    ctx.fillRect(0, 0, canvas.width, y); ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
    ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, canvas.width - x - w, h);
    ctx.strokeRect(x, y, w, h);
    drawDivider(ctx,
      { x: crop.x, y: crop.y }, { x: crop.x + crop.w, y: crop.y },
      { x: crop.x + crop.w, y: crop.y + crop.h }, { x: crop.x, y: crop.y + crop.h });
  }

  function reset() {
    selecting = false; points = []; dragStart = null; draggedCorner = null;
    crop = getKind() === "recipes" ? { x: 25, y: 23, w: 26, h: 40 } : { x: 26, y: 28, w: 44, h: 49 };
    const media = getMedia();
    const candidate = media ? recognition.detectCorners(media, getKind()) : null;
    const detected = candidate && validCorners(candidate) ? candidate : null;
    const { x, y, w, h } = crop;
    corners = detected || [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    if (detected && getKind() === "inventory") $("column-split").value = String(detected.columnSplit || 50);
    $("align-screen").textContent = "Realign four corners";
    $("alignment-status").textContent = detected
      ? "Table detected. Drag corners to adjust."
      : "Table not detected. Drag the corners into place.";
    draw();
  }

  function startSelection() {
    selecting = true; points = []; dragStart = null; draggedCorner = null;
    $("align-screen").textContent = "Cancel alignment";
    $("alignment-status").textContent = "Click the top-left corner of the table (include names and counts).";
    draw();
  }

  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(99, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(99, (event.clientY - rect.top) / rect.height * 100)),
    };
  }

  canvas.addEventListener("pointerdown", (event) => {
    const media = getMedia();
    if (isBusy() || !media) return;
    if (corners && !selecting) {
      const point = position(event);
      const rect = canvas.getBoundingClientRect();
      const index = corners.findIndex((corner) => Math.hypot(
        (corner.x - point.x) / 100 * rect.width, (corner.y - point.y) / 100 * rect.height,
      ) <= 18);
      if (index !== -1) {
        draggedCorner = index; canvas.setPointerCapture(event.pointerId);
        return;
      }
    }
    if (media.tagName === "VIDEO" && !selecting) startSelection();
    if (selecting) {
      points.push(position(event));
      if (points.length === 4) {
        if (!validCorners(points)) {
          points = [];
          $("alignment-status").textContent = "Corners crossed or too close. Start again: top-left, top-right, bottom-right, bottom-left.";
        } else {
          corners = points; selecting = false;
          $("align-screen").textContent = "Realign four corners";
          $("alignment-status").textContent = "Corners set. Drag to adjust; Reset corners retries detection.";
        }
      } else {
        $("alignment-status").textContent = `Click the ${["top-left", "top-right", "bottom-right", "bottom-left"][points.length]} corner of the table.`;
      }
      draw();
      return;
    }
    corners = null;
    dragStart = position(event);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove", (event) => {
    if (isBusy()) return;
    if (draggedCorner !== null) {
      const next = corners.map((point, index) => index === draggedCorner ? position(event) : point);
      if (validCorners(next)) {
        corners = next;
        $("alignment-status").textContent = "Corners updated.";
        draw();
      }
    } else if (dragStart) {
      const end = position(event);
      crop = {
        x: Math.round(Math.min(dragStart.x, end.x)), y: Math.round(Math.min(dragStart.y, end.y)),
        w: Math.max(1, Math.round(Math.abs(end.x - dragStart.x))), h: Math.max(1, Math.round(Math.abs(end.y - dragStart.y))),
      };
      draw();
    }
  });
  for (const type of ["pointerup", "pointercancel"]) {
    canvas.addEventListener(type, () => { dragStart = null; draggedCorner = null; });
  }
  $("crop-reset").addEventListener("click", reset);
  $("align-screen").addEventListener("click", () => {
    if (!getMedia() || isBusy()) return;
    if (!selecting) { startSelection(); return; }
    selecting = false; points = [];
    $("align-screen").textContent = corners ? "Realign four corners" : "Align four corners";
    $("alignment-status").textContent = "Alignment selection cancelled.";
    draw();
  });
  $("two-columns").addEventListener("change", draw);
  $("column-split").addEventListener("input", draw);

  return {
    reset,
    draw,
    snapshot() {
      if (selecting) throw new Error("Finish selecting all four corners, or cancel alignment before reading");
      return { crop: { ...crop }, alignment: corners?.map((point) => ({ ...point })) };
    },
  };
}
