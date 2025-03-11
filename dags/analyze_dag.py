from datetime import datetime
from pathlib import Path

from airflow.decorators import dag, task
from dotenv import dotenv_values

from common.database.database import (
    get_videos_to_analyze,
    store_video_fakes,
    store_image_fakes,
)

config = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


@dag(
    description="A DAG to analyze downloaded videos",
    start_date=datetime(2023, 2, 16, 0, 0, 0),
    schedule="@continuous",
    max_active_runs=1,
    catchup=False,
)
def analyze_dag():
    @task.sensor(poke_interval=10, timeout=18000, mode="reschedule", soft_fail=True)
    def wait_for_some_video():
        videos = get_videos_to_analyze(max_num=1)
        return bool(videos)

    @task
    def get_videos(videos_dir):
        videos = get_videos_to_analyze(max_num=1)
        videos_out = [
            {
                "id": str(video["_id"]),
                "analysisStatus": video["analysisStatus"],
                "mediaType": video["mediaType"],
                "file": str(Path(videos_dir, video["path"])),
            }
            for video in videos
        ]
        return videos_out

    @task.external_python(python=config["PYTHON_TRANSCRIBE"])
    def transcriptions(videos_dir, videos: list):
        from common.database.database import store_video_transcriptions
        from common.transcription.transcribe_videos import (
            create_en_es_transcribe_translate,
            write_transcription_files,
        )

        filtered_videos = [
            video
            for video in videos
            if video["analysisStatus"]["transcribe"] == "waiting"
        ]
        if not filtered_videos:
            return []

        process_video = create_en_es_transcribe_translate(
            trancribe_source=True, device="cuda:0"
        )

        for video in filtered_videos:
            video_file = video["file"]
            try:
                # Transcribe and translate
                transcription_result = process_video(video_file)
                # Write files
                transcription_files = write_transcription_files(
                    transcription_result, video_file, videos_dir
                )
                # Add file paths to result
                for lang, lang_files in transcription_files.items():
                    transcription_result["data"][lang]["filesPath"] = lang_files
            except Exception:
                transcription_result = None
                print(f"Error transcribing video {video['id']}")
            # Store transcriptions
            store_video_transcriptions(video["id"], transcription_result)

    @task.external_python(python=config["PYTHON_DEEPWARE"])
    def detect_fakes_deepware(videos: list):
        from common.fakes_deepware.scan import create_scanner

        filtered_videos = [
            video
            for video in videos
            if video["analysisStatus"]["fake"] == "waiting"
            and video["mediaType"] == "video"
        ]
        if not filtered_videos:
            return []

        scan_file = create_scanner(device="cuda:0")
        results = []
        for video in filtered_videos:
            result = -1
            try:
                result = scan_file(video["file"])
            except Exception as e:
                print(f"Problem analyzing video {video['id']} with deepware", e)
            results.append({"video": video, "result": result})

        return results

    @task.external_python(python=config["PYTHON_POLIMI"])
    def detect_fakes_polimi(videos_dir, media_list: list):
        from pathlib import Path
        from common.fakes_polimi.scan import create_scanner

        filtered_media = [
            media
            for media in media_list
            if media["analysisStatus"]["fake"] == "waiting"
            and media["mediaType"] == "video"
        ]
        if not filtered_media:
            return []

        scan_file = create_scanner(device="cuda:0")
        results = []
        for media in filtered_media:
            result = {"score": -1, "figure": ""}
            try:
                file_path = Path(media["file"])
                figure_path = file_path.with_name(f"{file_path.stem}_polimi.jpg")
                score = scan_file(media["file"], str(figure_path))
                figure_path_rel = figure_path.relative_to(videos_dir)
                result = {"score": score, "figure": str(figure_path_rel)}
            except Exception as e:
                print(f"Problem analyzing video {media['id']} with polimi", e)
            results.append({"video": media, "result": result})

        return results

    @task
    def save_fakes(deepware_results: list, polimi_results: list):
        for dw_res, pl_res in zip(deepware_results, polimi_results):
            store_video_fakes(dw_res["video"]["id"], dw_res["result"], pl_res["result"])

    @task.external_python(python=config["PYTHON_IMG_FAKES"])
    def detect_image_fakes_segment(videos_dir, media_list: list):
        from pathlib import Path
        from common.fakes_segment.scan import create_scanner

        filtered_media = [
            media
            for media in media_list
            if media["analysisStatus"]["fake"] == "waiting"
            and media["mediaType"] == "image"
        ]
        if not filtered_media:
            return []

        scan_file = create_scanner(device="cpu")
        results = []
        for media in filtered_media:
            result = {"media": media, "result": {}}
            try:
                file_path = Path(media["file"])
                score_image_path = file_path.with_name(f"{file_path.stem}_score.jpg")
                score, score_image = scan_file(file_path)
                score_image.save(str(score_image_path))
                score_image_path_rel = score_image_path.relative_to(videos_dir)
                result["result"]["segment"] = {
                    "name": "Segment",
                    "score": score,
                    "score_image": str(score_image_path_rel),
                }
            except Exception as e:
                print(f"Problem analyzing media {media['id']} with segment", e)
            results.append(result)

        return results

    @task.external_python(python=config["PYTHON_IMG_FAKES"])
    def detect_image_fakes_hf(media_list: list):
        from common.fakes_hf.scan import create_scanner

        filtered_media = [
            media
            for media in media_list
            if media["analysisStatus"]["fake"] == "waiting"
            and media["mediaType"] == "image"
        ]
        if not filtered_media:
            return []

        methods = [
            dict(
                key="organika",
                model_id="Organika/sdxl-detector",
                fake_label="artificial",
            ),
            dict(
                key="aiornot",
                model_id="Nahrawy/AIorNot",
                fake_label="ai",
            ),
        ]
        scanners = [
            dict(
                method=method,
                scan_file=create_scanner(
                    "cpu", method["model_id"], method["fake_label"]
                ),
            )
            for method in methods
        ]
        results = []
        for media in filtered_media:
            result = {"media": media, "result": {}}
            for scanner in scanners:
                key = scanner["method"]["key"]
                score = -1
                try:
                    score = scanner["scan_file"](media["file"])
                except Exception as e:
                    print(
                        f"Problem analyzing media {media['id']} with scanner {key}", e
                    )
                result["result"][key] = {
                    "score": score,
                    "name": scanner["method"]["model_id"],
                }
            results.append(result)

        return results

    @task
    def save_image_fakes(hf_results: list, segment_results: list):
        for hf_res, seg_res in zip(hf_results, segment_results):
            image_results = {**hf_res["result"], **seg_res["result"]}
            store_image_fakes(hf_res["media"]["id"], image_results)

    videos = wait_for_some_video() >> get_videos(config["VIDEOS_PATH"])
    transcriptions(config["VIDEOS_PATH"], videos)
    fakes_results_deepware = detect_fakes_deepware(videos)
    fakes_results_polimi = detect_fakes_polimi(config["VIDEOS_PATH"], videos)
    save_fakes(fakes_results_deepware, fakes_results_polimi)
    fakes_results_image_hf = detect_image_fakes_hf(videos)
    fakes_results_image_segment = detect_image_fakes_segment(
        config["VIDEOS_PATH"], videos
    )
    save_image_fakes(fakes_results_image_hf, fakes_results_image_segment)


analyze_dag()
