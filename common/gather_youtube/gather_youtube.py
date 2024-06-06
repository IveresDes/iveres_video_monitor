import logging
from datetime import datetime, timedelta, timezone
from time import sleep

import yt_dlp

from common.database.database import get_watchlist_channels, save_video_request
from common.utils.yt_utils import get_user_last_videos_datetime

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)


def users_videos_urls_generator(
    users_id,
    time_back=timedelta(weeks=1),
    max_videos_back: int = 0,
    sleep_user=1.0,
    sleep_video=0.1,
):
    start_datetime = datetime.now(timezone.utc) - time_back

    ydl_opts = {
        "skip_download": True,
        "daterange": yt_dlp.DateRange(start=start_datetime.strftime("%Y%m%d")),
        "lazy_playlist": True,
        "playlistend": max_videos_back,
        # "quiet": True,
        # "noprogress": True,
        # "ignoreerrors": True,
        # "cachedir": False,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        for user_id in users_id:
            logger.info(f"Getting videos for user {user_id} up to {start_datetime}")
            try:
                url = f"https://www.youtube.com/@{user_id}/videos"
                # Disable process to be able to process entries lazily later and break
                # early without processing the full playlist
                info = ydl.extract_info(url, download=False, process=False)
            except Exception:
                logger.exception(f"Error getting acount {user_id}")
                continue
            # Youtube does not provide time so we try to get it from feed
            user_last_videos_datetime = get_user_last_videos_datetime(
                info["channel_id"]
            )
            for ie_result in info["entries"]:
                try:
                    # Process entries here because ydl.extract_info(..., process=False)
                    ydl._wait_for_video(ie_result)
                    video = ydl.process_ie_result(
                        ie_result, download=False, extra_info=None
                    )
                    # Youtube does not provide upload time so we try to approximate
                    # First try to get it from feed
                    video_datetime = user_last_videos_datetime.get(video["id"])
                    if video_datetime is None:
                        upload_date = datetime.strptime(video["upload_date"], "%Y%m%d")
                        upload_date = upload_date.replace(tzinfo=timezone.utc)
                        current_datetime = datetime.now(timezone.utc)
                        # If date is today set datetime to now
                        # Otherwise use youtube date closest to next day
                        video_datetime = (
                            current_datetime
                            if upload_date.date() == current_datetime.date()
                            else upload_date.replace(hour=23, minute=59, second=59)
                        )

                    # Make sure video_datetime has timezone
                    if video_datetime.tzinfo is None:
                        video_datetime = video_datetime.replace(tzinfo=timezone.utc)

                    if video_datetime < start_datetime:
                        logger.debug(
                            f"Ignoring {video['webpage_url']} from {video_datetime}"
                        )
                        break
                    yield (user_id, video["webpage_url"])
                except Exception:
                    logger.exception(f"Error getting video for user {user_id}")
                logger.debug(f"Video gathered for {user_id}")
                sleep(sleep_video)
            logger.info(f"Videos gathered for user {user_id}")
            sleep(sleep_user)


def gather_youtube(
    time_back: timedelta = timedelta(weeks=1), max_videos_back: int = 100
):
    channels = get_watchlist_channels("youtube")
    channel_monitoring_users = {
        account["channelId"]: account["monitoringUsers"] for account in channels
    }
    channels_id = list(channel_monitoring_users.keys())
    channels_urls = users_videos_urls_generator(channels_id, time_back, max_videos_back)
    for channel_id, video_url in channels_urls:
        for user in channel_monitoring_users[channel_id]:
            request = {
                "source": "youtubeMonitor",
                "userId": user["userId"],
                "url": video_url,
                "requestDatetime": datetime.now(timezone.utc).isoformat(),
                "priority": 0,
                "status": "requested",
                "errorMessage": "",
                "videoId": None,
                "analysisEnabled": {"transcribe": True, "fake": False},
            }
            save_video_request(request)


if __name__ == "__main__":
    gather_youtube(timedelta(days=3))
