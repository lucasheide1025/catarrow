import json
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid


class ComfyClient:
    def __init__(self, base_url="http://127.0.0.1:8188", request_timeout=30):
        if base_url.rstrip("/") != "http://127.0.0.1:8188":
            raise ValueError("Only the local ComfyUI endpoint is allowed")
        self.base_url = base_url.rstrip("/")
        self.request_timeout = request_timeout

    def _json(self, path, payload=None):
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.base_url + path, data=data,
            headers={"Content-Type": "application/json"} if data else {},
        )
        with urllib.request.urlopen(req, timeout=self.request_timeout) as response:
            return json.load(response)

    def preflight(self, checkpoint):
        stats = self._json("/system_stats")
        objects = self._json("/object_info/CheckpointLoaderSimple")
        choices = objects["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
        if checkpoint not in choices:
            raise RuntimeError(f"Checkpoint unavailable: {checkpoint}")
        return {"system_stats": stats, "checkpoint_available": True}

    def submit(self, workflow):
        result = self._json("/prompt", {"prompt": workflow, "client_id": str(uuid.uuid4())})
        return result["prompt_id"]

    def history(self, prompt_id):
        return self._json(f"/history/{urllib.parse.quote(prompt_id)}").get(prompt_id)

    def queue(self):
        return self._json("/queue")

    def wait(self, prompt_id, timeout=600, interval=2, diagnostics_every=30):
        deadline = time.monotonic() + timeout
        next_diag = time.monotonic() + diagnostics_every
        diagnostics = []
        while time.monotonic() < deadline:
            entry = self.history(prompt_id)
            if entry:
                status = entry.get("status", {})
                messages = status.get("messages", [])
                if status.get("completed"):
                    return entry, diagnostics
                if any(message and message[0] == "execution_error" for message in messages):
                    raise RuntimeError(f"ComfyUI execution failed: {messages[-1]}")
            if time.monotonic() >= next_diag:
                diagnostics.append({"at": time.time(), "queue": self.queue()})
                next_diag += diagnostics_every
            time.sleep(interval)
        raise TimeoutError(json.dumps({"prompt_id": prompt_id, "queue": self.queue(), "diagnostics": diagnostics}))

    def image(self, descriptor):
        query = urllib.parse.urlencode({
            "filename": descriptor["filename"],
            "subfolder": descriptor.get("subfolder", ""),
            "type": descriptor.get("type", "output"),
        })
        with urllib.request.urlopen(self.base_url + "/view?" + query, timeout=self.request_timeout) as response:
            return response.read()
