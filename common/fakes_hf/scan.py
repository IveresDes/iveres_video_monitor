import logging
from argparse import ArgumentParser

from transformers import pipeline

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)


def create_scanner(
    device="cpu", model_id="Organika/sdxl-detector", fake_label="artificial"
):
    pipe = pipeline("image-classification", model=model_id, device=device)

    def scan(img_path):
        res = pipe(img_path)
        score = next(x["score"] for x in res if x["label"] == fake_label)
        return score

    return scan


def parse_args():
    parser = ArgumentParser(description="Process a file with huggingface classifier.")
    parser.add_argument("file", help="Path to the file to analyze")
    parser.add_argument(
        "--device", default="cpu", help="Device to use for analysis (cpu, cuda:0, ...)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    scan_file = create_scanner(args.device)
    score = scan_file(args.file)

    print(args.file, score)
