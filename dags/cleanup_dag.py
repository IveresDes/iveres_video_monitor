from datetime import datetime, timedelta
from pathlib import Path
from shutil import rmtree

from airflow.decorators import dag, task
from dotenv import dotenv_values

from common.database.database import get_old_unarchived_videos, set_video_status

config = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


@dag(
    "cleanup_dag",
    description="A DAG to clean up old files",
    start_date=datetime(2023, 2, 16, 0, 0, 0),
    schedule=timedelta(days=1),
    max_active_runs=1,
    catchup=False,
)
def cleanup_dag():
    @task
    def cleanup_old_files(videos_dir, max_days=31):
        # Get old videos
        videos = get_old_unarchived_videos(timedelta(days=max_days))

        # Cleanup old videos
        channels_dirs = set()
        days_dirs = set()
        for video in videos:
            print(f"Deleteing files and archiving video {video['_id']}")

            # Delete media path parent directory and all files inside
            video_file = Path(videos_dir, video["path"])
            video_dir = video_file.parent
            if video_dir.exists():
                rmtree(video_dir)

            # Delete dir if empty
            channels_dirs.add(video_dir.parent)
            days_dirs.add(video_dir.parent.parent)

            # Set video state to archived
            set_video_status(video["_id"], "archived")

        # Cleanup empty directories for channels and days
        for dir in [*channels_dirs, *days_dirs]:
            try:
                dir.rmdir()
            except Exception as e:
                print(e)

    cleanup_old_files(config["VIDEOS_PATH"], int(config["MONITOR_FILES_KEEP_DAYS"]))


cleanup_dag()
