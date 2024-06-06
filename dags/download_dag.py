from datetime import datetime
from pathlib import Path

from airflow.decorators import dag, task
from dotenv import dotenv_values

from common.database.database import get_requested_videos

config = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


@dag(
    description="A DAG to download retrieved videos",
    start_date=datetime(2023, 2, 16, 0, 0, 0),
    schedule="@continuous",
    max_active_runs=1,
    catchup=False,
)
def download_dag():
    @task.sensor(poke_interval=10, timeout=18000, mode="reschedule", soft_fail=True)
    def wait_for_some_request():
        requests = get_requested_videos(1)
        return bool(requests)

    @task.external_python(python=config["PYTHON_GATHER"])
    def download(videos_dir):
        from common.video_download.download_videos import download_requests_videos

        download_requests_videos(videos_dir, max_num=3)

    wait_for_some_request() >> download(config["VIDEOS_PATH"])


download_dag()
