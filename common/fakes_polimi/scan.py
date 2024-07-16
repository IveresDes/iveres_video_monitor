"""
Modified from common/fakes_polimi/icpr2020dfdc/notebook/Video prediction.ipynb
"""

import sys
from argparse import ArgumentParser
from functools import partial
from pathlib import Path

import matplotlib.pyplot as plt
import torch
from scipy.special import expit
from torch.utils.model_zoo import load_url

root_dir = Path(__file__).resolve().parent
sys.path.append(str(Path(root_dir, "icpr2020dfdc")))

from architectures import fornet, weights
from blazeface import BlazeFace, FaceExtractor, VideoReader
from isplutils import utils


def init_models(device="cpu"):
    """Parameters"""

    """
    Choose an architecture between
    - EfficientNetB4
    - EfficientNetB4ST
    - EfficientNetAutoAttB4
    - EfficientNetAutoAttB4ST
    - Xception
    """
    net_model = "EfficientNetAutoAttB4"

    """
    Choose a training dataset between
    - DFDC
    - FFPP
    """
    train_db = "DFDC"

    # torch.device('cuda:1') if torch.cuda.is_available() else torch.device('cpu')
    device = device
    face_policy = "scale"
    face_size = 224
    frames_per_video = 32

    """Initialization"""
    model_url = weights.weight_url["{:s}_{:s}".format(net_model, train_db)]
    net = getattr(fornet, net_model)().eval().to(device)
    net.load_state_dict(load_url(model_url, map_location=device, check_hash=True))

    transf = utils.get_transformer(
        face_policy, face_size, net.get_normalizer(), train=False
    )

    weights_file = Path(root_dir, "icpr2020dfdc/blazeface/blazeface.pth")
    anchors_file = Path(root_dir, "icpr2020dfdc/blazeface/anchors.npy")

    facedet = BlazeFace().to(device)
    facedet.load_weights(str(weights_file))
    facedet.load_anchors(str(anchors_file))
    videoreader = VideoReader(verbose=False)

    def video_read_fn(x):
        return videoreader.read_frames(x, num_frames=frames_per_video)

    face_extractor = FaceExtractor(video_read_fn=video_read_fn, facedet=facedet)

    return face_extractor, transf, net


def process(face_extractor, transformer, net, file, graph_file=None, device="cpu"):
    """Detect faces"""

    vid_real_faces = face_extractor.process_video(file)

    """Predict scores for each frame"""

    # For each frame, we consider the face with the highest confidence score found by BlazeFace (= frame['faces'][0])
    faces_real_t = torch.stack(
        [
            transformer(image=frame["faces"][0])["image"]
            for frame in vid_real_faces
            if len(frame["faces"])
        ]
    )

    with torch.no_grad():
        faces_real_pred = net(faces_real_t.to(device)).cpu().numpy().flatten()

    """
    Print average scores.
    An average score close to 0 predicts REAL.
    An average score close to 1 predicts FAKE.
    """
    score = expit(faces_real_pred.mean()).item()

    # Save frames plot
    if graph_file:
        fig, ax = plt.subplots(figsize=(12, 4))
        ax.stem(
            [f["frame_idx"] for f in vid_real_faces if len(f["faces"])],
            expit(faces_real_pred),
            use_line_collection=True,
        )
        ax.set_xlabel("Fotograma")
        ax.set_ylabel("Probabilidad de fake")
        ax.set_ylim([0, 1])
        ax.grid(True)
        fig.savefig(graph_file)

    return score


def create_scanner(device="cpu"):
    models = init_models(device)
    scan = partial(process, *models, device=device)
    return scan


def parse_args():
    parser = ArgumentParser(description="Process a file with polimi.")
    parser.add_argument("file", help="Path to the file to analyze")
    parser.add_argument(
        "--device", default="cpu", help="Device to use for analysis (cpu, cuda:0, ...)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    scan_file = create_scanner(args.device)
    score = scan_file(args.file, args.file + ".png")

    print(args.file, score)
