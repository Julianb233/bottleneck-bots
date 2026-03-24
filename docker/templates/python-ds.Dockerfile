FROM bottleneck-desktop-base:latest

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3-dev python3-venv build-essential && \
    rm -rf /var/lib/apt/lists/*

USER orgo
WORKDIR /home/orgo

RUN python3 -m venv /home/orgo/venv && \
    /home/orgo/venv/bin/pip install --no-cache-dir \
    numpy pandas matplotlib seaborn scikit-learn jupyter jupyterlab ipykernel

ENV PATH="/home/orgo/venv/bin:$PATH"
ENV VIRTUAL_ENV="/home/orgo/venv"

LABEL orgo.template=true orgo.template.name=python-ds
