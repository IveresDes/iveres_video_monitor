import logging
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from time import sleep

import yt_dlp
from dotenv import dotenv_values

from common.database.database import (
    find_video_from_metadata,
    find_video_from_request_url,
    get_requested_videos,
    insert_video,
    request_to_videorequest,
    set_request_error,
    update_request,
)
from common.utils.yt_utils import get_user_last_videos_datetime

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)

config = dotenv_values(Path(__file__).parent.parent.parent / ".env")


def create_db_video(request, info, downloads_dir, video_file):
    file_path = Path(video_file)

    request_datetime = datetime.fromisoformat(request["requestDatetime"])
    download_datetime = datetime.now(timezone.utc)

    upload_datetime_only_date = datetime.strptime(
        info["upload_date"], "%Y%m%d"
    ).replace(tzinfo=timezone.utc)
    video_datetime = upload_datetime_only_date

    # Youtube does not provide time so we try to estimate it
    if info["extractor_key"].lower() == "youtube":
        # If it's from the same date use the request datetime
        if upload_datetime_only_date.date() == request_datetime.date():
            video_datetime = request_datetime
        # If possible get a more accurate datetime from rss feed
        user_last_videos_datetime = get_user_last_videos_datetime(info["channel_id"])
        feed_datetime = user_last_videos_datetime.get(info["id"])
        if feed_datetime:
            video_datetime = feed_datetime

    # Use timestamp if possible (TikTok) to get more time precision
    if info.get("timestamp"):
        video_datetime = datetime.fromtimestamp(info["timestamp"], timezone.utc)

    video = {
        "requests": [request_to_videorequest(request)],
        "priority": request["priority"],
        "analysisStatus": {
            analysis_type: "waiting" if is_enabled else "disabled"
            for analysis_type, is_enabled in request["analysisEnabled"].items()
        },
        "platform": info["extractor_key"].lower(),
        "status": "downloaded",
        "path": str(file_path.relative_to(Path(downloads_dir).absolute())),
        "downloadDatetime": download_datetime.isoformat(),
        "mediaType": "video",
        "platformMetadata": {
            "videoId": info["id"],
            "videoUrl": info["webpage_url"],
            "uploader": info["uploader"],
            "uploaderId": info["uploader_id"].strip("@"),
            "uploadDatetime": video_datetime.isoformat(),
            "title": info["title"],
            "description": info["description"],
            "duration": info["duration"],
        },
        "extractedMetadata": {},
    }
    return video


def convert_video_for_web(video_file):
    vid_file_inp = Path(video_file)
    vid_file_out = vid_file_inp.with_name(f"{vid_file_inp.stem}_temp.mp4")
    vid_file_out_final = vid_file_inp.with_name(f"{vid_file_inp.stem}.mp4")
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(vid_file_inp),
            "-c:a",
            "aac",
            "-c:v",
            "h264",
            "-f",
            "mp4",
            "-vf",
            "scale=-1:720",
            str(vid_file_out),
        ]
    )
    vid_file_inp.unlink(missing_ok=True)
    vid_file_out.rename(vid_file_out_final)
    return vid_file_out_final


def download_requests_videos(downloads_dir, max_num=0, sleep_video=0.3):
    downloads_dir = Path(downloads_dir)

    requests = get_requested_videos(max_num)
    if not requests:
        return

    ydl_opts = {
        "format_sort": [
            "hasvid",
            "hasaud",
            "res:720",
            "vcodec:h264",
            "acodec:aac",
            "vext:mp4",
            "aext:aac",
        ],
        "outtmpl": f"{downloads_dir}/%(extractor_key)s/%(upload_date)s/%(uploader_id)s/%(id)s/%(id)s.%(ext)s",
        "noplaylist": True,
        "restrictfilenames": True,
        # "ignoreerrors": True,
        # "quiet": True,
        "noprogress": True,
        "proxy": config.get("YT_DLP_PROXY"),
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for request in requests:
            # if "www.youtube.com" in request["url"]:
            #     continue
            try:
                # Check if url is already downloaded
                db_video = find_video_from_request_url(request["url"])
                if db_video is not None:
                    update_request(request, db_video, db_video["_id"])
                    continue

                # Extract url info
                info = ydl.extract_info(request["url"], download=False)
                sleep(sleep_video)
                # Ignore live videos
                if (
                    info.get("is_live")
                    or info.get("duration", float("inf")) > 5 * 60 * 60
                ):
                    set_request_error(request["_id"], "Live or very long video")
                    logger.info(
                        f"Not downloading request {request['url']} because it's live or very long"
                    )
                    continue

                # Check if video is already downloaded
                platform = info["extractor_key"].lower()
                db_video = find_video_from_metadata(platform, info["id"])
                if db_video is not None:
                    update_request(request, db_video, db_video["_id"])
                    continue

                # Download video, add to db and update request
                info = ydl.extract_info(request["url"], download=True)
                sleep(sleep_video)
                video_file = info["requested_downloads"][0]["filepath"]
                video_file_out = convert_video_for_web(video_file)
                video = create_db_video(request, info, downloads_dir, video_file_out)
                result = insert_video(video)
                update_request(request, video, result.inserted_id)
            except Exception:
                set_request_error(request["_id"], "Download error")
                logger.exception(f"Error downloading request {request['url']}")


if __name__ == "__main__":
    download_requests_videos("test", 5)
