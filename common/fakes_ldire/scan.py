import logging
from argparse import ArgumentParser
from math import exp

import numpy as np
import seaborn as sns
import skimage as ski
import torch
from diffusers import AutoencoderKL, DDPMScheduler, StableDiffusionPipeline
from PIL import Image
from skimage.filters.rank import entropy
from skimage.morphology import disk
import matplotlib.pyplot as plt

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)


def by_img_channel(func, img_ocv, *args, **kwargs):
    return np.dstack(
        [func(img_ocv[:, :, i], *args, **kwargs) for i in range(img_ocv.shape[-1])]
    )


def torch_entropy(tensor, disk_radius=3):
    iml = tensor.clone().detach().cpu().numpy()[0].transpose((1, 2, 0))
    iml = ski.exposure.rescale_intensity(iml, out_range=(0.0, 1.0))
    iml = ski.util.img_as_ubyte(iml)
    ent = by_img_channel(entropy, iml, disk(disk_radius))
    res = ent.transpose((2, 0, 1))[None,]
    return torch.from_numpy(res).to(tensor.device, tensor.dtype)


def create_scanner(device="cuda:0"):
    vae = AutoencoderKL.from_pretrained(
        "stabilityai/sd-vae-ft-mse", torch_dtype=torch.float16
    )
    pipe = StableDiffusionPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        vae=vae,
        safety_checker=None,
        torch_dtype=torch.float16,
    )
    pipe = pipe.to(device)

    bwd_scheduler = DDPMScheduler.from_config(pipe.scheduler.config)

    def latent_simple(img_path, total_steps=50, max_steps=1, reconstruct_num=1):
        gen = torch.Generator(device="cpu")

        # Load image and resize if needed
        img = Image.open(img_path).convert("RGB").resize((512, 512))

        # Get image latents
        imgs = pipe.image_processor.preprocess(img).to(pipe.device, pipe.unet.dtype)
        with torch.no_grad():
            imgs_latents = pipe.vae.encode(imgs).latent_dist.sample()
        imgs_latents = imgs_latents * pipe.vae.config.scaling_factor

        imgs_entropy = torch_entropy(imgs)

        g = 7.5

        prompt = [""]
        with torch.no_grad():
            prompt_embeds_tuple = pipe.encode_prompt(
                prompt,
                pipe.device,
                num_images_per_prompt=1,
                do_classifier_free_guidance=True,
            )
            prompt_embeds = torch.cat([prompt_embeds_tuple[1], prompt_embeds_tuple[0]])

        errors = []
        error_maps = []
        for _ in range(reconstruct_num):
            bwd_scheduler.set_timesteps(total_steps)
            errors.append([])
            error_maps.append([])
            for ts in bwd_scheduler.timesteps[-max_steps:]:
                noise = torch.randn(imgs_latents.shape, generator=gen).to(
                    pipe.device, pipe.unet.dtype
                )
                noisy_latents = bwd_scheduler.add_noise(
                    imgs_latents, noise=noise, timesteps=ts
                )
                inp = bwd_scheduler.scale_model_input(
                    torch.cat([noisy_latents] * 2), ts
                )
                with torch.no_grad():
                    u, t = pipe.unet(
                        inp, ts, encoder_hidden_states=prompt_embeds
                    ).sample.chunk(2)
                pred = u + g * (t - u)
                error = (pred - noise) ** 2
                error_mean = error.mean()
                errors[-1].append(error_mean.detach().cpu())
                error_maps[-1].append(error.detach().cpu())

        error = torch.stack([torch.stack(e) for e in errors]).mean()
        error_map = torch.stack([torch.stack(e) for e in error_maps]).mean((0, 1, 2, 3))

        local_entropy = imgs_entropy.detach().cpu().mean((0, 1)).numpy()
        local_entropy = ski.exposure.rescale_intensity(
            local_entropy, out_range=(0.0, 1.0)
        )
        entropy_res = ski.transform.resize(local_entropy, (64, 64))
        # heat = (
        #     -23.9215
        #     + 21.6891 * error_map.numpy()
        #     + 18.8505 * entropy_res
        #     - 19.2958 * error_map.numpy() * entropy_res
        # )
        heat = error_map.numpy() * entropy_res

        error = float(error)
        error_map_plot = sns.heatmap(
            heat, xticklabels=False, yticklabels=False, cbar=True
        )
        error_map_fig = error_map_plot.get_figure()
        img_entropy = float(imgs_entropy.mean())

        logit = (
            -23.9215
            + 21.6891 * error
            + 18.8505 * img_entropy
            - 19.2958 * img_entropy * error
        )
        score = 1 / (1 + exp(-logit))
        return error, score, error_map_fig

    return latent_simple


def parse_args():
    parser = ArgumentParser(description="Process a file with deepware.")
    parser.add_argument("file", help="Path to the file to analyze")
    parser.add_argument(
        "--device", default="cpu", help="Device to use for analysis (cpu, cuda:0, ...)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    scan_file = create_scanner(args.device)
    error, score, error_map_fig = scan_file(args.file, reconstruct_num=5)

    print(args.file, error, score)
    error_map_fig.savefig("test_error_map.png")
