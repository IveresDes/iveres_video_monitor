from datetime import datetime, timedelta
from pathlib import Path

from airflow.decorators import dag, task
from dotenv import dotenv_values

config = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


@dag(
    description="A DAG to monitor channels and gather video urls",
    start_date=datetime(2023, 2, 16, 0, 0, 0),
    schedule=timedelta(minutes=15),
    max_active_runs=1,
    catchup=False,
)
def monitor_dag():
    @task.external_python(python=config["PYTHON_GATHER"])
    def monitor_tiktok(hours_back):
        from datetime import timedelta
        from common.gather_tiktok.gather_tiktok import gather_tiktok

        gather_tiktok(time_back=timedelta(hours=hours_back))

    @task.external_python(python=config["PYTHON_GATHER"])
    def monitor_youtube(hours_back):
        from datetime import timedelta
        from common.gather_youtube.gather_youtube import gather_youtube

        gather_youtube(time_back=timedelta(hours=hours_back))

    hours_back = int(config["MONITOR_HOURS_BACK"])
    monitor_tiktok(hours_back)
    monitor_youtube(hours_back)


monitor_dag()
