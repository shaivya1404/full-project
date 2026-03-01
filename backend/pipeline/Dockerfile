FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-runtime

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Pre-download Silero-VAD on build (faster cold starts)
RUN python -c "import torch; torch.hub.load('snakers4/silero-vad', 'silero_vad', onnx=False, trust_repo=True)" || true

EXPOSE 8765

CMD ["python", "server.py"]
