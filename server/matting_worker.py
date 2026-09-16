"""Memory-only object cutouts. Model: U-2-Net (Apache-2.0), rembg export.

Pre/post-processing follows the model's RGB/ImageNet normalization contract.
Only the trusted local Node gateway can reach this worker; no image is saved.
"""
import io
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = 4_000_000
LIMIT = 2_000_000
lock = threading.Lock()
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
options.enable_cpu_mem_arena = False
session = ort.InferenceSession(os.environ.get("JOCAM_MATTING_MODEL", "/opt/jocam-matting/models/u2net.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
input_name = session.get_inputs()[0].name


def cutout(data):
    with Image.open(io.BytesIO(data)) as source:
        if source.width * source.height > 4_000_000:
            raise ValueError("image too large")
        image = ImageOps.exif_transpose(source).convert("RGB")
    image.thumbnail((1280, 1280))
    sample = np.asarray(image.resize((320, 320), Image.Resampling.LANCZOS), dtype=np.float32)
    sample /= max(float(sample.max()), 1.0)
    sample = (sample - np.array([.485, .456, .406], dtype=np.float32)) / np.array([.229, .224, .225], dtype=np.float32)
    prediction = session.run([session.get_outputs()[0].name], {input_name: sample.transpose(2, 0, 1)[None]})[0].squeeze()
    low, high = float(prediction.min()), float(prediction.max())
    if high - low < .01:
        raise ValueError("no clear subject")
    alpha = np.clip((prediction - low) / (high - low), 0, 1)
    # Keep soft object boundaries; reject empty/full masks rather than calling
    # a rectangular photograph a successfully extracted sticker.
    coverage = float((alpha > .5).mean())
    if not .015 < coverage < .98:
        raise ValueError("no clear subject")
    mask = Image.fromarray(np.round(alpha * 255).astype(np.uint8)).resize(image.size, Image.Resampling.LANCZOS)
    result = image.convert("RGBA")
    result.putalpha(mask)
    bounds = mask.point(lambda value: 255 if value > 12 else 0).getbbox()
    if bounds:
        x1, y1, x2, y2 = bounds
        result = result.crop((max(0, x1 - 8), max(0, y1 - 8), min(result.width, x2 + 8), min(result.height, y2 + 8)))
    output = io.BytesIO()
    result.save(output, format="PNG", compress_level=3)
    return output.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def reply(self, status, body, mime="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.reply(200 if self.path == "/health" else 404, b'{"ok":true,"model":"u2net"}' if self.path == "/health" else b'{}')

    def do_POST(self):
        self.connection.settimeout(10)
        if self.path != "/matte":
            return self.reply(404, b'{}')
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= LIMIT:
            return self.reply(413, b'{"code":"IMAGE_TOO_LARGE"}')
        if not lock.acquire(blocking=False):
            return self.reply(503, b'{"code":"BUSY"}')
        try:
            data = self.rfile.read(length)
            started = time.monotonic()
            output = cutout(data)
            self.reply(200, output, "image/png")
            print(json.dumps({"event": "matting", "ms": round((time.monotonic() - started) * 1000), "bytes": len(output)}), flush=True)
        except (ValueError, OSError):
            self.reply(422, b'{"code":"NO_CLEAR_SUBJECT"}')
        except Exception as error:
            print(json.dumps({"event": "matting_error", "type": type(error).__name__}), flush=True)
            self.reply(500, b'{"code":"MATTING_FAILED"}')
        finally:
            lock.release()


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("JOCAM_MATTING_PORT", "8790"))), Handler).serve_forever()
