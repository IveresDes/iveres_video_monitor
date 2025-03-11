import logging
from argparse import ArgumentParser
from pathlib import Path

import torch
from matplotlib import colormaps
from PIL import Image
from transformers import AutoImageProcessor, AutoModelForSemanticSegmentation

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)

model_dir = Path(__file__).parent / "models/mit-b0-gen-v12-di_checkpoint-15800/"


def create_scanner(device="cuda:0"):
    # Load model
    image_processor = AutoImageProcessor.from_pretrained(model_dir)
    model = AutoModelForSemanticSegmentation.from_pretrained(model_dir)
    model.to(device)

    def scan(img_path):
        # Load image
        image = Image.open(img_path).convert("RGB")

        # Inference
        inputs = image_processor(images=image, return_tensors="pt")
        inputs = inputs.to(device)
        with torch.no_grad():
            outputs = model(**inputs)
            logits = outputs.logits.detach().cpu()

        # Rescale logits to original image size
        logits = torch.nn.functional.interpolate(
            logits,
            size=image.size[::-1],  # (height, width)
            mode="bilinear",
            align_corners=False,
        )[0]

        # Get model prediction
        predicted = logits.sigmoid()[0].numpy()
        score = predicted.mean().item()

        # Generate result image
        predicted_colormap = colormaps["seismic"](predicted)
        score_image = Image.fromarray(
            (255 * predicted_colormap).astype("uint8")
        ).convert("RGB")
        return score, score_image

    return scan


def parse_args():
    parser = ArgumentParser(description="Process a file with fake segments.")
    parser.add_argument("file", help="Path to the file to analyze")
    parser.add_argument(
        "--device", default="cpu", help="Device to use for analysis (cpu, cuda:0, ...)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    scan_file = create_scanner(args.device)
    score, score_image = scan_file(args.file)

    print(args.file, score)
    score_image.save("test_error_map.png")
